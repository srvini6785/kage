import 'dotenv/config';
import { connect, Ticket } from './db.js';
import {createAIAdapter} from '../backend/ai-provider.js';
import {createScheduleRunner} from '../backend/schedules.js';
import {startOperationWorker} from '../backend/operations.js';
import {createAuditFlusher} from '../backend/config-outbox.js';
import { createBot } from './bot.js';
import { createWeb } from './web.js';
const env = process.env;
const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'MONGO_URI', 'SESSION_SECRET', 'PUBLIC_ORIGIN'];
for (const key of required) if (!env[key]) throw new Error('Configure a variável obrigatória ' + key + ' no ambiente. Para explorar sem credenciais: npm run demo.');
if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET precisa ter pelo menos 32 caracteres aleatórios.');
if (env.SESSION_ENCRYPTION_KEY && env.SESSION_ENCRYPTION_KEY.length < 32) throw new Error('SESSION_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres aleatórios.');
if (env.NODE_ENV === 'production' && !env.PUBLIC_ORIGIN.startsWith('https://')) throw new Error('PUBLIC_ORIGIN deve usar HTTPS em produção.');
try {
  await connect(env.MONGO_URI);
  const bot = createBot({ token: env.DISCORD_TOKEN, messageContent: env.ENABLE_MESSAGE_CONTENT === 'true',guildMembers:env.ENABLE_GUILD_MEMBERS==='true',reactions:env.ENABLE_REACTIONS==='true',nativeEvents:env.ENABLE_NATIVE_AUTOMOD_EVENTS==='true',assessAI:createAIAdapter(env),messageEvents:env.ENABLE_MESSAGE_EVENTS==='true',logMaskKey:env.SESSION_SECRET });
  await bot.login();
  const worker=startOperationWorker(bot.client);
  const scheduleTick=createScheduleRunner(bot.client),flushAudit=createAuditFlusher();const scheduleTimer=setInterval(()=>{scheduleTick().catch(()=>console.error('Kage scheduler: DATABASE_UNAVAILABLE'));flushAudit().catch(()=>console.error('Kage audit: DATABASE_UNAVAILABLE'));},15000);
  const app = createWeb({ client: bot.client, env });
  const server = app.listen(Number(env.PORT || 3040), () => console.log('Painel Kage iniciado na porta ' + (env.PORT || 3040)));
  let cleaning = false;
  // Somente canais pertencentes a tickets fechados/expirados; conserva registro se falhar.
  const cleanup = setInterval(async () => {
    if (cleaning) return; cleaning = true;
    try {
      const expired = await Ticket.find({ state: 'closed', expiresAt: { $lt: new Date() } }).limit(20).lean();
      for (const ticket of expired) {
        const guild = bot.client.guilds.cache.get(ticket.guildId);
        if (!guild) continue;
        const channel = await guild.channels.fetch(ticket.channelId).catch(e => { if (e.code === 10003) return null; throw e; });
        if (channel) {
          if (!channel.topic?.includes(ticket.id)) continue;
          await channel.delete('Prazo de retenção do ticket Kage encerrado');
        }
        await Ticket.deleteOne({ id: ticket.id, state: 'closed' });
      }
    } catch { console.error('KAGE-RETENTION: limpeza pendente; registros preservados para revisão.'); }
    finally { cleaning = false; }
  }, 60000);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { clearInterval(cleanup); clearInterval(scheduleTimer); worker.stop(); bot.client.destroy(); server.close(() => process.exit(0)); });
} catch { console.error('KAGE-STARTUP: não foi possível iniciar. Confira ambiente, banco e Discord; nenhum segredo é exibido.'); process.exitCode = 1; }
