import test from 'node:test';
import assert from 'node:assert/strict';
import {promisify} from 'node:util';
import MongoStore from 'connect-mongo';
import {createWeb} from '../src/web.js';
import {GuildAccess, UserPreference} from '../backend/models.js';

const options = {concurrency: false, timeout: 30000};
const httpFetch = globalThis.fetch;
const cookieName = '__Host-kage.sid';
const fixture = {
  origin: 'https://kage.fixture.test',
  secret: 'fixture-session-secret-only-not-a-real-credential-Aa1!',
  encryptionKey: 'fixture-encryption-key-only-not-a-real-credential-Bb2!',
  clientId: '123456789012345678',
  clientSecret: 'fixture-discord-client-secret-only-Cc3!',
  code: 'fixture-authorization-code',
  token: 'fixture-discord-access-token-only',
  user: {id: '223456789012345678', username: 'fixture-roundtrip-user', avatar: null},
  guild: {id: '323456789012345678', name: 'Fixture guild', icon: null, owner: true, permissions: '32'},
  otherGuild: {id: '423456789012345678', name: 'Fixture absent guild', icon: null, owner: true, permissions: '32'},
  preferences: {theme: 'dark', language: 'pt-BR', timezone: 'America/Sao_Paulo', notifications: false}
};

function assertCookie(response, cleared = false) {
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  const header = cookies[0];
  assert.ok(header.startsWith(cookieName + '='), 'Cookie de produção usa o prefixo __Host');
  assert.ok(/;\s*Secure(?:;|$)/i.test(header), 'Cookie exige HTTPS');
  assert.ok(/;\s*HttpOnly(?:;|$)/i.test(header), 'Cookie não fica disponível ao JavaScript');
  assert.ok(/;\s*Path=\/(?:;|$)/i.test(header), 'Cookie tem caminho raiz');
  assert.ok(/;\s*SameSite=Lax(?:;|$)/i.test(header), 'Cookie usa SameSite=Lax');
  assert.ok(!/;\s*Domain=/i.test(header), 'Cookie __Host não define Domain');
  const pair = header.split(';')[0];
  assert.equal(pair === cookieName + '=', cleared);
  const expires = /;\s*Expires=([^;]+)/i.exec(header);
  assert.ok(expires, 'Cookie informa expiração');
  assert.equal(Date.parse(expires[1]) <= Date.now(), cleared);
}

function assertFailureRedirect(response, code, home = false) {
  assert.ok([302, 303].includes(response.status), 'Falha OAuth redireciona sem seguir o Discord');
  const location = new URL(response.headers.get('location'), fixture.origin);
  assert.equal(location.origin, fixture.origin);
  assert.equal(location.pathname, '/');
  assert.equal(location.searchParams.get('falha'), code);
  assert.deepEqual([...location.searchParams.keys()], ['falha']);
  if (home) assert.equal(location.hash, '#home');
  return location;
}

function assertApiError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.body.code, code);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.requestId, response.headers.get('x-request-id'));
  assert.equal(response.body.retryable, false);
}

async function setup(t) {
  const documents = new Map();
  const faults = {read: false, write: false, epoch: false, token: null, epochValue: 3};
  const calls = {read: 0, write: 0, touch: 0, index: 0, token: 0, identity: 0, guilds: 0, revoke: 0, epoch: 0, preferences: 0, access: 0, external: 0, invalidFetch: 0};
  const sensitive = [fixture.secret, fixture.encryptionKey, fixture.clientSecret, fixture.code, fixture.token];
  const logs = [];
  let store, server, cookie = '';
  const collection = {
    async createIndex(keys, indexOptions) {
      calls.index++;
      assert.deepEqual(keys, {expires: 1});
      assert.equal(indexOptions.expireAfterSeconds, 0);
      return 'expires_1';
    },
    async findOne(query) {
      calls.read++;
      if (faults.read) throw new Error('Fixture: session database read unavailable');
      const document = documents.get(query._id);
      if (!document) return null;
      const expiresAfter = query.$or?.find(clause => clause.expires?.$gt)?.expires.$gt;
      if (document.expires && expiresAfter && document.expires <= expiresAfter) return null;
      return structuredClone(document);
    },
    async updateOne(query, update, writeOptions = {}) {
      calls.write++;
      if (faults.write) throw new Error('Fixture: session database write unavailable');
      const previous = documents.get(query._id);
      if (!previous && !writeOptions.upsert) return {matchedCount: 0, modifiedCount: 0, upsertedCount: 0};
      if (!Object.hasOwn(update.$set, 'session')) calls.touch++;
      documents.set(query._id, structuredClone({...previous, ...update.$set, _id: query._id}));
      return {matchedCount: previous ? 1 : 0, modifiedCount: previous ? 1 : 0, upsertedCount: previous ? 0 : 1};
    },
    async deleteOne(query) {
      return {deletedCount: documents.delete(query._id) ? 1 : 0};
    }
  };
  const fake = {
    db() {
      return {collection(name) { assert.equal(name, 'sessions'); return collection; }};
    },
    async close() {}
  };
  const original = MongoStore.create.bind(MongoStore);
  const factory = t.mock.method(MongoStore, 'create', mongoOptions => {
    store = original({...mongoOptions, mongoUrl: undefined, client: fake});
    return store;
  });
  t.mock.method(console, 'error', (...args) => logs.push(args.map(String).join(' ')));
  t.after(async () => {
    try {
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    } finally {
      if (store) await store.close();
    }
    assert.equal(calls.external, 0, 'Nenhuma tentativa de rede externa não simulada');
    assert.equal(calls.invalidFetch, 0, 'Asserções OAuth não podem ser ocultadas pelos catches da aplicação');
    for (const value of sensitive) {
      assert.ok(!logs.some(line => line.includes(value)), 'Logs não expõem tokens, cookies, códigos ou state');
    }
  });
  const discord = async (input, init = {}) => {
    const url = new URL(input instanceof globalThis.Request ? input.url : input);
    if (url.origin !== 'https://discord.com' || url.search) {
      calls.external++;
      throw new Error('Fixture: unexpected external request blocked');
    }
    const headers = new globalThis.Headers(init.headers);
    if (url.pathname === '/api/v10/oauth2/token' || url.pathname === '/api/v10/oauth2/token/revoke') {
      assert.equal(init.method, 'POST');
      assert.equal(headers.get('content-type'), 'application/x-www-form-urlencoded');
      assert.ok(init.body instanceof URLSearchParams, 'OAuth envia formulário');
      assert.equal(init.body.get('client_id'), fixture.clientId);
      assert.ok(init.body.get('client_secret') === fixture.clientSecret, 'OAuth usa somente o segredo fixture');
      if (url.pathname.endsWith('/revoke')) {
        calls.revoke++;
        assert.ok(init.body.get('token') === fixture.token, 'Logout revoga o token decifrado correto');
        assert.equal(init.body.get('token_type_hint'), 'access_token');
        return new Response(null, {status: 200});
      }
      calls.token++;
      assert.equal(init.body.get('grant_type'), 'authorization_code');
      assert.equal(init.body.get('redirect_uri'), fixture.origin + '/auth/callback');
      assert.ok(init.body.get('code') === fixture.code, 'Troca usa somente o código fixture');
      if (faults.token === 'offline') throw new TypeError('Fixture: Discord unavailable');
      if (faults.token === 'rejected') return Response.json({error: 'invalid_grant'}, {status: 401});
      return Response.json({access_token: fixture.token, token_type: 'Bearer', expires_in: 3600});
    }
    if (url.pathname === '/api/v10/users/@me' || url.pathname === '/api/v10/users/@me/guilds') {
      assert.ok(headers.get('authorization') === 'Bearer ' + fixture.token, 'Discord recebe somente o bearer fixture');
      assert.equal(init.method || 'GET', 'GET');
      if (url.pathname.endsWith('/guilds')) {
        calls.guilds++;
        return Response.json([fixture.guild, fixture.otherGuild]);
      }
      calls.identity++;
      return Response.json(fixture.user);
    }
    calls.external++;
    throw new Error('Fixture: unexpected Discord endpoint blocked');
  };
  t.mock.method(globalThis, 'fetch', async (...args) => {
    try { return await discord(...args); }
    catch (error) {
      if (error?.code === 'ERR_ASSERTION') calls.invalidFetch++;
      throw error;
    }
  });
  t.mock.method(UserPreference, 'findOne', query => {
    calls.preferences++;
    assert.deepEqual(query, {userId: fixture.user.id});
    return {
      select(projection) { assert.equal(projection, '-_id -__v'); return this; },
      async lean() { return structuredClone(fixture.preferences); }
    };
  });
  t.mock.method(GuildAccess, 'find', query => {
    calls.access++;
    assert.deepEqual(query, {guildId: {$in: [fixture.guild.id]}});
    return {async lean() { return []; }};
  });
  const app = createWeb({
    env: {
      NODE_ENV: 'production', PUBLIC_ORIGIN: fixture.origin,
      SESSION_SECRET: fixture.secret, SESSION_ENCRYPTION_KEY: fixture.encryptionKey,
      MONGO_URI: 'mongodb://fixture.invalid/session-roundtrip',
      DISCORD_CLIENT_ID: fixture.clientId, DISCORD_CLIENT_SECRET: fixture.clientSecret,
      DISCORD_REDIRECT_URI: fixture.origin + '/auth/callback'
    },
    client: {isReady: () => true, guilds: {cache: new Map([[fixture.guild.id, {memberCount: 7}]])}},
    sessionEpochs: {
      findOne(query) {
        calls.epoch++;
        assert.deepEqual(query, {userId: fixture.user.id});
        return {async lean() {
          if (faults.epoch) throw new Error('Fixture: epoch database unavailable');
          return {epoch: faults.epochValue};
        }};
      }
    },
    receipts: {},
    resolveContext: async () => { throw new Error('Fixture: unexpected guild context lookup'); }
  });
  assert.equal(factory.mock.callCount(), 1);
  assert.ok(store instanceof MongoStore, 'Store é a implementação real do connect-mongo');
  assert.equal(typeof store.crypto?.set, 'function');
  assert.equal(typeof store.crypto?.get, 'function');
  assert.ok(await store.collectionP === collection, 'Somente a coleção MongoDB foi substituída');
  assert.equal(calls.index, 1);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, init = {}) {
    const url = new URL(path, base);
    assert.equal(url.origin, base, 'Requisições HTTP ficam no servidor local');
    const response = await httpFetch(url, {
      ...init,
      headers: {'X-Forwarded-Proto': 'https', ...(cookie ? {Cookie: cookie} : {}), ...init.headers},
      redirect: 'manual', signal: AbortSignal.timeout(5000)
    });
    const text = await response.text();
    for (const header of response.headers.getSetCookie()) {
      if (!header.startsWith(cookieName + '=')) continue;
      const pair = header.split(';')[0];
      cookie = pair === cookieName + '=' ? '' : pair;
      if (cookie) sensitive.push(cookie, cookie.slice(cookieName.length + 1));
    }
    const body = response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text;
    for (const value of [fixture.secret, fixture.encryptionKey, fixture.clientSecret, fixture.token]) {
      assert.ok(!text.includes(value), 'Resposta HTTP não expõe segredos');
    }
    return {status: response.status, headers: response.headers, body};
  }
  return {documents, faults, calls, store, request, sensitive, get cookie() { return cookie; }};
}

async function login(h) {
  const response = await h.request('/auth/login');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assertCookie(response);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://discord.com');
  assert.equal(location.pathname, '/oauth2/authorize');
  assert.equal(location.searchParams.get('scope'), 'identify guilds');
  assert.equal(location.searchParams.get('redirect_uri'), fixture.origin + '/auth/callback');
  const state = location.searchParams.get('state');
  assert.ok(typeof state === 'string' && /^[a-f0-9]{64}$/.test(state), 'Login gera state imprevisível');
  h.sensitive.push(state);
  assert.equal(h.calls.token, 0);
  assert.equal(h.documents.size, 1);
  return state;
}

function callback(h, state) {
  return h.request('/auth/callback?' + new URLSearchParams({state, code: fixture.code}));
}

async function authenticate(h) {
  const state = await login(h);
  const previousCookie = h.cookie;
  const previousId = [...h.documents.keys()][0];
  const response = await callback(h, state);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/#overview');
  assertCookie(response);
  assert.ok(h.cookie && h.cookie !== previousCookie, 'OAuth regenera o cookie contra fixação de sessão');
  assert.equal(h.documents.has(previousId), false);
  assert.equal(h.documents.size, 1);
  assert.equal(h.calls.token, 1);
  assert.equal(h.calls.identity, 1);
  return state;
}

async function bootstrap(h, expectedUser) {
  const response = await h.request('/api/bootstrap');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(response.headers.get('x-request-id'));
  assert.deepEqual(response.body.user, expectedUser);
  assert.equal(response.body.mode, 'live');
  assert.equal(response.body.discordReady, true);
  if (expectedUser) {
    assert.ok(typeof response.body.csrf === 'string' && response.body.csrf.length > 0, 'Bootstrap autenticado fornece CSRF');
    h.sensitive.push(response.body.csrf);
  } else {
    assert.equal(Object.hasOwn(response.body, 'csrf'), false);
  }
  return response.body;
}

async function corruptLegacy(h) {
  const document = [...h.documents.values()][0];
  const plaintext = await h.store.cryptoGet(h.store.options.crypto.secret, document.session);
  assert.equal(typeof plaintext, 'string');
  const legacy = JSON.parse(plaintext);
  document.session = await promisify(h.store.crypto.set).call(h.store.crypto, h.store.options.crypto.secret, legacy);
  const decoded = await h.store.cryptoGet(h.store.options.crypto.secret, document.session);
  assert.equal(typeof decoded, 'object');
  assert.throws(() => JSON.parse(decoded), SyntaxError);
}

test('Sessão HTTP: MongoStore e kruptein reais preservam login, bootstrap, me, guilds e logout', options, async t => {
  const h = await setup(t);
  const state = await authenticate(h);
  const authenticatedCookie = h.cookie;
  const document = [...h.documents.values()][0];
  assert.equal(typeof document.session, 'string');
  assert.ok(document.expires instanceof Date && document.expires > new Date());
  const stored = JSON.stringify(document);
  for (const value of [...h.sensitive, fixture.user.id, fixture.user.username, '"user"', '"oauthState"', '"accessTokenEncrypted"']) {
    assert.ok(!stored.includes(value), 'Coleção armazena sessão cifrada, sem usuário ou segredos em claro');
  }
  const plaintext = await h.store.cryptoGet(h.store.options.crypto.secret, document.session);
  assert.equal(typeof plaintext, 'string');
  const session = JSON.parse(plaintext);
  assert.deepEqual(session.user, fixture.user);
  assert.equal(typeof session.accessTokenEncrypted, 'string');
  assert.ok(!plaintext.includes(fixture.token), 'Token continua cifrado dentro da sessão');
  assert.equal(Object.hasOwn(session, 'oauthState'), false);
  assert.equal(Object.hasOwn(session, 'oauthAt'), false);
  let csrf;
  for (let i = 0; i < 3; i++) {
    const body = await bootstrap(h, fixture.user);
    if (csrf) assert.ok(body.csrf === csrf, 'CSRF sobrevive a leituras repetidas');
    csrf = body.csrf;
  }
  const me = await h.request('/api/me');
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, {user: fixture.user, preferences: fixture.preferences});
  const guilds = await h.request('/api/guilds');
  assert.equal(guilds.status, 200);
  assert.equal(guilds.body.length, 1);
  assert.equal(guilds.body[0].id, fixture.guild.id);
  assert.equal(guilds.body[0].memberCount, 7);
  assert.ok(guilds.body[0].scopes.includes('view'));
  assert.equal(h.calls.preferences, 1);
  assert.equal(h.calls.access, 1);
  assert.equal(h.calls.guilds, 1);
  assert.ok(h.calls.touch > 0, 'Leituras passam pelo touch real do MongoStore');
  assert.equal(h.calls.revoke, 0);
  assertFailureRedirect(await callback(h, state), 'KAGE-OAUTH-STATE');
  assert.equal(h.calls.token, 1, 'State consumido não repete a troca de token');
  const logout = await h.request('/api/logout', {
    method: 'POST', headers: {Origin: fixture.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf}, body: '{}'
  });
  assert.equal(logout.status, 200);
  assert.deepEqual(logout.body, {ok: true});
  assertCookie(logout, true);
  assert.equal(h.calls.revoke, 1);
  assert.equal(h.documents.size, 0);
  assert.ok(!h.cookie, 'Logout remove o cookie do navegador');
  await bootstrap(h, null);
  const replay = await h.request('/api/bootstrap', {headers: {Cookie: authenticatedCookie}});
  assert.equal(replay.status, 200);
  assert.equal(replay.body.user, null);
  assertApiError(await h.request('/api/me'), 401, 'AUTH_REQUIRED');
});

test('OAuth: state inválido não chama o endpoint de token', options, async t => {
  const h = await setup(t);
  const state = await login(h);
  const invalid = (state[0] === 'a' ? 'b' : 'a') + state.slice(1);
  h.sensitive.push(invalid);
  assertFailureRedirect(await callback(h, invalid), 'KAGE-OAUTH-STATE');
  assert.equal(h.calls.token, 0);
  assert.equal(h.calls.identity, 0);
  await bootstrap(h, null);
});

test('OAuth: callback sem sessão volta ao home sem repetir callback', options, async t => {
  const h = await setup(t);
  const location = assertFailureRedirect(await callback(h, 'fixture-missing-session-state'), 'KAGE-OAUTH-STATE', true);
  const landing = await h.request(location.pathname + location.search);
  assert.equal(landing.status, 200);
  assert.equal(landing.headers.get('location'), null);
  assert.equal(h.calls.token, 0);
  await bootstrap(h, null);
});

for (const failure of ['rejected', 'offline']) {
  test('OAuth: token endpoint ' + failure + ' falha fechado e não reutiliza state', options, async t => {
    const h = await setup(t);
    const state = await login(h);
    h.faults.token = failure;
    assertFailureRedirect(await callback(h, state), 'KAGE-OAUTH');
    assert.equal(h.calls.token, 1);
    assert.equal(h.calls.identity, 0);
    assert.equal(h.calls.epoch, 0);
    await bootstrap(h, null);
    assertFailureRedirect(await callback(h, state), 'KAGE-OAUTH-STATE');
    assert.equal(h.calls.token, 1);
    assertApiError(await h.request('/api/me'), 401, 'AUTH_REQUIRED');
  });
}

test('OAuth: falha no banco de epochs não publica sessão autenticada', options, async t => {
  const h = await setup(t);
  const state = await login(h);
  h.faults.epoch = true;
  assertFailureRedirect(await callback(h, state), 'KAGE-DATABASE');
  assert.equal(h.calls.token, 1);
  assert.equal(h.calls.identity, 1);
  assert.equal(h.calls.epoch, 1);
  h.faults.epoch = false;
  await bootstrap(h, null);
  assertApiError(await h.request('/api/me'), 401, 'AUTH_REQUIRED');
});

test('OAuth: falha ao persistir state impede troca de token', options, async t => {
  const h = await setup(t);
  const state = await login(h);
  h.faults.write = true;
  assertFailureRedirect(await callback(h, state), 'KAGE-DATABASE');
  assert.equal(h.calls.token, 0);
  assert.equal(h.calls.identity, 0);
  h.faults.write = false;
  await bootstrap(h, null);
});

test('Sessão HTTP: banco de epochs indisponível retorna 503 e recupera sem novo login', options, async t => {
  const h = await setup(t);
  await authenticate(h);
  h.faults.epoch = true;
  for (const path of ['/api/bootstrap', '/api/me']) {
    const response = await h.request(path);
    assertApiError(response, 503, 'KAGE-DATABASE');
    assert.equal(response.headers.getSetCookie().length, 0);
  }
  h.faults.epoch = false;
  await bootstrap(h, fixture.user);
  assert.equal(h.calls.token, 1);
});

test('Sessão HTTP: findOne indisponível não é confundido com sessão corrompida', options, async t => {
  const h = await setup(t);
  const state = await authenticate(h);
  h.faults.read = true;
  const response = await h.request('/api/bootstrap');
  assertApiError(response, 503, 'DATABASE_UNAVAILABLE');
  assert.equal(response.headers.getSetCookie().length, 0);
  const oauthFailure = await callback(h, state);
  assertFailureRedirect(oauthFailure, 'KAGE-DATABASE', true);
  assert.equal(oauthFailure.headers.getSetCookie().length, 0);
  h.faults.read = false;
  await bootstrap(h, fixture.user);
  assert.equal(h.calls.token, 1);
});

test('Sessão HTTP: JSON de requisição inválido não é erro de decifragem de sessão', options, async t => {
  const h = await setup(t);
  await authenticate(h);
  const {csrf} = await bootstrap(h, fixture.user);
  const response = await h.request('/api/logout', {
    method: 'POST', headers: {Origin: fixture.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf}, body: '{"broken":}'
  });
  assertApiError(response, 400, 'SCHEMA_INVALID');
  if (response.headers.getSetCookie().length) assertCookie(response);
  assert.equal(h.calls.revoke, 0);
  await bootstrap(h, fixture.user);
});

for (const target of ['callback', 'bootstrap']) {
  test('Sessão legada cifrada como objeto: ' + target + ' recupera sem loop OAuth', options, async t => {
    const h = await setup(t);
    const state = await login(h);
    await corruptLegacy(h);
    const response = target === 'callback' ? await callback(h, state) : await h.request('/api/bootstrap');
    assertCookie(response, true);
    if (target === 'callback') {
      const location = assertFailureRedirect(response, 'KAGE-OAUTH-STATE', true);
      const landing = await h.request(location.pathname + location.search);
      assert.equal(landing.status, 200);
      assert.equal(landing.headers.get('location'), null);
    } else {
      assertApiError(response, 401, 'AUTH_REQUIRED');
      assertFailureRedirect(await callback(h, state), 'KAGE-OAUTH-STATE', true);
    }
    assert.equal(h.calls.token, 0);
    assert.equal(h.calls.identity, 0);
    await bootstrap(h, null);
    await bootstrap(h, null);
  });
}
