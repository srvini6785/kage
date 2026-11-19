import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditEnvironment } from './staging-audit.js';

dotenv.config({ quiet: true });

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const args = new Set(process.argv.slice(2));
const labels = { pass: 'OK', warn: 'AVISO', fail: 'FALHA', skip: 'PULADO' };
const botPermissions = [
  ['Ver canal', 1n << 10n],
  ['Enviar mensagens', 1n << 11n],
  ['Inserir links', 1n << 14n],
  ['Ler histórico', 1n << 16n],
  ['Gerenciar canais', 1n << 4n],
  ['Gerenciar cargos', 1n << 28n],
  ['Gerenciar mensagens', 1n << 13n],
  ['Moderar membros', 1n << 40n],
  ['Gerenciar servidor', 1n << 5n]
];
const administrator = 1n << 3n;

function add(checks, id, level, message) {
  checks.push({ id, level, message });
}

function printHelp() {
  console.log([
    'Kage staging check ' + version,
    '',
    'Uso: npm run staging-check -- [opções]',
    '',
    '  --online   consulta a API do Discord e o MongoDB usando as credenciais locais',
    '  --http     consulta /health e /ready de uma instância já iniciada',
    '  --json     imprime o relatório em JSON',
    '  --help     mostra esta ajuda',
    '',
    'Nenhum token, segredo ou URI é impresso. O comando não grava no Discord nem no MongoDB.'
  ].join('\n'));
}

async function discord(path, token) {
  try {
    const response = await fetch('https://discord.com/api/v10' + path, {
      headers: { Authorization: 'Bot ' + token, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    let body = null;
    try { body = await response.json(); } catch {}
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

async function checkDiscord(env, checks) {
  if (!env.DISCORD_TOKEN) {
    add(checks, 'discord.auth', 'skip', 'Sem DISCORD_TOKEN; consulta ao Discord ignorada.');
    return;
  }
  const me = await discord('/users/@me', env.DISCORD_TOKEN);
  if (me.status !== 200) {
    add(checks, 'discord.auth', 'fail', 'O Discord não autenticou o bot (HTTP ' + (me.status || 'sem resposta') + ').');
    return;
  }
  add(checks, 'discord.auth', 'pass', 'Bot autenticado no Discord.');
  const application = await discord('/oauth2/applications/@me', env.DISCORD_TOKEN);
  if (application.status !== 200) add(checks, 'discord.application', 'warn', 'Não foi possível ler os dados do aplicativo (HTTP ' + (application.status || 'sem resposta') + ').');
  else if (Array.isArray(application.body?.redirect_uris)) {
    if (application.body.redirect_uris.includes(env.DISCORD_REDIRECT_URI)) add(checks, 'discord.redirect', 'pass', 'DISCORD_REDIRECT_URI consta no aplicativo Discord.');
    else add(checks, 'discord.redirect', 'fail', 'DISCORD_REDIRECT_URI não consta nas redirect URIs do aplicativo.');
  } else add(checks, 'discord.redirect', 'warn', 'O aplicativo não expôs redirect_uris para comparação.');
  if (!env.DISCORD_GUILD_ID) {
    add(checks, 'discord.guild', 'skip', 'Sem DISCORD_GUILD_ID; verificação do servidor ignorada.');
    return;
  }
  const guild = await discord('/guilds/' + env.DISCORD_GUILD_ID, env.DISCORD_TOKEN);
  if (guild.status !== 200) {
    add(checks, 'discord.guild', 'fail', 'O bot não acessou o servidor configurado (HTTP ' + (guild.status || 'sem resposta') + ').');
    return;
  }
  add(checks, 'discord.guild', 'pass', 'Bot presente no servidor configurado.');
  const member = await discord('/guilds/' + env.DISCORD_GUILD_ID + '/members/@me', env.DISCORD_TOKEN);
  if (member.status !== 200) {
    add(checks, 'discord.member', 'fail', 'Não foi possível ler o membro do bot no servidor (HTTP ' + member.status + ').');
    return;
  }
  const roles = new Map((guild.body?.roles || []).map(role => [role.id, role]));
  let permissions = 0n;
  try {
    permissions |= BigInt(roles.get(guild.body?.id)?.permissions || '0');
    for (const roleId of member.body?.roles || []) permissions |= BigInt(roles.get(roleId)?.permissions || '0');
  } catch {
    add(checks, 'discord.permissions', 'warn', 'Não foi possível interpretar as permissões do bot.');
    return;
  }
  if (guild.body?.owner_id === me.body?.id) permissions |= administrator;
  const missing = botPermissions.filter(([, bit]) => (permissions & bit) !== bit).map(([name]) => name);
  if (missing.length) add(checks, 'discord.permissions', 'fail', 'Permissões ausentes: ' + missing.join(', ') + '.');
  else add(checks, 'discord.permissions', 'pass', 'Permissões operacionais presentes.');
  if ((permissions & administrator) === administrator) add(checks, 'discord.administrator', 'warn', 'Administrator presente; prefira permissões específicas.');
}

async function checkMongo(env, checks) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(env.MONGO_URI || '')) {
    add(checks, 'mongo.connection', 'skip', 'MONGO_URI ausente ou inválida; conexão ignorada.');
    return;
  }
  const { default: mongoose } = await import('mongoose');
  mongoose.set('bufferCommands', false);
  try {
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const database = mongoose.connection.db;
    await database.admin().ping();
    const collections = await database.listCollections().toArray();
    if (!collections.length) add(checks, 'mongo.connection', 'warn', 'MongoDB respondeu, mas o banco está vazio; aplique a migração aditiva.');
    else add(checks, 'mongo.connection', 'pass', 'MongoDB respondeu; ' + collections.length + ' coleções visíveis.');
  } catch {
    add(checks, 'mongo.connection', 'fail', 'Não foi possível conectar ao MongoDB ou consultar o banco.');
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

async function checkHttp(env, checks) {
  const base = (env.PUBLIC_ORIGIN || 'http://127.0.0.1:' + (env.PORT || 3040)).replace(/\/+$/, '');
  let health;
  try {
    health = await fetch(base + '/health', { signal: AbortSignal.timeout(8000) });
  } catch {
    add(checks, 'http.health', 'fail', 'A instância não respondeu em /health.');
    return;
  }
  if (health.status !== 200) {
    add(checks, 'http.health', 'fail', '/health respondeu HTTP ' + health.status + '.');
    return;
  }
  const body = await health.json().catch(() => null);
  if (body?.version === version) add(checks, 'http.health', 'pass', '/health respondeu com a versão ' + version + '.');
  else add(checks, 'http.version', 'warn', '/health respondeu versão ' + (body?.version || 'ausente') + '; esperado ' + version + '.');
  try {
    const ready = await fetch(base + '/ready', { signal: AbortSignal.timeout(8000) });
    if (ready.status === 200) add(checks, 'http.ready', 'pass', '/ready confirmou banco e bot prontos.');
    else add(checks, 'http.ready', 'fail', '/ready respondeu HTTP ' + ready.status + '; banco ou bot ainda não estão prontos.');
  } catch {
    add(checks, 'http.ready', 'fail', 'A instância não respondeu em /ready.');
  }
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    printHelp();
    return;
  }
  const report = auditEnvironment(process.env);
  const envFile = fileURLToPath(new URL('../.env', import.meta.url));
  report.checks.unshift({
    id: 'environment.file',
    level: existsSync(envFile) ? 'pass' : 'warn',
    message: existsSync(envFile) ? 'Arquivo .env local encontrado.' : 'Nenhum .env local; as variáveis podem vir do sistema.'
  });
  if (args.has('--online')) {
    await checkDiscord(process.env, report.checks);
    await checkMongo(process.env, report.checks);
  }
  if (args.has('--http')) await checkHttp(process.env, report.checks);
  report.ok = !report.checks.some(check => check.level === 'fail');
  if (args.has('--json')) {
    console.log(JSON.stringify({ ...report, version, online: args.has('--online'), http: args.has('--http'), checkedAt: new Date().toISOString() }, null, 2));
  } else {
    console.log('Kage staging check ' + version + (args.has('--online') ? ' (online)' : '') + (args.has('--http') ? ' (http)' : ''));
    for (const check of report.checks) console.log(labels[check.level] + ' ' + check.id + ' · ' + check.message);
    console.log('');
    console.log(report.ok ? 'Sem bloqueios de configuração detectados.' : 'Corrija as falhas antes de solicitar aceite de staging.');
    console.log('Próximos passos: npm run migrate -- --dry-run; npm run migrate; npm run register apenas no servidor de teste; siga docs/staging-checklist.md.');
  }
  if (!report.ok) process.exitCode = 1;
}

main().catch(() => {
  console.error('O staging check falhou de forma inesperada; nenhum segredo foi exibido.');
  process.exitCode = 1;
});
