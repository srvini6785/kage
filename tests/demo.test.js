import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const memory = new Map();
globalThis.localStorage = { getItem:k=>memory.get(k)??null, setItem:(k,v)=>memory.set(k,v), removeItem:k=>memory.delete(k) };
if(!globalThis.crypto) globalThis.crypto = webcrypto;
const { api } = await import('../public/api.js');
api.mode = 'demo';

test('Alterações de demo persistem por servidor sem atingir o outro', async () => {
  const first = await api.state('demo-kage');
  first.config.settings.automod.maxMessages = 11;
  await api.save('demo-kage',first.config.version,first.config.settings);
  assert.equal((await api.state('demo-kage')).config.settings.automod.maxMessages,11);
  assert.equal((await api.state('demo-svr')).config.settings.automod.maxMessages,6);
});
test('Salvar com versão antiga é rejeitado', async () => {
  const state = await api.state('demo-kage');
  await assert.rejects(api.save('demo-kage',state.config.version-1,state.config.settings),/outra aba/);
});
test('Plano de setup exige execução e confirma uma única vez', async () => {
  let state = await api.state('demo-kage');
  await assert.rejects(api.plan('demo-kage','setup',{}),/Execução/);
  state.config.settings.modules.setup='enforce';
  await api.save('demo-kage',state.config.version,state.config.settings);
  const plan = await api.plan('demo-kage','setup',{ category:'KAGE · Test',channels:['rules'] });
  const result = await api.confirm('demo-kage',plan);
  assert.match(result.message,/Nenhuma alteração foi enviada/);
  await assert.rejects(api.confirm('demo-kage',plan),/Plano expirado, usado/);
  state = await api.state('demo-kage');
  assert.equal(state.channels.filter(c=>c.name==='rules').length,1);
});
test('Pausa ou mudança de versão invalida o plano pendente', async () => {
  let state = await api.state('demo-kage');
  const plan = await api.plan('demo-kage','setup',{category:'KAGE · Next',channels:['chat']});
  state.config.settings.paused=true;
  await api.save('demo-kage',state.config.version,state.config.settings);
  await assert.rejects(api.confirm('demo-kage',plan),/configuração alterada/);
  api.reset('demo-kage');
});
test('Falha no serviço real não se apresenta como demonstração', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes('runtime.json') ? { ok:true,json:async()=>({mode:'live'}) } : {status:503,ok:false};
  await assert.rejects(api.init(),/serviço não confirmou/);
  assert.notEqual(api.mode,'demo');
  globalThis.fetch = previous;
});
