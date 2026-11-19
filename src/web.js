import {GuildAccess,SessionEpoch} from '../backend/models.js';
import {authorizeDashboard,allowedScopes,dashboardConfig} from '../backend/access.js';
import {privacyRoutes} from '../backend/privacy.js';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dashboardRoutes } from '../backend/routes.js';
import { idempotencyGuard } from '../backend/idempotency.js';
import { sessionValid, checkCsrf, seal, unseal, errorEnvelope } from '../backend/guards.js';
import { sessionCryptoSecret } from '../backend/session-secret.js';
import { UserPreference } from '../backend/models.js';
import { z } from 'zod';
import { parse } from '../bot-shared/schemas.js';
import { fileURLToPath } from 'node:url';
import { Config, Audit, Ticket, Profile, Operation, databaseReady } from './db.js';
import { context, updateSettings, setupPayload, makePlan, executePlan, transcript, ticketAllowed, levelForXp } from './services.js';
import { canManageBits, KageError, requireThat, redactSecrets } from './core/policy.js';

const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const defaultInvitePermissions = '1099780156598';
async function discordFetch(path, token) {
  let result;
  try { result = await fetch('https://discord.com/api/v10' + path, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000) }); }
  catch { throw new KageError('KAGE-DISCORD', 'O Discord não respondeu. Tente novamente em instantes.', 503); }
  requireThat(result.ok, result.status === 429 ? 'KAGE-RATE-LIMIT' : 'KAGE-DISCORD', result.status === 429 ? 'Discord limitou as consultas. Aguarde antes de tentar novamente.' : 'Sessão ou consulta ao Discord indisponível.', result.status === 401 ? 401 : 503);
  try { return await result.json(); } catch { throw new KageError('KAGE-DISCORD', 'Resposta inesperada do Discord. Tente novamente.', 503); }
}
export function createWeb({ client, env, store, resolveContext = context, receipts, sessionEpochs=SessionEpoch }) {
  const app = express();
  const epochOf = async userId => { try { return (await sessionEpochs.findOne({userId}).lean())?.epoch||0; } catch { throw new KageError('KAGE-DATABASE','Banco de dados indisponível. Tente novamente em instantes.',503); } };
  const persistSession = fn => new Promise((resolve, reject) => fn(e => e ? reject(new KageError('KAGE-DATABASE','Sessão indisponível no momento. Tente novamente.',503)) : resolve()));
  app.disable('x-powered-by');
  app.use((req,res,next)=>{req.requestId=randomUUID();res.set('X-Request-ID',req.requestId);res.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');if(req.path.startsWith('/api')||req.path.startsWith('/auth'))res.set('Cache-Control','no-store');next();});
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"] } } }));
  const jsonBody=express.json({limit:'128kb'}),templateBody=express.json({limit:'1mb'}),assetBody=express.json({limit:'4mb'}),backupBody=express.json({limit:'2mb'});
  app.use((req,res,next)=>(/^\/api\/guilds\/\d{17,20}\/templates\/import$/.test(req.path)?templateBody:/^\/api\/guilds\/\d{17,20}\/backup\/import$/.test(req.path)?backupBody:/^\/api\/guilds\/\d{17,20}\/assets$/.test(req.path)?assetBody:jsonBody)(req,res,next));
  app.use(session({ name: 'kage.sid', secret: env.SESSION_SECRET, resave: false, saveUninitialized: false, store: store || MongoStore.create({ mongoUrl: env.MONGO_URI, ttl: 3600, crypto: { secret: sessionCryptoSecret(env.SESSION_ENCRYPTION_KEY || env.SESSION_SECRET) } }), cookie: { httpOnly: true, sameSite: env.EMBEDDED_PREVIEW === 'true' ? 'none' : 'lax', secure: env.NODE_ENV === 'production' || env.EMBEDDED_PREVIEW === 'true', maxAge: 3600000 } }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/auth', rateLimit({ windowMs: 60000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/health',(req,res)=>res.json({status:'alive',product:'Kage',version:'0.6.5'}));
  app.get('/ready',(req,res)=>{const database=databaseReady(),bot=client.isReady();res.status(database&&bot?200:503).json({state:database&&bot?'ready':'degraded',product:'Kage',version:'0.6.5',checks:{database,bot}});});
  const legalNames=['termos-de-uso','politica-de-privacidade','politica-de-cookies','acessibilidade','seguranca'];
  app.get('/legal/:slug',async(req,res,next)=>{try{if(!legalNames.includes(req.params.slug))return res.sendStatus(404);res.type('text/plain').send(await readFile(fileURLToPath(new URL('../legal/'+req.params.slug+'.md',import.meta.url)),'utf8'));}catch(e){next(e);}});
  app.get('/invite',(req,res)=>{if(!/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID||''))return res.status(409).json({code:'GUILD_NOT_READY',message:'Convite não configurado.'});const permissions=/^\d{1,20}$/.test(env.INVITE_PERMISSIONS||'')?env.INVITE_PERMISSIONS:defaultInvitePermissions,url=new URL('https://discord.com/oauth2/authorize');url.search=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,scope:'bot applications.commands',permissions});res.redirect(url.toString());});
  app.get('/auth/login', (req, res) => {
    req.session.oauthState = randomBytes(32).toString('hex'); req.session.oauthAt = Date.now();
    const url = new URL('https://discord.com/oauth2/authorize');
    for (const [k, v] of Object.entries({ client_id: env.DISCORD_CLIENT_ID, redirect_uri: env.DISCORD_REDIRECT_URI, response_type: 'code', scope: 'identify guilds', state: req.session.oauthState })) url.searchParams.set(k, v);
    req.session.save(e => { if(e) return res.status(503).send('Sessão indisponível.'); res.redirect(url.toString()); });
  });
  app.get('/auth/callback', async (req, res, next) => {
    try {
      requireThat(!req.query.error && (!req.query.iss || req.query.iss === 'https://discord.com'),'KAGE-OAUTH','Autorização recusada ou emissor inválido.',401);
      requireThat(sameSecret(req.query.state, req.session.oauthState) && Date.now() - req.session.oauthAt < 300000 && typeof req.query.code === 'string' && /^[A-Za-z0-9._~-]{1,512}$/.test(req.query.code), 'KAGE-OAUTH-STATE', 'Autorização expirada ou inválida. Entre novamente.', 401);
      delete req.session.oauthState; delete req.session.oauthAt;
      await persistSession(cb => req.session.save(cb));
      let r;
      try { r = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code: req.query.code, redirect_uri: env.DISCORD_REDIRECT_URI }), signal: AbortSignal.timeout(10000) }); }
      catch { throw new KageError('KAGE-OAUTH', 'O Discord não respondeu. Tente novamente em instantes.', 503); }
      requireThat(r.ok, 'KAGE-OAUTH', 'Não foi possível concluir a autorização.', 401);
      let token;
      try { token = await r.json(); } catch { throw new KageError('KAGE-OAUTH', 'Resposta inesperada do Discord. Tente novamente.', 502); }
      requireThat(typeof token.access_token === 'string' && token.access_token.length > 0 && token.access_token.length <= 512, 'KAGE-OAUTH', 'Não foi possível concluir a autorização.', 401);
      const accessToken = token.access_token, tokenTtl = Number(token.expires_in);
      const user = await discordFetch('/users/@me', accessToken);
      await persistSession(cb => req.session.regenerate(cb));
      req.session.userEpoch=await epochOf(user.id);
      req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
      req.session.accessTokenEncrypted=seal(accessToken,env.SESSION_ENCRYPTION_KEY||env.SESSION_SECRET);
      if(req.get('X-Kage-Background')!=='1')req.session.lastSeenAt=Date.now();
      req.session.csrf = randomBytes(32).toString('hex');
      req.session.expiresAt = Date.now() + Math.min(Number.isFinite(tokenTtl) && tokenTtl > 0 ? tokenTtl * 1000 : 3600000, 3600000);
      await persistSession(cb => req.session.save(cb));
      res.redirect('/');
    } catch (e) {
      if (e instanceof KageError) {
        console.error('Kage OAuth:', e.code, req.requestId, redactSecrets(String(e.message||'')).slice(0,160));
        return res.redirect('/?falha=' + encodeURIComponent(e.code));
      }
      next(e);
    }
  });
  app.get('/api/bootstrap', async (req, res, next) => {
    try { const epoch=sessionValid(req.session)?await epochOf(req.session.user.id):0;if((req.session.userEpoch||0)!==epoch)return res.json({mode:'live',user:null,discordReady:client.isReady()});
    res.set('Cache-Control', 'no-store');
    res.json({ mode: 'live', user: sessionValid(req.session) ? req.session.user : null, csrf: sessionValid(req.session) ? req.session.csrf : undefined, discordReady: client.isReady(), messageContent: env.ENABLE_MESSAGE_CONTENT === 'true' });
    } catch(e){next(e);}
  });
  app.get('/runtime.json', (req, res) => res.set('Cache-Control', 'no-store').json({ mode: 'live' }));
  app.use('/api', async (req, res, next) => {
    if(!sessionValid(req.session))return res.status(401).json(errorEnvelope(Object.assign(new Error('Entre com Discord para continuar.'),{code:'AUTH_REQUIRED'}),req.requestId));
    try{if((req.session.userEpoch||0)!==await epochOf(req.session.user.id))return res.status(401).json(errorEnvelope({code:'AUTH_REQUIRED',message:'Sessão revogada. Entre novamente.'},req.requestId));}catch(e){return next(e);}
    if(req.get('X-Kage-Background')!=='1')req.session.lastSeenAt=Date.now();
    res.set('Cache-Control', 'no-store');
    try{if(!['GET','HEAD'].includes(req.method))checkCsrf(req.get('Origin'),env.PUBLIC_ORIGIN,req.get('X-CSRF-Token'),req.session.csrf);}catch(e){return next(e);}
    next();
  });
  app.use('/api',rateLimit({windowMs:60000,limit:90,keyGenerator:req=>req.session.user.id,standardHeaders:'draft-8',legacyHeaders:false}));
  app.post('/api/logout',(req,res,next)=>req.session.destroy(e=>{if(e)return next(e);res.clearCookie('kage.sid',{path:'/'});res.json({ok:true});}));
  app.get('/api/me',async(req,res,next)=>{try{res.json({user:req.session.user,preferences:await UserPreference.findOne({userId:req.session.user.id}).select('-_id -__v').lean()});}catch(e){next(e);}});
  app.get('/api/guilds', async (req, res, next) => {
    try {
      let accessToken;
      try { accessToken = unseal(req.session.accessTokenEncrypted,env.SESSION_ENCRYPTION_KEY||env.SESSION_SECRET); }
      catch { throw new KageError('AUTH_REQUIRED','Sessão inválida. Entre novamente.',401); }
      const guilds = await discordFetch('/users/@me/guilds', accessToken);
      const delegated=await GuildAccess.find({guildId:{$in:guilds.filter(g=>client.guilds.cache.has(g.id)).map(g=>g.id)}}).lean(),result=[];
      for(const g of guilds){if(!client.guilds.cache.has(g.id))continue;let scopes;if(g.owner||canManageBits(g.permissions))scopes=['view','settings','security','moderation','messages','structure','roles','backups','schedules','audit'];else{const policy=delegated.find(p=>p.guildId===g.id);if(!policy)continue;try{const ctx=await resolveContext(client,g.id,req.session.user.id,{manager:false});scopes=allowedScopes(ctx,policy);}catch{continue;}}if(scopes.length)result.push({id:g.id,name:g.name,icon:g.icon,memberCount:client.guilds.cache.get(g.id).memberCount,scopes});}res.json(result);
    } catch(e) { next(e); }
  });
  app.use('/api/guilds/:guildId', async (req, res, next) => {
    try {
      requireThat(/^\d{17,20}$/.test(req.params.guildId), 'KAGE-SCOPE', 'Servidor indisponível.');
      req.kage=await resolveContext(client,req.params.guildId,req.session.user.id,{manager:false});
      req.kage.dashboardScopes=await authorizeDashboard(req.kage,req.path);req.kage.dashboardPath=req.path;
      next();
    } catch(e) {await Audit.create({guildId:'denied',actorId:req.session.user.id,action:'authorization.denied',result:'failed',correlationId:req.requestId,expiresAt:new Date(Date.now()+86400000)}).catch(()=>{});next(e);}
  });
  app.use('/api',idempotencyGuard(receipts));
  app.use('/api/guilds/:guildId/assets',rateLimit({windowMs:60000,limit:5,skip:req=>req.method!=='POST',keyGenerator:req=>req.session.user.id,standardHeaders:'draft-8',legacyHeaders:false}));
  app.use('/api/me',privacyRoutes({secret:env.SESSION_SECRET,epochs:sessionEpochs}));
  app.put('/api/me',async(req,res,next)=>{try{const p=parse(z.object({theme:z.enum(['light','dark']),notifications:z.boolean().optional(),language:z.literal('pt-BR'),timezone:z.string().max(80).refine(s=>{try{new Intl.DateTimeFormat('pt-BR',{timeZone:s});return true;}catch{return false;}})}).strict(),req.body);res.json(await UserPreference.findOneAndUpdate({userId:req.session.user.id},{$set:p},{upsert:true,new:true}).select('-_id -__v').lean());}catch(e){next(e);}});
  app.use('/api/guilds/:guildId',dashboardRoutes({client}));
  app.get('/api/guilds/:guildId/settings',(req,res)=>{const {auditOutbox,...config}=req.kage.config;res.json(config);});
  app.get('/api/guilds/:guildId/state', async (req, res, next) => {
    try {
      const ctx = req.kage, guildId = ctx.guild.id;
      const allTickets = await Ticket.find({ guildId }).sort({ createdAt: -1 }).limit(200).lean();
      const [logs, profiles, channels, roles] = await Promise.all([Audit.find({ guildId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(60).lean(), Profile.find({ guildId }).sort({ xp: -1 }).limit(20).lean(), ctx.guild.channels.fetch(), ctx.guild.roles.fetch()]);
      res.json({ config:dashboardConfig(ctx), guild: { id: guildId, name: ctx.guild.name, memberCount: ctx.guild.memberCount,features:ctx.guild.features }, scopes:ctx.dashboardScopes,logs: (ctx.dashboardScopes?.includes('audit')?logs:[]).map(l => ({ id: l.correlationId, action: l.action, actorId: l.actorId, targetId: l.targetId, result: l.result, createdAt: l.createdAt })), tickets: allTickets.filter(t => ticketAllowed(ctx, t)), profiles: profiles.map(p => ({ userId: p.userId, xp: p.xp, wallet: p.wallet, level: levelForXp(p.xp) })), channels: [...channels.values()].filter(c=>c&&ctx.actor.permissionsIn(c).has('ViewChannel')&&ctx.me.permissionsIn(c).has('ViewChannel')).map(c => ({ id: c.id, name: c.name, type: c.type })), roles: [...roles.values()].filter(r => !r.managed && r.id !== guildId).map(r => ({ id: r.id, name: r.name, position: r.position })), botPosition: ctx.me.roles.highest.position, discordReady: client.isReady() });
    } catch(e) { next(e); }
  });
  app.put(['/api/guilds/:guildId/config','/api/guilds/:guildId/settings','/api/guilds/:guildId/security'], async (req, res, next) => {
    try {
      if (env.ENABLE_MESSAGE_CONTENT !== 'true') requireThat(['automod', 'levels'].every(m => req.body.settings?.modules?.[m] === 'disabled'), 'KAGE-INTENT', 'AutoMod/XP exigem ENABLE_MESSAGE_CONTENT e a intent correspondente no portal.', 409);
      res.json(await updateSettings(req.kage, req.body));
    } catch(e) { next(e); }
  });
  app.post('/api/guilds/:guildId/plans', async (req, res, next) => {
    try {
      requireThat(req.body.kind === 'setup' || req.body.kind === 'embed', 'KAGE-PLAN', 'Tipo de plano indisponível.', 400);
      let payload;
      if(req.body.kind === 'setup') payload = setupPayload(req.body.template);
      else {
        const p = req.body.payload;
        requireThat(p && typeof p.title === 'string' && p.title.length > 0 && p.title.length <= 200 && typeof p.description === 'string' && p.description.length > 0 && p.description.length <= 1800 && /^\d{17,20}$/.test(p.channelId), 'KAGE-EMBED', 'Revise título, descrição e canal.', 400);
        payload = { title: p.title, description: p.description, channelId: p.channelId };
      }
      res.json(await makePlan(req.kage, req.body.kind, payload));
    } catch(e) { next(e); }
  });
  app.post('/api/guilds/:guildId/plans/:id/confirm', async (req, res, next) => { try { res.json(await executePlan(client, req.kage.guild.id, req.kage.actor.id, req.params.id)); } catch(e) { next(e); } });
  app.get('/api/guilds/:guildId/tickets/:id/transcript', async (req, res, next) => {
    try { const html = await transcript(req.kage, req.params.id); res.set('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'").attachment('kage-transcript.html').type('html').send(html); } catch(e) { next(e); }
  });
  app.use('/api',(req,res)=>res.status(404).json(errorEnvelope(new KageError('KAGE-NOT-FOUND','Rota indisponível.',404),req.requestId)));
  app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url)), { maxAge: 0 }));
  app.use((err, req, res, next) => {
    const bodyError=['entity.too.large','entity.parse.failed'].includes(err.type);
    if(!bodyError&&!(err instanceof KageError)&&/discord/i.test(err?.name||''))err=new KageError('KAGE-DISCORD','O Discord não respondeu como esperado. Tente novamente.',503);
    const known=bodyError||err instanceof KageError || Number.isInteger(err.status)&&typeof err.code==='string';
    console.error('Kage HTTP:', bodyError?'SCHEMA_INVALID':known ? err.code : 'KAGE-DEPENDENCY', req.requestId, err.name||'Error', redactSecrets(String(err.message||'')).slice(0,160));
    if (res.headersSent) return next(err);
    res.status(known?err.status:503).json(errorEnvelope(err,req.requestId));
  });
  return app;
}
