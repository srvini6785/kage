import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {api} from '../public/api.js';
import {extension} from '../public/extended.js';
import {demoDefaults} from '../public/data.js';

const tick=async()=>{for(let n=0;n<8;n++)await new Promise(setImmediate);};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
let instance=0;
async function open(t,path,{user={id:'fixture-user',username:'Conta de teste'},list=[{id:'123456789012345678',name:'Servidor de teste',memberCount:1}],failure,hash}={}){
  const {document,window}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  const globals=['document','window','location','localStorage','sessionStorage'];
  const before=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const methods={init:api.init,guilds:api.guilds,state:api.state,logout:api.logout};
  const timers=new Set(),originalTimeout=globalThis.setTimeout;
  globalThis.setTimeout=(fn,ms,...args)=>{const id=originalTimeout(fn,ms,...args);timers.add(id);return id;};
  const location=new URL('https://kage.test/'+path),state=demoDefaults('demo-kage');state.guild={...state.guild,id:'123456789012345678',name:'Servidor de teste'};state.scopes=['view','settings','security','structure','messages','audit'];state.logs=[];state.tickets=[];state.profiles=[];
  Object.assign(globalThis,{document,window,location,localStorage:storage(),sessionStorage:storage()});
  window.scrollTo=()=>{};window.history={replaceState:(_a,_b,url)=>{location.href=new URL(url,location).href;}};
  document.querySelector('#dialog').showModal=()=>document.querySelector('#dialog').setAttribute('open','');
  document.querySelector('#dialog').close=()=>document.querySelector('#dialog').removeAttribute('open');
  let guildCalls=0,stateFailure=failure,currentList=list;
  api.init=async()=>{Object.assign(api,{mode:'live',user,csrf:'fixture-csrf',discordReady:true,preferencesError:null});};
  api.guilds=async()=>{guildCalls++;return structuredClone(currentList);};
  api.state=async()=>{if(stateFailure)throw stateFailure;return structuredClone(state);};
  t.after(()=>{extension.reset();for(const timer of timers)clearTimeout(timer);globalThis.setTimeout=originalTimeout;Object.assign(api,methods);for(const k of globals){if(before[k])Object.defineProperty(globalThis,k,before[k]);else delete globalThis[k];}});
  await import('../public/app.js?auth-flow='+ ++instance);await tick();
  const route=async page=>{location.hash=page;window.dispatchEvent(new window.Event('hashchange'));await tick();};
  if(hash)await route(hash);
  return {document,route,guildCalls:()=>guildCalls,recover:()=>{stateFailure=null;},setGuilds:next=>{currentList=next;}};
}

test('Retorno OAuth em overview abre servidor real sem rótulos ou guilda demo',async t=>{
  const {document}=await open(t,'#overview');
  assert.equal(document.querySelector('h1').textContent,'Visão geral');
  assert.equal(document.querySelector('#sidebar-guild').textContent,'Servidor de teste');
  assert.equal(document.querySelector('#account-name').textContent,'Conta de teste');
  assert.doesNotMatch(document.querySelector('#main').textContent,/demonstração|Kage Community/i);
});

for(const entry of ['home','login'])test('Conta autenticada em '+entry+' abre diretamente o painel',async t=>{
  const {document,route,guildCalls}=await open(t,'#'+entry);
  assert.equal(guildCalls(),1);
  assert.equal(document.querySelector('h1').textContent,'Visão geral');
  assert.equal(document.body.classList.contains('auth-shell'),false);
  assert.doesNotMatch(document.querySelector('#main').textContent,/Entrar com Discord|demonstração/i);
  await route('documents');await route('login');
  assert.equal(document.querySelector('h1').textContent,'Visão geral');
});

for(const entry of ['','home','login','overview','profile'])test('Sem sessão em '+(entry||'raiz')+' mostra login sem dashboard',async t=>{
  const {document,guildCalls}=await open(t,'#'+entry,{user:null});
  assert.equal(document.querySelector('h1').textContent,'Entrar no Kage');
  assert.equal(document.title,'Kage · Entrar');
  assert.ok(document.body.classList.contains('auth-shell'));
  assert.ok(document.querySelector('#main a[href="./auth/login"]'));
  assert.equal(guildCalls(),0);
  assert.doesNotMatch(document.querySelector('#main').textContent,/demonstração|Kage Community|Você revisa/i);
});

test('Falha OAuth no hash público continua visível e permite novo login',async t=>{
  const {document}=await open(t,'?falha=KAGE-OAUTH-STATE#home',{user:null});
  assert.match(document.querySelector('[role="alert"]').textContent,/sessão de login expirou/);
  assert.ok(document.querySelector('#main a[href="./auth/login"]'));
  document.querySelector('#account').click();
  assert.doesNotMatch(document.querySelector('#dialog-body').textContent,/undefined|Conta conectada/);
});

test('Servidor ausente permite convite, atualização e troca de conta',async t=>{
  const {document,setGuilds}=await open(t,'#overview',{list:[]});
  assert.match(document.querySelector('h1').textContent,/Nenhum servidor disponível/);
  assert.ok(document.querySelector('#main a[href="./invite"]'));
  assert.ok(document.querySelector('#logout'));
  assert.doesNotMatch(document.querySelector('#sidebar-guild').textContent,/Kage Community/);
  setGuilds([{id:'123456789012345678',name:'Servidor de teste',memberCount:1}]);
  document.querySelector('#retry-connect').click();await tick();
  assert.equal(document.querySelector('h1').textContent,'Visão geral');
});

test('Falha no carregamento não gera demo e tentar novamente abre o painel',async t=>{
  const {document,recover}=await open(t,'#overview',{failure:new Error('Banco temporariamente indisponível')});
  assert.match(document.querySelector('[role="alert"]').textContent,/Banco temporariamente/);
  assert.doesNotMatch(document.querySelector('#main').textContent,/demonstração/i);
  document.querySelector('#refresh').click();await tick();
  assert.doesNotMatch(document.querySelector('#toast').textContent,/Dados atualizados/);
  assert.match(document.querySelector('[role="alert"]').textContent,/Banco temporariamente/);
  recover();document.querySelector('#retry-connect').click();await tick();
  assert.equal(document.querySelector('h1').textContent,'Visão geral');
});

test('Sessão expirada ao carregar servidor oferece login, não retry em loop',async t=>{
  const {document}=await open(t,'#overview',{failure:Object.assign(new Error('Sua sessão expirou.'),{status:401,code:'AUTH_REQUIRED'})});
  assert.ok(document.querySelector('#main a[href="./auth/login"]'));
  assert.equal(document.querySelector('#retry-connect'),null);
  assert.equal(document.querySelector('#account-role').textContent,'Não conectado');
  assert.match(document.querySelector('[role="alert"]').textContent,/sessão expirou/);
});
