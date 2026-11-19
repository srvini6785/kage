import {KageError} from '../src/core/policy.js';
export async function runBatch(items,{authorize,effect,checkpoint,sleep=ms=>new Promise(r=>setTimeout(r,ms)),cancelled=async()=>false}){const results=[];
 for(let index=0;index<items.length;index++){
  if(await cancelled())return {state:'cancelled',results,remaining:items.length-index};
  let started=false;
  try{await authorize(items[index],index);await checkpoint({state:'running',index,results});let value;
   for(let attempt=0;attempt<2;attempt++){try{started=true;value=await effect(items[index],index);break;}catch(e){const after=Number(e.retry_after??e.rawError?.retry_after);if(e.status===429&&Number.isFinite(after)&&after>=0&&attempt===0){started=false;await checkpoint({state:'queued',index,results,retryAfter:after});await sleep(after*1000);await authorize(items[index],index);continue;}if(e instanceof KageError||(Number.isInteger(e.status)&&e.status>=400&&e.status<500))started=false;throw e;}}
   results.push({index,state:'applied',...value});await checkpoint({state:'running',index:index+1,results});
  }catch(e){const state=started?'unknown':results.length?'partial':'failed';results.push({index,state:started?'unknown':'failed',code:typeof e.code==='string'?e.code:'DISCORD_UNAVAILABLE'});await checkpoint({state,index,results}).catch(()=>{});return {state,results,remaining:items.length-index-1};}
 }
 const result={state:'applied',results,remaining:0};await checkpoint(result);return result;
}
export function bulkEligible(messages,now=Date.now()){return {eligible:messages.filter(m=>now-m.createdTimestamp<14*86400000),tooOld:messages.filter(m=>now-m.createdTimestamp>=14*86400000)};}
