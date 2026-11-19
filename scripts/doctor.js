import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),pkg=JSON.parse(readFileSync(root+'package.json','utf8')),problems=[];
const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||major===22&&minor<13||major===23)problems.push('Use Node.js 22.13 ou Node 24+.');
const dependencies=Object.entries(pkg.dependencies).map(([name,expected])=>{try{require.resolve(name);return {name,expected,installed:true};}catch{problems.push('Dependência ausente: '+name);return {name,expected,installed:false};}});
console.log(JSON.stringify({product:'Kage',version:pkg.version,platform:process.platform,node:process.version,environmentFilePresent:existsSync(root+'.env'),dependencies,problems,nextStep:problems.length?'Instale a versão necessária do Node e execute npm ci.':'Execute npm run verify-release, npm test e npm run build. Para demo: npm run demo.'},null,2));
if(problems.length)process.exitCode=1;
