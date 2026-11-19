import { randomUUID, createHash } from 'node:crypto';
import { ChannelType, PermissionFlagsBits as P, EmbedBuilder } from 'discord.js';
import { Config, Audit, Ticket, Operation, Profile, getConfig, once } from './db.js';
import { settingsSchema } from './core/settings.js';
import {commitSettings} from '../backend/config-outbox.js';
import { KageError, requireThat, assertModule, canManageGuild, createPlan, validatePlan, escapeHtml, redactSecrets, inertText, retentionDate, levelForXp } from './core/policy.js';

export async function audit(ctx, action, result, extra = {}) {
  const cfg = ctx.config || await getConfig(ctx.guild.id);
  await Audit.create({ guildId: ctx.guild.id, actorId: ctx.actor.id, action, result, correlationId: extra.correlationId || randomUUID(), configVersion: cfg.version, expiresAt: retentionDate(cfg.settings.auditRetentionDays), ...extra });
}
export async function context(client, guildId, actorId, { manager = false } = {}) {
  requireThat(client.guilds.cache.has(guildId), 'GUILD_FORBIDDEN', 'Acesso indisponível neste servidor.', 403);
  const guild = await client.guilds.fetch({guild:guildId,force:true});
  // Membros frescos ainda calculam permissões a partir dos cargos da guilda.
  await guild.roles.fetch();
  const actor = await guild.members.fetch({ user: actorId, force: true }).catch(() => null);
  requireThat(actor && (!manager || canManageGuild(actor, guild.ownerId)), 'GUILD_FORBIDDEN', 'Acesso indisponível neste servidor.', 403);
  const me = await guild.members.fetchMe({ force: true });
  return { client, guild, actor, me, config: await getConfig(guildId) };
}
export async function updateSettings(ctx, input) {
  requireThat(canManageGuild(ctx.actor, ctx.guild.ownerId), 'KAGE-PERMISSION', 'Acesso negado.');
  requireThat(Number.isInteger(input.version), 'KAGE-VERSION', 'Versão obrigatória.', 400);
  const parsed = settingsSchema.safeParse(input.settings);
  requireThat(parsed.success, 'KAGE-CONFIG', 'Configuração inválida. Verifique os campos e limites.', 400);
  const s = parsed.data;
  if (s.tickets.supportRoleId) {
    const role = await ctx.guild.roles.fetch(s.tickets.supportRoleId);
    requireThat(role && role.id !== ctx.guild.id && !role.managed, 'KAGE-ROLE', 'Escolha um cargo de atendimento válido.', 400);
  }
  if (s.tickets.categoryId) {
    const category = await ctx.guild.channels.fetch(s.tickets.categoryId);
    requireThat(category?.type === ChannelType.GuildCategory, 'KAGE-CATEGORY', 'Categoria de ticket inválida.', 400);
    requireThat(ctx.me.permissionsIn(category).has([P.ViewChannel, P.ManageChannels]), 'KAGE-CATEGORY-PERMISSION', 'O Kage não pode criar tickets nesta categoria.', 400);
  }
  if (s.logChannelId) {
    const channel = await ctx.guild.channels.fetch(s.logChannelId);
    requireThat(channel?.isTextBased() && channel.guildId === ctx.guild.id && ctx.me.permissionsIn(channel).has([P.ViewChannel, P.SendMessages]), 'KAGE-LOG-CHANNEL', 'Canal de logs indisponível.', 400);
    requireThat(!channel.permissionsFor(ctx.guild.roles.everyone).has(P.ViewChannel), 'KAGE-LOG-PRIVATE', 'Use um canal de logs privado.', 400);
  }
  await audit(ctx, 'config.update', 'requested');
  return commitSettings(ctx,input.version,s);
}

export async function makePlan(ctx, kind, payload) {
  requireThat(canManageGuild(ctx.actor, ctx.guild.ownerId), 'KAGE-PERMISSION', 'Acesso negado.');
  requireThat(['setup', 'ban', 'embed'].includes(kind), 'KAGE-PLAN-KIND', 'Plano inválido.', 400);
  if (kind === 'setup') assertModule(ctx.config.settings, 'setup', { effect: true });
  if (kind === 'embed') assertModule(ctx.config.settings, 'embeds', { effect: true });
  if (kind === 'ban') {
    requireThat(ctx.actor.permissions.has(P.BanMembers) && ctx.me.permissions.has(P.BanMembers), 'KAGE-PERMISSION', 'Falta permissão para banir.');
    await moderationTarget(ctx, payload.targetId);
  }
  const plan = createPlan({ guildId: ctx.guild.id, actorId: ctx.actor.id, version: ctx.config.version, kind, payload });
  await Operation.create(plan);
  await audit(ctx, kind + '.preview', 'confirmed', { correlationId: plan.id });
  return plan;
}
export function setupPayload(template = 'community') {
  requireThat(['community', 'support', 'gaming'].includes(template), 'KAGE-TEMPLATE', 'Modelo inválido.', 400);
  const labels = { community: ['boas-vindas', 'regras', 'conversa', 'midia'], support: ['como-pedir-ajuda', 'avisos', 'feedback'], gaming: ['regras', 'geral', 'procurando-grupo', 'clipes'] };
  return { template, category: 'KAGE · ' + ({ community: 'Comunidade', support: 'Suporte', gaming: 'Gaming' }[template]), channels: labels[template], inheritServerPermissions: true, preservesExisting: true };
}
export async function executePlan(client, guildId, actorId, id) {
  let ctx = await context(client, guildId, actorId, { manager: true });
  const plan = await Operation.findOne({ id, guildId }).lean();
  validatePlan(plan, { guildId, actorId, version: ctx.config.version });
  if (plan.kind === 'setup') {
    assertModule(ctx.config.settings, 'setup', { effect: true });
    requireThat(ctx.actor.permissions.has(P.ManageChannels) && ctx.me.permissions.has(P.ManageChannels), 'KAGE-PERMISSION', 'Falta Gerenciar canais.');
    const channels = await ctx.guild.channels.fetch();
    requireThat(!channels.some(c => c?.name === plan.payload.category), 'KAGE-EXISTS', 'Já existe uma categoria com esse nome. Nenhuma alteração aplicada.', 409);
  }
  if (plan.kind === 'ban') { requireThat(ctx.actor.permissions.has(P.BanMembers) && ctx.me.permissions.has(P.BanMembers), 'KAGE-PERMISSION', 'Falta Banir membros.'); await moderationTarget(ctx, plan.payload.targetId); }
  if (plan.kind === 'embed') assertModule(ctx.config.settings, 'embeds', { effect: true });
  const claimed = await Operation.findOneAndUpdate({ id, guildId, status: 'pending' }, { $set: { status: 'executing' } });
  requireThat(claimed, 'KAGE-PLAN-USED', 'Este plano já foi utilizado.', 409);
  const created = [];
  try {
    await audit(ctx, plan.kind + '.execute', 'started', { correlationId: id });
    // A política é consultada novamente após o claim e antes do primeiro efeito.
    ctx = await context(client, guildId, actorId, { manager: true });
    requireThat(ctx.config.version === plan.configVersion && !ctx.config.settings.paused, 'KAGE-PLAN-STALE', 'Configuração alterada ou ações pausadas.', 409);
    let result;
    if (plan.kind === 'setup') {
      const category = await ctx.guild.channels.create({ name: plan.payload.category, type: ChannelType.GuildCategory, reason: 'Kage plano ' + id });
      created.push(category.id);
      await Operation.updateOne({ id }, { $set: { result: { created: [...created] } } });
      for (const name of plan.payload.channels) {
        const fresh = await context(client, guildId, actorId, { manager: true });
        requireThat(fresh.config.version === plan.configVersion && !fresh.config.settings.paused && fresh.me.permissions.has(P.ManageChannels) && fresh.actor.permissions.has(P.ManageChannels), 'KAGE-PLAN-STALE', 'Plano interrompido após mudança de permissão/configuração.', 409);
        const c = await fresh.guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, topic: 'Kage · operação ' + id, reason: 'Kage plano ' + id });
        created.push(c.id);
        await Operation.updateOne({ id }, { $set: { result: { created: [...created] } } });
      }
      result = { created, message: 'Estrutura criada. Canais preexistentes preservados.' };
    } else if (plan.kind === 'ban') {
      requireThat(ctx.actor.permissions.has(P.BanMembers) && ctx.me.permissions.has(P.BanMembers), 'KAGE-PERMISSION', 'Permissão revogada.');
      await moderationTarget(ctx, plan.payload.targetId);
      await ctx.guild.members.ban(plan.payload.targetId, { deleteMessageSeconds: 0, reason: inertText(plan.payload.reason) + ' · ' + actorId + ' · ' + id });
      result = { message: 'Banimento confirmado.', targetId: plan.payload.targetId };
    } else {
      const channel = await ctx.guild.channels.fetch(plan.payload.channelId);
      requireThat(channel?.type === ChannelType.GuildText && channel.guildId === guildId && ctx.me.permissionsIn(channel).has([P.ViewChannel, P.SendMessages, P.EmbedLinks]) && ctx.actor.permissionsIn(channel).has(P.SendMessages), 'KAGE-CHANNEL', 'Canal indisponível ou sem permissão.');
      const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle(plan.payload.title).setDescription(inertText(plan.payload.description)).setColor(0xf26a21).setFooter({ text: 'Kage' })], allowedMentions: { parse: [] } });
      result = { message: 'Embed publicado.', messageId: msg.id };
    }
    await Operation.updateOne({ id }, { $set: { status: 'complete', result } });
    await audit(ctx, plan.kind + '.execute', 'confirmed', { correlationId: id });
    return result;
  } catch (error) {
    // Resultado remoto pode ser incerto; não repetir nem apagar recursos automaticamente.
    await Operation.updateOne({ id }, { $set: { status: 'uncertain', result: { created, code: error.code || 'KAGE-REMOTE', message: 'Revise o estado remoto antes de gerar outro plano.' } } }).catch(() => {});
    await audit(ctx, plan.kind + '.execute', 'uncertain', { correlationId: id, code: String(error.code || 'KAGE-REMOTE') }).catch(() => {});
    throw new KageError('KAGE-PARTIAL', 'Execução sem confirmação completa. Revise os recursos da operação ' + id + ' antes de tentar novamente.', 409);
  }
}
export async function moderationTarget(ctx, targetId) {
  const target = await ctx.guild.members.fetch({ user: targetId, force: true });
  requireThat(target.id !== ctx.guild.ownerId && target.id !== ctx.actor.id && target.id !== ctx.me.id, 'KAGE-TARGET', 'Este alvo não pode receber esta ação.');
  requireThat(target.roles.highest.position < ctx.me.roles.highest.position && (ctx.actor.id === ctx.guild.ownerId || target.roles.highest.position < ctx.actor.roles.highest.position), 'KAGE-HIERARCHY', 'A hierarquia de cargos impede esta ação.');
  return target;
}

export async function openTicket(ctx, eventId) {
  assertModule(ctx.config.settings, 'tickets', { effect: true });
  requireThat(ctx.me.permissions.has(P.ManageChannels), 'KAGE-PERMISSION', 'O Kage precisa de Gerenciar canais.');
  const { supportRoleId, categoryId, maxOpen } = ctx.config.settings.tickets;
  requireThat(supportRoleId && supportRoleId !== ctx.guild.id, 'KAGE-TICKET-CONFIG', 'Configure um cargo privado de atendimento.', 409);
  requireThat(await ctx.guild.roles.fetch(supportRoleId), 'KAGE-TICKET-CONFIG', 'Cargo de atendimento indisponível.', 409);
  requireThat(await once(ctx.guild.id + ':ticket:' + eventId, 7), 'KAGE-DUPLICATE', 'Esta solicitação já foi recebida. Consulte seus tickets.', 409);
  let ticket;
  for (let slot = 0; slot < maxOpen; slot++) {
    try { ticket = await Ticket.create({ id: randomUUID(), guildId: ctx.guild.id, ownerId: ctx.actor.id, supportRoleId, slot, state: 'opening', operationId: eventId }); break; }
    catch (e) { if (e.code !== 11000) throw e; }
  }
  requireThat(ticket, 'KAGE-TICKET-LIMIT', 'Você atingiu o limite de tickets abertos.', 409);
  await audit(ctx, 'ticket.open', 'started', { correlationId: eventId });
  try {
    const c = await ctx.guild.channels.create({ name: 'ticket-' + ticket.id.slice(0, 8), type: ChannelType.GuildText, parent: categoryId || undefined, topic: 'Ticket Kage ' + ticket.id + ' · operação ' + eventId, permissionOverwrites: [{ id: ctx.guild.id, deny: [P.ViewChannel] }, { id: ctx.actor.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }, { id: supportRoleId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }, { id: ctx.me.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels] }], reason: 'Ticket Kage ' + ticket.id });
    ticket.channelId = c.id; ticket.state = 'open'; await ticket.save();
    await c.send({ content: 'Atendimento privado. Visível a você, à equipe de suporte e aos administradores do servidor. Use /ticket fechar para encerrar. Transcrições seguem o prazo configurado pelo servidor.', allowedMentions: { parse: [] } });
    await audit(ctx, 'ticket.open', 'confirmed', { targetId: ticket.id, correlationId: eventId });
    return ticket.toObject();
  } catch (e) { await Ticket.updateOne({ id: ticket.id }, { $set: { state: 'uncertain' } }).catch(() => {}); throw new KageError('KAGE-TICKET-UNCERTAIN', 'A criação precisa de revisão. Não abra outro ticket antes de verificar o canal/operação ' + eventId + '.', 409); }
}
export function ticketAllowed(ctx, t) {
  return t.guildId === ctx.guild.id && (t.ownerId === ctx.actor.id || ctx.actor.id === ctx.guild.ownerId || ctx.actor.roles.cache.has(t.supportRoleId));
}
export async function closeTicket(ctx, channelId) {
  assertModule(ctx.config.settings, 'tickets', { effect: true });
  const t = await Ticket.findOne({ guildId: ctx.guild.id, channelId, state: 'open' }).lean();
  requireThat(t && ticketAllowed(ctx, t), 'KAGE-TICKET-ACCESS', 'Ticket indisponível para este usuário.');
  const claim = await Ticket.findOneAndUpdate({ id: t.id, state: 'open' }, { $set: { state: 'closing' } });
  requireThat(claim, 'KAGE-TICKET-STATE', 'O encerramento já está em andamento.', 409);
  await audit(ctx, 'ticket.close', 'started', { targetId: t.id });
  try {
    const c = await ctx.guild.channels.fetch(channelId);
    requireThat(ctx.me.permissionsIn(c).has(P.ManageChannels), 'KAGE-PERMISSION', 'Falta Gerenciar canais.');
    await c.permissionOverwrites.edit(t.ownerId, { SendMessages: false });
    await c.setName('fechado-' + t.id.slice(0, 8));
    const expiresAt = retentionDate(ctx.config.settings.tickets.retentionDays);
    await Ticket.updateOne({ id: t.id }, { $set: { state: 'closed', active: false, expiresAt } });
    await audit(ctx, 'ticket.close', 'confirmed', { targetId: t.id });
    return { message: 'Ticket encerrado. O canal será excluído no prazo de retenção configurado.' };
  } catch (e) { await Ticket.updateOne({ id: t.id }, { $set: { state: 'uncertain' } }).catch(() => {}); throw e; }
}
export async function transcript(ctx, id) {
  const t = await Ticket.findOne({ id, guildId: ctx.guild.id }).lean();
  requireThat(t && ticketAllowed(ctx, t), 'KAGE-TICKET-ACCESS', 'Transcrição indisponível.');
  requireThat(!t.expiresAt || new Date(t.expiresAt) > new Date(), 'KAGE-EXPIRED', 'O prazo de retenção terminou.', 410);
  const channel = await ctx.guild.channels.fetch(t.channelId);
  requireThat(channel && ctx.actor.permissionsIn(channel).has(P.ViewChannel) && ctx.me.permissionsIn(channel).has([P.ViewChannel, P.ReadMessageHistory]), 'KAGE-TICKET-ACCESS', 'Transcrição indisponível.');
  // Limite deliberado: exportação das últimas 100 mensagens, sem anexos/recursos remotos.
  const messages = [...(await channel.messages.fetch({ limit: 100 })).values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const body = messages.map(m => '<article><h3>' + escapeHtml(m.author.username) + ' · ' + escapeHtml(m.createdAt.toISOString()) + '</h3><pre>' + escapeHtml(redactSecrets(m.content)) + '</pre>' + (m.attachments.size ? '<p>[Anexos omitidos]</p>' : '') + '</article>').join('');
  await audit(ctx, 'ticket.export', 'confirmed', { targetId: t.id });
  return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Transcrição Kage</title><style>body{font:16px system-ui;max-width:800px;margin:40px auto;padding:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-bottom:1px solid #ddd}</style><h1>Transcrição Kage</h1><p>Exportação limitada às últimas 100 mensagens. Anexos omitidos.</p>' + body + '</html>';
}
async function ensureProfile(guildId, userId) {
  try { await Profile.updateOne({ guildId, userId }, { $setOnInsert: { guildId, userId, xp: 0, wallet: 0, lastXpAt: new Date(0), lastDailyAt: new Date(0) } }, { upsert: true }); }
  catch(e) { if(e.code !== 11000) throw e; }
}
export async function awardXp(ctx, message) {
  assertModule(ctx.config.settings, 'levels', { effect: true });
  if (message.author.bot || message.content.trim().length < 5) return;
  const fingerprint = createHash('sha256').update(message.content.trim().toLowerCase()).digest('hex');
  await ensureProfile(ctx.guild.id, message.author.id);
  if (!await once(ctx.guild.id + ':xp:' + message.id)) return;
  const s = ctx.config.settings.levels;
  await Profile.updateOne({ guildId: ctx.guild.id, userId: message.author.id, lastXpAt: { $lte: new Date(Date.now() - s.cooldownSeconds * 1000) }, fingerprint: { $ne: fingerprint } }, { $inc: { xp: s.xpPerMessage }, $set: { lastXpAt: new Date(), fingerprint } });
}
export async function daily(ctx) {
  assertModule(ctx.config.settings, 'economy', { effect: true });
  await ensureProfile(ctx.guild.id, ctx.actor.id);
  const result = await Profile.findOneAndUpdate({ guildId: ctx.guild.id, userId: ctx.actor.id, lastDailyAt: { $lte: new Date(Date.now() - 86400000) } }, { $inc: { wallet: ctx.config.settings.economy.dailyAmount }, $set: { lastDailyAt: new Date() } }, { new: true }).lean();
  requireThat(result, 'KAGE-DAILY', 'A recompensa diária já foi coletada nas últimas 24 horas.', 409);
  return result;
}
export { levelForXp };
