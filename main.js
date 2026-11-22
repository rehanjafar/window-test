import {api,wireVoice} from './voice.js';
const $=id=>document.getElementById(id);
const form=$('comparison');
let study,running=false;
function el(tag,text) {const n=document.createElement(tag);n.textContent=text;return n;}
function restore() {if(study) for(const version of ['original','rewrite']) form.elements[version].value=study[version];}
function render(result) {
  $('score').replaceChildren();
  $('rows').replaceChildren();
  const sum=version=>result.rows.reduce((total,row)=>total+row[version].score,0);
  $('score').append(el('strong',sum('original')+' → '+sum('rewrite')+' expected answers matched out of '+result.rows.length*3));
  $('score').append(el('p',result.mode==='sample' ? 'Sample replay · Predetermined responses, no model run' : 'Expected Parrot · Synthetic respondents, not human research'));
  $('score').append(el('small','TraceRoot: '+result.trace.status+(result.trace.traceId?' · '+result.trace.traceId:'')));
  for(const row of result.rows){
    const card=el('article','');
    card.append(el('h3',row.name),el('p',row.facts));
    const pair=el('div','');pair.className='proof';
    for(const version of ['original','rewrite']){
      const block=el('section','');block.append(el('h4',version==='original'?'Original':'Revised'));
      const list=el('ul','');
      for(const check of row[version].checks){
        const li=el('li',check.field+': '+check.answer+(check.match?' — matched':' — expected '+row.expected[check.field]));
        li.className=check.match?'match':'mismatch';list.append(li);
      }
      block.append(list);
      if(row[version].evidence) block.append(el('blockquote',(row[version].evidenceVerified?'Source quote: ':'Unverified source quote: ')+row[version].evidence));
      pair.append(block);
    }
    card.append(pair);$('rows').append(card);
  }
}
$('restore').addEventListener('click',restore);
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(running) return;
  const mode=event.submitter?.value || 'sample';
  const {original,rewrite,token}=Object.fromEntries(new FormData(form));
  running=true;
  for(const button of form.querySelectorAll('button')) button.disabled=true;
  $('feedback').textContent=mode==='live'?'Evaluating six version/scenario pairs…':'Loading sample comparison…';
  try{
    const result=await api('run',{mode,original,rewrite},{'x-run-token':token});
    if(result.error){$('feedback').textContent=result.error;return;}
    render(result);$('feedback').textContent='Comparison complete.';
  }catch{$('feedback').textContent='Could not reach the evaluation server.';}
  finally{running=false;for(const button of form.querySelectorAll('button')) button.disabled=false;}
});
wireVoice({read_revised_notice:()=>{
  const notice=form.elements.rewrite.value.trim();
  return notice?{ok:true,notice}:{ok:false,error:'No revised notice entered.'};
}});
api('study').then(data=>{study=data;restore();$('feedback').textContent=data.liveConfigured?'Run a sample replay or a live comparison.':'Sample replay is ready. Configure Expected Parrot to run live.';})
.catch(()=>{$('feedback').textContent='Could not load the sample study.';});
