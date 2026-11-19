import {cp,mkdir,rm,readFile} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=resolve(root,'dist');
if(destination!==join(resolve(root),'dist'))throw new Error('Invalid build target');
const manifest=JSON.parse(await readFile(join(root,'release.manifest.json'),'utf8'));
const entries=[...Object.keys(manifest.files),'release.manifest.json'].map(item=>({source:resolve(root,item),target:resolve(destination,item)}));
for(const {source,target} of entries)if(!source.startsWith(resolve(root)+sep)||!target.startsWith(destination+sep))throw new Error('Invalid manifest path');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const {source,target} of entries){await mkdir(dirname(target),{recursive:true});await cp(source,target);}
console.log('Aplicação Node executável preparada em dist/. Instale dependências com npm ci; inicie com npm start.');
