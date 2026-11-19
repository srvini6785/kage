// Estado por guilda/operador; a mesma fila trata armazenamento síncrono e HTTP.
export class DraftSession{
 constructor({read,write,onStatus=()=>{}}){this.read=read;this.write=write;this.onStatus=onStatus;this.revision=0;this.savedRevision=-1;this.version=0;this.undoStack=[];this.redoStack=[];}
 async load(fallback){const saved=await this.read();this.draft=structuredClone(saved?.draft||fallback);this.version=saved?.version||0;this.savedRevision=this.version?0:-1;return this;}
 change(change){const before=structuredClone(this.draft),next=structuredClone(this.draft);change(next);if(JSON.stringify(next)===JSON.stringify(before))return;this.undoStack.push(before);if(this.undoStack.length>20)this.undoStack.shift();this.redoStack=[];this.draft=next;this.revision++;this.onStatus('Alterações pendentes');}
 undo(){if(!this.undoStack.length)return false;this.redoStack.push(structuredClone(this.draft));this.draft=this.undoStack.pop();this.revision++;this.onStatus('Alterações desfeitas; salvamento pendente');return true;}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push(structuredClone(this.draft));this.draft=this.redoStack.pop();this.revision++;this.onStatus('Alterações refeitas; salvamento pendente');return true;}
 async save(){
  if(this.saving){await this.saving;if(this.savedRevision!==this.revision)return this.save();return;}
  if(this.savedRevision===this.revision)return;
  const revision=this.revision,input={version:this.version,draft:structuredClone(this.draft)};
  this.onStatus('Salvando…');
  this.saving=Promise.resolve().then(()=>this.write(input)).then(saved=>{this.version=saved.version;this.savedRevision=revision;this.onStatus('Rascunho salvo · v'+saved.version);}).catch(e=>{this.onStatus(e.message);throw e;}).finally(()=>{this.saving=null;});
  await this.saving;if(this.revision!==this.savedRevision)return this.save();
 }
}
