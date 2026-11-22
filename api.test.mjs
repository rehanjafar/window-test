import assert from 'node:assert/strict';
import test from 'node:test';
import { handle, compare } from './api.mjs';

test('replays only the known fixtures, scores exact discrepancies, and requires credentials for live work', async () => {
  const request=(method,headers={})=>({method,headers});
  const [,study]=await handle(request('GET'),'/api/study',{});
  const versions={original:study.original,rewrite:study.rewrite};
  const [status,sample]=await handle(request('POST'),'/api/run',{...versions,mode:'sample'});
  assert.equal(status,200);
  assert.equal(sample.rows.reduce((n,row)=>n+row.original.score,0),5);
  assert.equal(sample.rows.reduce((n,row)=>n+row.rewrite.score,0),9);
  assert.equal(sample.rows[1].original.checks.at(-1).match,false);
  assert.equal(sample.rows[1].rewrite.evidenceVerified,true);
  assert.equal((await handle(request('POST'),'/api/run',{...versions,original:'Changed text',mode:'sample'}))[0],400);
  assert.throws(()=>compare(versions,{}),/missing an answer/);
  delete process.env.EXPECTED_PARROT_API_KEY;
  assert.equal((await handle(request('POST'),'/api/run',{...versions,mode:'live'}))[0],503);
  process.env.EXPECTED_PARROT_API_KEY='test-only';
  process.env.WINDOW_RUN_TOKEN='test-only-token';
  assert.equal((await handle(request('POST'),'/api/run',{...versions,mode:'live'}))[0],403);
});
