const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'MONGO_URI', 'SESSION_SECRET', 'PUBLIC_ORIGIN'];
const booleans = ['ENABLE_MESSAGE_CONTENT', 'ENABLE_GUILD_MEMBERS', 'ENABLE_REACTIONS', 'ENABLE_NATIVE_AUTOMOD_EVENTS', 'ENABLE_MESSAGE_EVENTS', 'EMBEDDED_PREVIEW', 'AI_PROVIDER_APPROVED'];
const configValues = [...required, ...booleans, 'DISCORD_GUILD_ID', 'SESSION_ENCRYPTION_KEY', 'AI_PROVIDER_URL', 'AI_PROVIDER_ALLOWED_HOSTS', 'AI_PROVIDER_TOKEN', 'PORT', 'NODE_ENV'];
const placeholder = /^(?:<|\[|coloque|troque|altere|exemplo|changeme|change_me|seu[_-]|sua[_-]|todo[_-])/i;
const text = value => typeof value === 'string' ? value.trim() : '';
const present = value => text(value).length > 0;
const add = (checks, id, level, message) => checks.push({ id, level, message });
const url = value => {
  try { return new URL(value); } catch { return null; }
};
const id = value => /^\d{17,20}$/.test(value);

export function auditEnvironment(env = {}) {
  const checks = [];
  for (const key of required) if (!present(env[key])) add(checks, 'env.' + key, 'fail', 'Defina ' + key + ' no ambiente local.');
  const publicUrl = present(env.PUBLIC_ORIGIN) ? url(env.PUBLIC_ORIGIN) : null;
  if (present(env.PUBLIC_ORIGIN) && !publicUrl) add(checks, 'origin.format', 'fail', 'PUBLIC_ORIGIN precisa ser uma URL absoluta válida.');
  if (publicUrl) {
    if (publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) add(checks, 'origin.shape', 'warn', 'PUBLIC_ORIGIN deve conter apenas a origem, sem caminho, consulta ou fragmento.');
    if (env.NODE_ENV === 'production' && publicUrl.protocol !== 'https:') add(checks, 'origin.https', 'fail', 'PUBLIC_ORIGIN precisa usar HTTPS em produção.');
  }
  if (present(env.DISCORD_CLIENT_ID) && !id(env.DISCORD_CLIENT_ID)) add(checks, 'discord.clientId', 'fail', 'DISCORD_CLIENT_ID deve ter de 17 a 20 dígitos.');
  if (present(env.DISCORD_TOKEN) && text(env.DISCORD_TOKEN).length < 20) add(checks, 'discord.token', 'warn', 'DISCORD_TOKEN parece curto para um token de bot.');
  if (present(env.DISCORD_CLIENT_SECRET) && text(env.DISCORD_CLIENT_SECRET).length < 10) add(checks, 'discord.clientSecret', 'warn', 'DISCORD_CLIENT_SECRET parece curto para um segredo de aplicação.');
  if (present(env.DISCORD_GUILD_ID) && !id(env.DISCORD_GUILD_ID)) add(checks, 'discord.guildId', 'fail', 'DISCORD_GUILD_ID deve ter de 17 a 20 dígitos.');
  if (!present(env.DISCORD_GUILD_ID)) add(checks, 'discord.guildId.missing', 'warn', 'DISCORD_GUILD_ID é recomendado para staging e para o registro de comandos.');
  if (present(env.DISCORD_REDIRECT_URI)) {
    const redirect = url(env.DISCORD_REDIRECT_URI);
    if (!redirect) add(checks, 'oauth.redirect.format', 'fail', 'DISCORD_REDIRECT_URI precisa ser uma URL absoluta válida.');
    else {
      if (redirect.pathname !== '/auth/callback') add(checks, 'oauth.redirect.path', 'warn', 'O callback do Kage usa o caminho /auth/callback.');
      if (env.NODE_ENV === 'production' && redirect.protocol !== 'https:') add(checks, 'oauth.redirect.https', 'fail', 'DISCORD_REDIRECT_URI precisa usar HTTPS em produção.');
      if (publicUrl && redirect.origin !== publicUrl.origin) add(checks, 'oauth.redirect.origin', 'warn', 'A origem do callback difere de PUBLIC_ORIGIN; o login pode falhar.');
    }
  }
  if (present(env.MONGO_URI)) {
    const uri = text(env.MONGO_URI);
    if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) add(checks, 'mongo.scheme', 'fail', 'MONGO_URI precisa começar com mongodb:// ou mongodb+srv://.');
    else {
      const name = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i.exec(uri);
      if (!name || !text(name[1])) add(checks, 'mongo.database', 'warn', 'MONGO_URI não declara um nome de banco explícito.');
    }
  }
  if (present(env.SESSION_SECRET)) {
    const secret = text(env.SESSION_SECRET);
    if (secret.length < 32) add(checks, 'session.length', 'fail', 'SESSION_SECRET precisa ter pelo menos 32 caracteres.');
    else if (new Set(secret).size < 8) add(checks, 'session.variety', 'warn', 'SESSION_SECRET tem pouca variedade de caracteres.');
    if (present(env.SESSION_ENCRYPTION_KEY) && secret === text(env.SESSION_ENCRYPTION_KEY)) add(checks, 'session.reuse', 'warn', 'SESSION_ENCRYPTION_KEY deve ser diferente de SESSION_SECRET.');
  }
  if (present(env.SESSION_ENCRYPTION_KEY) && text(env.SESSION_ENCRYPTION_KEY).length < 32) add(checks, 'encryption.length', 'fail', 'SESSION_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres.');
  if (present(env.PORT) && (!/^\d+$/.test(text(env.PORT)) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) add(checks, 'port.range', 'fail', 'PORT precisa ser um número entre 1 e 65535.');
  if (present(env.NODE_ENV) && !['development', 'production', 'test'].includes(env.NODE_ENV)) add(checks, 'node.env', 'warn', 'NODE_ENV deve ser development, production ou test.');
  for (const key of booleans) if (present(env[key]) && !['true', 'false'].includes(text(env[key]))) add(checks, 'boolean.' + key, 'fail', key + ' aceita somente true ou false.');
  if (env.EMBEDDED_PREVIEW === 'true' && publicUrl && publicUrl.protocol !== 'https:') add(checks, 'preview.https', 'fail', 'EMBEDDED_PREVIEW exige PUBLIC_ORIGIN em HTTPS.');
  if (env.AI_PROVIDER_APPROVED === 'true') {
    if (!present(env.AI_PROVIDER_URL)) add(checks, 'ai.url', 'fail', 'AI_PROVIDER_URL é obrigatório quando o provedor está aprovado.');
    else {
      const provider = url(env.AI_PROVIDER_URL);
      if (!provider || provider.protocol !== 'https:') add(checks, 'ai.https', 'fail', 'AI_PROVIDER_URL precisa ser HTTPS.');
    }
    if (!present(env.AI_PROVIDER_ALLOWED_HOSTS)) add(checks, 'ai.hosts', 'fail', 'AI_PROVIDER_ALLOWED_HOSTS é obrigatório quando o provedor está aprovado.');
    if (!present(env.AI_PROVIDER_TOKEN)) add(checks, 'ai.token', 'fail', 'AI_PROVIDER_TOKEN é obrigatório quando o provedor está aprovado.');
  } else if (present(env.AI_PROVIDER_URL)) add(checks, 'ai.disabled', 'warn', 'Há URL de IA configurada, mas AI_PROVIDER_APPROVED não está como true.');
  for (const key of configValues) if (present(env[key]) && placeholder.test(text(env[key]))) add(checks, 'placeholder.' + key, 'warn', key + ' parece conter um valor de exemplo; substitua no computador local.');
  if (!checks.length) add(checks, 'config', 'pass', 'Configuração obrigatória completa.');
  return { product: 'Kage', ok: !checks.some(check => check.level === 'fail'), checks };
}

export const stagingRequirements = { required, booleans };
