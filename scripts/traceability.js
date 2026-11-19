import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),data=JSON.parse(await readFile(resolve(root,'docs/traceability.json'),'utf8')),ids=new Set(),counts={};
for(const r of data.requirements){if(ids.has(r.id)||r.page<1||r.page>data.pages)throw new Error('ID/página inválidos: '+r.id);ids.add(r.id);counts[r.status]=(counts[r.status]||0)+1;for(const name of [...r.files,...r.tests,r.schema])if(name){const path=resolve(root,name);if(!path.startsWith(root))throw new Error('Caminho inválido: '+name);await access(path);}}
if(ids.size!==141)throw new Error('As 141 seções devem permanecer rastreadas.');
const cell=x=>String(x).replaceAll('|','／').replaceAll('\n',' '),rows=data.requirements.map(r=>'| '+[r.id,r.page,r.title,r.status,r.files.join(', '),r.tests.join(', '),r.gap].map(cell).join(' | ')+' |');
await writeFile(resolve(root,'docs/traceability.md'),'# Rastreabilidade Kage '+data.release+'\n\nFonte principal: '+data.source+' · '+data.pages+' páginas físicas · 141 seções.\n\nImplementação local não equivale a conformidade integral nem aprovação de produção. Contratos, permissões/intents/retencão e endpoints também constam em traceability.json e implementation.md.\n\n'+Object.entries(data.statusLegend).map(([s,n])=>'- '+s+': '+n).join('\n')+'\n\n| ID | Página | Seção | Estado | Implementação | Testes locais | Lacuna/condição |\n| --- | --- | --- | --- | --- | --- | --- |\n'+rows.join('\n')+'\n');
console.log(JSON.stringify({release:data.release,sections:ids.size,counts,pathsVerified:true}));
