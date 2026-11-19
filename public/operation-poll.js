const activeStates=new Set(['queued','running']);
export class OperationPoll{
 constructor({read,onState,onError=()=>{},schedule=fn=>setTimeout(fn,3000),clear=id=>clearTimeout(id)}){Object.assign(this,{read,onState,onError,schedule,clear});this.generation=0;}
 stop(){this.generation++;if(this.timer!==undefined)this.clear(this.timer);this.timer=undefined;}
 start(id){this.stop();const generation=this.generation;const tick=async()=>{if(generation!==this.generation)return;try{const result=await this.read(id);if(generation!==this.generation)return;this.onState(result);if(activeStates.has(result.state))this.timer=this.schedule(tick);else this.stop();}catch(e){if(generation!==this.generation)return;this.stop();this.onError(e);}};this.timer=this.schedule(tick);}
}
