// Gera manifesto de integridade; o ZIP é preparado pelo processo de entrega.
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),files={};
async function walk(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(e.name.startsWith('.env')&&e.name!=='.env.example')continue;if(e.name.endsWith('.log'))continue;if(['node_modules','dist','.git','.env','release.manifest.json'].includes(e.name))continue;const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile())files[relative(root,p).replaceAll('\\','/')]=createHash('sha256').update(await readFile(p)).digest('hex');}}
await walk(root);await writeFile(join(root,'release.manifest.json'),JSON.stringify({product:'Kage',version:pkg.version,algorithm:'sha256',files},null,2)+'\n');console.log('Manifesto criado com '+Object.keys(files).length+' arquivos.');
