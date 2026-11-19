import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../public/api.js';

const bootstrap={mode:'live',user:{id:'fixture-user',username:'Conta de teste'},csrf:'fixture-csrf',discordReady:true};
const mockFetch=(t,handler)=>t.mock.method(globalThis,'fetch',async(url,options)=>String(url).endsWith('runtime.json')?Response.json({mode:'live'}):handler(String(url),options));

test('Bootstrap autenticado mantém live e carrega preferências com cookie same-origin',async t=>{
  const calls=[];mockFetch(t,async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('bootstrap')?bootstrap:{preferences:{notifications:true}});});
  await api.init();assert.equal(api.mode,'live');assert.equal(api.user.id,'fixture-user');assert.equal(api.preferences.notifications,true);
  for(const {options} of calls){assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');}
});

test('Falha em preferências não bloqueia acesso aos servidores autenticados',async t=>{
  mockFetch(t,async url=>url.endsWith('bootstrap')?Response.json(bootstrap):url.endsWith('me')?new Response('Indisponível',{status:503}):Response.json([{id:'fixture-guild'}]));
  await api.init();assert.equal(api.mode,'live');assert.match(api.preferencesError,/preferências não foram carregadas/);assert.equal((await api.guilds())[0].id,'fixture-guild');
});

test('401 no bootstrap ou nas preferências invalida sessão e não vira demo',async t=>{
  for(const endpoint of ['bootstrap','me']){
    const mock=mockFetch(t,async url=>url.endsWith(endpoint)?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(bootstrap));
    await assert.rejects(api.init(),{status:401,code:'AUTH_REQUIRED'});assert.equal(api.mode,'live');assert.equal(api.user,null);assert.equal(api.csrf,'');mock.mock.restore();
  }
});

test('Modo inesperado ou bootstrap inválido falham sem restaurar conta demo',async t=>{
  for(const body of [{...bootstrap,mode:'demo'},null,{mode:'live',user:{}},{mode:'live',user:bootstrap.user}]){
    const mock=mockFetch(t,async()=>Response.json(body));api.mode='demo';api.user={username:'Exemplo'};
    await assert.rejects(api.init(),/serviço não confirmou/);assert.equal(api.mode,'unavailable');assert.equal(api.user,null);mock.mock.restore();
  }
});

test('Descritor demo antigo não habilita conta fictícia nem dados locais',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({mode:'demo'}));
  await assert.rejects(api.init(),/Ambiente desconhecido/);
  assert.equal(api.mode,'unavailable');assert.equal(api.user,null);assert.equal(api.csrf,'');
});

test('Timeout do runtime elimina modo e conta anteriores',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('Timeout de teste');});api.mode='demo';api.user={username:'Exemplo'};
  await assert.rejects(api.init());assert.equal(api.mode,'unavailable');assert.equal(api.user,null);
});

test('HTTP 429, HTML de erro e falha de rede retornam orientação legível',async t=>{
  for(const [handler,message] of [[async()=>new Response('Rate limit',{status:429}),/Aguarde um minuto/],[async()=>new Response('<html>indisponível</html>',{status:503}),/serviço não confirmou/],[async()=>{throw new Error('fixture network');},/conexão não respondeu/]]){
    const mock=t.mock.method(globalThis,'fetch',handler);await assert.rejects(api.request('guilds'),message);mock.mock.restore();
  }
});

test('JSON null válido preserva a ausência de rascunho',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json(null));assert.equal(await api.request('guilds/fixture/wizard'),null);
});

test('401 numa ação remove usuário e token CSRF da interface',async t=>{
  Object.assign(api,{mode:'live',user:bootstrap.user,csrf:bootstrap.csrf});t.mock.method(globalThis,'fetch',async()=>new Response('Unauthorized',{status:401}));
  await assert.rejects(api.request('guilds'),{status:401,code:'AUTH_REQUIRED'});assert.equal(api.user,null);assert.equal(api.csrf,'');
});
