import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const study=JSON.parse(readFileSync(new URL('./study.json',import.meta.url),'utf8'));
const keys=['action','deadline','exception'];
const fixtures={
  'friday:original':['Upload the form','2026-11-19','None',0],
  'friday:rewrite':['Upload the form','2026-11-20','None',1],
  'missing:original':['Request extension','2026-11-23','Automatic extension',1],
  'missing:rewrite':['Request extension','2026-11-23','Approval required',4],
  'closure:original':['Upload the form','2026-11-24','None',0],
  'closure:rewrite':['Upload the form','2026-11-25','Skip closure',2]
};
const norm = value => String(value ?? '').trim().toLowerCase().replace(/^[“"]|[.”"]+$/g,'');
let running=false;
function evaluate(payload) {
  return new Promise((resolve,reject) => {
    const python=spawn(process.env.EDSL_PYTHON || 'python3',['evaluate.py'],{timeout:100_000,stdio:['pipe','pipe','pipe']});
    let output='';
    python.stdout.on('data',chunk=>{ if(output.length<210_000) output+=chunk; else python.kill(); });
    python.stderr.resume();
    python.stdin.on('error',reject);
    python.on('error',reject);
    python.on('close',code=>{
      if(code!==0) return reject(new Error('Expected Parrot worker failed'));
      try {
        const lines=output.split('\n').filter(line=>line.startsWith('WINDOW_RESULT '));
        resolve(Object.fromEntries(lines.map(line=>{const value=JSON.parse(line.slice(14));return [value.key,value];})));
      } catch(error) { reject(error); }
    });
    python.stdin.end(JSON.stringify(payload));
  });
}
function sampleAnswer(key,notice) {
  const [action,deadline,exception,sentence]=fixtures[key];
  return {action,deadline,exception,evidence:notice.split(/(?<=\.)\s+/)[sentence]};
}
function clip(value) { return typeof value==='string' ? value.trim().slice(0,700) : ''; }
export function compare(versions, answers) {
  return study.cases.map(item=>{
    const row={id:item.id,name:item.name,facts:item.facts,expected:item.expected};
    for(const version of ['original','rewrite']){
      const k=item.id+':'+version;
      const raw=answers ? answers[k] : sampleAnswer(k,versions[version]);
      if (!raw || keys.some(field=>typeof raw[field]!=='string')) throw Error('An evaluation is missing an answer.');
      const evidence=clip(raw.evidence);
      const matches=evidence && norm(versions[version]).includes(norm(evidence));
      const checks=keys.map(field=>({field,answer:clip(raw[field]),match:norm(raw[field])===norm(item.expected[field])}));
      row[version]={checks,evidence,evidenceVerified:Boolean(matches),score:checks.filter(check=>check.match).length};
    }
    return row;
  });
}
async function trace(rows, mode, started) {
  const endpoint=process.env.TRACEROOT_OTLP_TRACES_URL;
  if(!endpoint) return {status:'not configured'};
  if(mode!=='expected-parrot') return {status:'disabled for sample replay'};
  const traceId=randomBytes(16).toString('hex'), parent=randomBytes(8).toString('hex');
  const startTimeUnixNano=(BigInt(started)*1_000_000n).toString();
  const endTimeUnixNano=(BigInt(Date.now())*1_000_000n).toString();
  const attrs=values=>Object.entries(values).map(([key,value])=>({key,value:{stringValue:String(value)}}));
  const span=(name,spanId,attributes,parentSpanId)=>({traceId,spanId,name,kind:1,startTimeUnixNano,endTimeUnixNano,attributes:attrs(attributes),...(parentSpanId?{parentSpanId}:{})});
  const spans=[span('notice.compare',parent,{mode})];
  for(const row of rows) for(const version of ['original','rewrite']) {
    spans.push(span('notice.comprehension',randomBytes(8).toString('hex'),{scenario:row.id,version,score:row[version].score,evidence_verified:row[version].evidenceVerified},parent));
  }
  try {
    const headers=JSON.parse(process.env.TRACEROOT_OTLP_HEADERS_JSON || '{}');
    const response=await fetch(endpoint,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({resourceSpans:[{resource:{attributes:attrs({'service.name':'window-test'})},scopeSpans:[{scope:{name:'window-test'},spans}]}]}),
      signal:AbortSignal.timeout(5500)
    });
    if(!response.ok) return {status:'collector rejected request ('+response.status+')'};
    const acknowledgement=await response.json().catch(()=>({}));
    if(Number(acknowledgement.partialSuccess?.rejectedSpans || 0)>0) return {status:'collector rejected some spans',traceId};
    return {status:'accepted by collector',traceId};
  } catch { return {status:'collector unreachable or unconfigured'}; }
}
function authorized(req) {
  const expected=Buffer.from(process.env.WINDOW_RUN_TOKEN || '');
  const actual=Buffer.from(req.headers['x-run-token'] || '');
  return expected.length>0 && expected.length===actual.length && timingSafeEqual(expected,actual);
}
export async function handle(req,path,body) {
  if(req.method==='GET' && path==='/api/study') return [200,{...study,liveConfigured:Boolean(process.env.EXPECTED_PARROT_API_KEY)}];
  if(req.method!=='POST' || path!=='/api/run') return [404,{error:'Unknown operation.'}];
  const versions={original:typeof body.original==='string' ? body.original.trim() : '',rewrite:typeof body.rewrite==='string' ? body.rewrite.trim() : ''};
  if(Object.values(versions).some(value=>!value || value.length>3000)) return [400,{error:'Both notices must contain 1–3000 characters.'}];
  if(body.mode==='sample'){
    if(Object.keys(versions).some(version=>versions[version]!==study[version])) return [400,{error:'Sample replay only supports the supplied notices. Run live to evaluate edits.'}];
    return [200,{rows:compare(versions),mode:'sample',trace:{status:'disabled for sample replay'}}];
  }
  if(body.mode!=='live') return [400,{error:'Choose sample or live mode.'}];
  if(!process.env.EXPECTED_PARROT_API_KEY) return [503,{error:'Expected Parrot credentials are not configured.'}];
  if(!authorized(req)) return [403,{error:'Enter the local run token to start a paid evaluation.'}];
  if(running) return [409,{error:'An evaluation is already running.'}];
  running=true;
  try {
    const started=Date.now();
    const answers=await evaluate({...versions,cases:study.cases.map(({id,facts})=>({id,facts}))});
    const rows=compare(versions,answers);
    const telemetry=await trace(rows,'expected-parrot',started);
    return [200,{rows,mode:'expected-parrot',trace:telemetry}];
  } catch { return [502,{error:'Live evaluation failed. Check the Python environment, model access, and Expected Parrot credits.'}]; }
  finally { running=false; }
}
