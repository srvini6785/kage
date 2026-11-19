import test from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import {createWeb} from '../src/web.js';

const baseEnv={SESSION_SECRET:'fixture-secret-with-more-than-32-characters',PUBLIC_ORIGIN:'https://kage.test',NODE_ENV:'test',DISCORD_CLIENT_ID:'123456789012345678',DISCORD_REDIRECT_URI:'https://kage.test/auth/callback'};
const make=extra=>createWeb({client:{isReady:()=>true},env:{...baseEnv,...extra},store:new session.MemoryStore(),sessionEpochs:{findOne:()=>({lean:async()=>null})},receipts:{},resolveContext:async()=>{}});
const start=async(app,t)=>{const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));return 'http://127.0.0.1:'+server.address().port;};

test('Produção usa cookie __Host com Secure, Path=/ e sem Domain',async t=>{
  const base=await start(make({NODE_ENV:'production'}),t);
  const response=await fetch(base+'/auth/login',{redirect:'manual',headers:{'X-Forwarded-Proto':'https'}});
  assert.equal(response.status,302);
  const cookie=response.headers.get('set-cookie')||'';
  assert.match(cookie,/^__Host-kage\.sid=/);
  assert.match(cookie,/Secure/);
  assert.match(cookie,/Path=\//);
  assert.ok(!/Domain=/i.test(cookie));
});

test('Corpo grande é recusado pela autenticação antes de qualquer parser',async t=>{
  const base=await start(make({}),t);
  const response=await fetch(base+'/api/guilds/123456789012345678/assets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'x'.repeat(200000)})});
  assert.equal(response.status,401);
  assert.equal((await response.json()).code,'AUTH_REQUIRED');
});

test('Health e readiness não revelam versão nem detalhes internos',async t=>{
  const base=await start(make({}),t);
  assert.deepEqual(await (await fetch(base+'/health')).json(),{status:'ok'});
  const ready=await fetch(base+'/ready');
  assert.equal(ready.status,503);
  assert.equal(await ready.text(),'Service Unavailable');
});
