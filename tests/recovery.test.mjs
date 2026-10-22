import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../.github/workflows/recover-stale-data.yml',import.meta.url),'utf8');
const script=workflow.split('          script: |\n')[1].split('\n').map(l=>l.slice(12)).join('\n');
const run=new (Object.getPrototypeOf(async function(){}).constructor)('github','context','core','fetch',script);
const archive=minutes=>({mode:'live',checkedAt:new Date(Date.now()-minutes*60000).toISOString()});

async function check({repoAge=1,hostedAge=1,status,unavailable=false,invalid=false}={}){
  let dispatches=0;
  const github={rest:{repos:{getContent:async()=>({data:{content:Buffer.from(JSON.stringify(invalid?{mode:'sample'}:archive(repoAge))).toString('base64')}})},actions:{
    listWorkflowRuns:async()=>({data:{workflow_runs:status?[{status}]:[]}}),
    createWorkflowDispatch:async args=>{assert.equal(args.ref,'main');assert.equal(args.workflow_id,'update-and-deploy.yml');dispatches++}
  }}};
  await run(github,{repo:{owner:'sanlows',repo:'cwa-typhoon-browser'}},{notice(){},warning(){}},async()=>{
    if(unavailable)throw new Error('unavailable');
    return {ok:true,json:async()=>archive(hostedAge)};
  });
  return dispatches;
}
test('recovery leaves fresh repository and Pages alone',async()=>assert.equal(await check(),0));
test('recovery dispatches for stale repository, stale Pages, or unavailable Pages',async()=>{
  for(const options of [{repoAge:46},{hostedAge:46},{unavailable:true},{invalid:true},{repoAge:-2}])assert.equal(await check(options),1);
});
test('recovery avoids duplicates while an update is active or queued',async()=>{
  for(const status of ['queued','in_progress','waiting','pending','requested'])assert.equal(await check({repoAge:60,status}),0);
});
test('recovery retries after a completed update when Pages is still stale',async()=>assert.equal(await check({hostedAge:60,status:'completed'}),1));
