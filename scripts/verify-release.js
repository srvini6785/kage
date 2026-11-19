import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(resolve(root,'release.manifest.json'),'utf8')),modified=[],missing=[];
for(const [name,expected] of Object.entries(manifest.files)){
 const full=resolve(root,name),rel=relative(root,full);
 if(isAbsolute(rel)||rel.startsWith('..'))throw new Error('Caminho inválido no manifesto.');
 try{const hash=createHash('sha256').update(await readFile(full)).digest('hex');if(hash!==expected)modified.push(name);}catch(e){if(e.code==='ENOENT')missing.push(name);else throw e;}
}
console.log(JSON.stringify({product:'Kage',version:manifest.version,checked:Object.keys(manifest.files).length,modified,missing,ok:!modified.length&&!missing.length,note:modified.length?'Há edições locais. Preserve-as e compare antes de substituir arquivos.':'Hashes locais conferidos; isso verifica integridade, não substitui testes de integração.'},null,2));
if(modified.length||missing.length)process.exitCode=1;
