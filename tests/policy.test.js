import test from 'node:test';
import assert from 'node:assert/strict';
import { sameScope, canManageBits, assertModule, createPlan, validatePlan, hashPlan, SlidingWindow, levelForXp, escapeHtml, inertText } from '../src/core/policy.js';

test('IDs de outra guilda ou escopo ausente não autorizam acesso', () => {
  assert.throws(() => sameScope('guild-a','guild-b'), { code: 'KAGE-SCOPE' });
  assert.throws(() => sameScope(undefined, undefined));
  assert.doesNotThrow(() => sameScope('guild-a','guild-a'));
});
test('Autorização por bit exige Gerenciar servidor ou Administrador', () => {
  for (const bits of ['0','4','16','not-an-integer']) assert.equal(canManageBits(bits), false);
  for (const bits of ['8','32','40']) assert.equal(canManageBits(bits), true);
});
test('Módulo ausente, observação e pausa bloqueiam efeitos', () => {
  assert.throws(() => assertModule({}, 'tickets', { effect:true }));
  assert.throws(() => assertModule({ modules:{ tickets:'observe' } },'tickets',{ effect:true }), { code:'KAGE-OBSERVE' });
  assert.throws(() => assertModule({ paused:true, modules:{ tickets:'enforce' } },'tickets',{ effect:true }), { code:'KAGE-PAUSED' });
  assert.doesNotThrow(() => assertModule({ modules:{ tickets:'enforce' } },'tickets',{ effect:true }));
});
const fixture = () => createPlan({ guildId:'guild-a',actorId:'actor-a',version:3,kind:'setup',payload:{ channels:['general'] },now:1000 });
test('Plano fica vinculado ao operador e ao servidor da prévia', () => {
  assert.throws(() => validatePlan(fixture(), { guildId:'guild-b',actorId:'actor-a',version:3,now:2000 }), { code:'KAGE-SCOPE' });
  assert.throws(() => validatePlan(fixture(), { guildId:'guild-a',actorId:'actor-b',version:3,now:2000 }), { code:'KAGE-PLAN-ACTOR' });
});
test('Plano expirado, reutilizado ou de configuração antiga não executa', () => {
  const valid = { guildId:'guild-a',actorId:'actor-a',version:3,now:2000 };
  assert.doesNotThrow(() => validatePlan(fixture(),valid));
  assert.throws(() => validatePlan(fixture(), {...valid,now:301001}), { code:'KAGE-PLAN-EXPIRED' });
  assert.throws(() => validatePlan(fixture(), {...valid,version:4}), { code:'KAGE-PLAN-STALE' });
  assert.throws(() => validatePlan({...fixture(),status:'executing'},valid), { code:'KAGE-PLAN-USED' });
});
test('Alterar o payload invalida a confirmação', () => {
  const p = fixture(); p.payload.channels.push('secret-admin');
  assert.notEqual(p.hash,hashPlan(p.payload));
  assert.throws(() => validatePlan(p,{ guildId:'guild-a',actorId:'actor-a',version:3,now:2000 }),{ code:'KAGE-PLAN-TAMPERED' });
});
test('Flood deduplica eventos e não mistura servidores', () => {
  const w = new SlidingWindow({ windowMs:1000,limit:2 });
  assert.equal(w.hit('guild-a:user','1',1000).exceeded,false);
  assert.equal(w.hit('guild-a:user','1',1100).duplicate,true);
  w.hit('guild-a:user','2',1200);
  assert.equal(w.hit('guild-a:user','3',1300).exceeded,true);
  assert.equal(w.hit('guild-b:user','4',1300).exceeded,false);
  assert.equal(w.hit('guild-a:user','5',2500).count,1);
});
test('Janela limita memória de usuários inativos', () => {
  const w = new SlidingWindow({ maxKeys:2 });
  for(let n=0;n<50;n++) w.hit(String(n),String(n));
  assert.equal(w.entries.size,2);
});
test('Nível usa XP total sem perder excedentes', () => {
  assert.equal(levelForXp(-1),0); assert.equal(levelForXp(99),0); assert.equal(levelForXp(100),1); assert.equal(levelForXp(450),2); assert.equal(levelForXp(900),3);
});
test('HTML de transcrição e menções não viram conteúdo ativo', () => {
  const sample = '<script>alert("x")</script><img src=x onerror=alert(1)>';
  assert.ok(!escapeHtml(sample).includes('<'));
  assert.ok(escapeHtml(sample).includes('&lt;script&gt;'));
  assert.equal(inertText('@everyone @here').includes('@everyone'),false);
});
