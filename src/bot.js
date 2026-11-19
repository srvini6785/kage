import { Client, Events, GatewayIntentBits, PermissionFlagsBits as P, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AuditLogEvent, Partials } from 'discord.js';
import {createEventLogger} from '../backend/event-logger.js';
import {createMemberAutomation} from '../backend/member-automation.js';
import {BoostGrant} from '../backend/models.js';
import {createSecurityEngine,loadSecurity} from '../backend/security-engine.js';
import {hashPlan} from './core/policy.js';
import {SecurityDecision} from '../backend/models.js';
import {previewOperation,launchOperation} from '../backend/operations.js';
import {moderationDefinitions,isModerationCommand,handleModerationCommand} from '../backend/moderation-commands.js';
import { getConfig, Audit, Profile, once } from './db.js';
import { SlidingWindow, requireThat, assertModule, KageError, inertText } from './core/policy.js';
import { context, audit, makePlan, setupPayload, executePlan, openTicket, closeTicket, awardXp, daily, levelForXp } from './services.js';

export function commandDefinitions() {
  const commands = [
    new SlashCommandBuilder().setName('confirmar').setDescription('Confirmar um plano pela frase exibida na prévia.').addStringOption(o=>o.setName('referencia').setDescription('Referência do plano').setRequired(true).setMaxLength(36)).addStringOption(o=>o.setName('frase').setDescription('Digite exatamente a frase da prévia').setRequired(true).setMaxLength(100)),
    new SlashCommandBuilder().setName('verificar').setDescription('Confirmar participação neste servidor.'),
    new SlashCommandBuilder().setName('kage').setDescription('Estado dos módulos do Kage.'),
    new SlashCommandBuilder().setName('ticket').setDescription('Atendimento privado').addSubcommand(c => c.setName('abrir').setDescription('Abrir um atendimento privado')).addSubcommand(c => c.setName('fechar').setDescription('Encerrar o ticket deste canal')),
    new SlashCommandBuilder().setName('nivel').setDescription('Consultar seu nível e XP neste servidor.'),
    new SlashCommandBuilder().setName('saldo').setDescription('Consultar sua moeda virtual sem valor real.'),
    new SlashCommandBuilder().setName('diario').setDescription('Receber a recompensa virtual a cada 24 horas.'),
    new SlashCommandBuilder().setName('setup').setDescription('Prévia de estrutura de servidor; exige confirmação.').setDefaultMemberPermissions(P.ManageGuild).addStringOption(o => o.setName('modelo').setDescription('Estrutura desejada').setRequired(true).addChoices({ name: 'Comunidade', value: 'community' }, { name: 'Suporte', value: 'support' }, { name: 'Gaming', value: 'gaming' })),
    new SlashCommandBuilder().setName('banir').setDescription('Preparar um banimento com confirmação.').setDefaultMemberPermissions(P.ManageGuild | P.BanMembers).addUserOption(o => o.setName('membro').setDescription('Membro alvo').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Regra e motivo da ação').setRequired(true).setMaxLength(400)),
    new SlashCommandBuilder().setName('timeout').setDescription('Restringir temporariamente um membro.').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(o => o.setName('membro').setDescription('Membro alvo').setRequired(true)).addIntegerOption(o => o.setName('minutos').setDescription('Duração de 1 a 60 minutos').setRequired(true).setMinValue(1).setMaxValue(60)).addStringOption(o => o.setName('motivo').setDescription('Motivo público da medida').setRequired(true).setMaxLength(400)),
    new SlashCommandBuilder().setName('embed').setDescription('Preparar anúncio para este canal.').setDefaultMemberPermissions(P.ManageGuild).addStringOption(o => o.setName('titulo').setDescription('Título').setRequired(true).setMaxLength(200)).addStringOption(o => o.setName('descricao').setDescription('Descrição').setRequired(true).setMaxLength(1800))
  ];
  commands.push(...moderationDefinitions());
  return commands.map(c => c.setDMPermission(false).toJSON());
}
const confirmation = (id) => [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirm:' + id).setLabel('Confirmar este plano').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('cancel:' + id).setLabel('Cancelar').setStyle(ButtonStyle.Secondary))];
export function createBot({ token, messageContent, guildMembers=false, reactions=false, nativeEvents=false, assessAI=null, messageEvents=false, logMaskKey="kage-local-log-key" }) {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration];
  if (messageContent) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  if(messageEvents&&!messageContent)intents.push(GatewayIntentBits.GuildMessages);
  if(guildMembers)intents.push(GatewayIntentBits.GuildMembers);
  if(reactions)intents.push(GatewayIntentBits.GuildMessageReactions);
  if(nativeEvents)intents.push(GatewayIntentBits.AutoModerationConfiguration,GatewayIntentBits.AutoModerationExecution);
  const client = new Client({ intents, partials:reactions?[Partials.Message,Partials.Channel,Partials.Reaction]:[], allowedMentions: { parse: [], repliedUser: false } });
  const security=createSecurityEngine({client,assessAI}),memberAutomation=createMemberAutomation(client),eventLogger=createEventLogger(client,logMaskKey);
  const windows = new Map();
  const nukeWindow = new SlidingWindow({ windowMs: 300000, limit: 30 });
  const safeError = e => console.error('Kage evento:', e instanceof KageError ? e.code : 'KAGE-DEPENDENCY');
  client.once(Events.ClientReady, () => console.log('Kage conectado. Servidores: ' + client.guilds.cache.size));
  client.on(Events.Error, safeError);
  client.on(Events.InteractionCreate, async i => {
    if ((!i.isChatInputCommand() && !i.isButton()) || !i.inGuild()) return;
    try {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const ctx = await context(client, i.guildId, i.user.id);
      if (i.isButton()) {
        const [action, id] = i.customId.split(':');
        if(action==='verify'){const r=await security.verify(i.guildId,i.user.id,id);await i.editReply({content:'Participação '+r.state+'.',components:[]});return;}
        if(action==='operation-confirm'){const result=await launchOperation(client,ctx,id);await i.editReply({content:result.message+' Referência: '+result.id+' · Use /operacao para acompanhar.',components:[]});}
        else if(action==='operation-cancel'){const {Operation}=await import('./db.js');const change=await Operation.updateOne({id,guildId:i.guildId,actorId:i.user.id,status:{$in:['preview','queued','running']}},{$set:{cancelRequested:true}});requireThat(change.modifiedCount===1,'CONFLICT_VERSION','Operação indisponível ou já alterada.',409);await i.editReply({content:'Cancelamento solicitado. Efeitos já confirmados permanecem no histórico.',components:[]});}
        else if (action === 'confirm') { const result = await executePlan(client, i.guildId, i.user.id, id); await i.editReply({ content: result.message, components: [] }); }
        else if (action === 'cancel') {
          const { Operation } = await import('./db.js');
          await Operation.updateOne({ id, guildId: i.guildId, actorId: i.user.id, status: 'pending' }, { $set: { status: 'cancelled' } });
          await i.editReply({ content: 'Plano cancelado ou já indisponível.', components: [] });
        }
        return;
      }
      if(isModerationCommand(i.commandName)){await i.editReply(await handleModerationCommand(ctx,i,previewOperation));return;}
      if(i.commandName==='confirmar'){const result=await launchOperation(client,ctx,i.options.getString('referencia'),i.options.getString('frase'));await i.editReply({content:result.message+' Referência: '+result.id});return;}
      if(i.commandName==='verificar'){const {nonce}=await security.challenge(i.guildId,i.user.id);await i.editReply({content:'Confirme sua participação. Isso não comprova identidade nem resolve captcha.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify:'+nonce).setLabel('Confirmar minha participação').setStyle(ButtonStyle.Primary))]});return;}
      switch (i.commandName) {
        case 'kage': await i.editReply({ content: 'Kage · ' + (ctx.config.settings.paused ? 'ações pausadas' : 'conectado') + '\n' + Object.entries(ctx.config.settings.modules).map(([k, v]) => k + ': ' + v).join(' · ') }); break;
        case 'ticket': {
          const result = i.options.getSubcommand() === 'abrir' ? await openTicket(ctx, i.id) : await closeTicket(ctx, i.channelId);
          await i.editReply({ content: result.channelId ? 'Ticket criado: <#' + result.channelId + '>' : result.message }); break;
        }
        case 'nivel': {
          assertModule(ctx.config.settings, 'levels');
          const p = await Profile.findOne({ guildId: i.guildId, userId: i.user.id }).lean();
          await i.editReply({ content: 'Nível ' + levelForXp(p?.xp || 0) + ' · ' + (p?.xp || 0) + ' XP neste servidor.' }); break;
        }
        case 'saldo': {
          assertModule(ctx.config.settings, 'economy');
          const p = await Profile.findOne({ guildId: i.guildId, userId: i.user.id }).lean();
          await i.editReply({ content: 'Seu saldo: ' + (p?.wallet || 0) + ' moedas virtuais. Sem valor em dinheiro.' }); break;
        }
        case 'diario': { const p = await daily(ctx); await i.editReply({ content: 'Recompensa recebida. Saldo: ' + p.wallet + ' moedas virtuais.' }); break; }
        case 'setup': {
          const plan = await makePlan(ctx, 'setup', setupPayload(i.options.getString('modelo')));
          await i.editReply({ content: 'Prévia: criar a categoria **' + plan.payload.category + '** e os canais ' + plan.payload.channels.join(', ') + '.\nNão altera canais existentes nem concede Administrador. Expira em 5 minutos.', components: confirmation(plan.id) }); break;
        }
        // /banir e /timeout são preservados e tratados pela política compartilhada antes deste switch.
        case 'embed': {
          const plan = await makePlan(ctx, 'embed', { title: i.options.getString('titulo'), description: i.options.getString('descricao'), channelId: i.channelId });
          await i.editReply({ content: 'Publicar neste canal?\n**' + inertText(plan.payload.title) + '**\n' + inertText(plan.payload.description), components: confirmation(plan.id) }); break;
        }
      }
    } catch (e) {
      safeError(e);
      const content = e instanceof KageError ? e.message + ' (' + e.code + ')' : 'Não foi possível confirmar a operação. Verifique o estado antes de tentar novamente. (KAGE-DEPENDENCY)';
      if (i.deferred || i.replied) await i.editReply({ content, components: [], allowedMentions: { parse: [] } }).catch(() => {});
      else await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
  if (messageContent) client.on(Events.MessageCreate, async message => {
    if (!message.guild || message.author.bot) return;
    try {
      const decision=await security.handle({type:'message',id:message.id,guildId:message.guild.id,userId:message.author.id,channelId:message.channelId,at:message.createdTimestamp,content:message.content,contentHash:hashPlan(message.content),mentions:new Set([...message.mentions.users.keys(),...message.mentions.roles.keys()]).size,roleIds:[...message.member?.roles.cache.keys()||[]],accountCreatedAt:message.author.createdTimestamp});
      if(decision.results?.some(r=>r.state==='confirmed'&&r.action==='delete'))return;
      const config = await getConfig(message.guild.id);
      if (config.settings.paused) return;
      let spam = false;
      if (config.settings.modules.automod !== 'disabled') {
        const s = config.settings.automod;
        const windowKey = s.windowSeconds + ':' + s.maxMessages;
        if (!windows.has(windowKey)) windows.set(windowKey, new SlidingWindow({ windowMs: s.windowSeconds * 1000, limit: s.maxMessages }));
        const hit = windows.get(windowKey).hit(message.guild.id + ':' + message.author.id + ':' + message.channelId, message.id);
        if (hit.duplicate) return;
        spam = hit.exceeded || message.mentions.users.size + message.mentions.roles.size > s.maxMentions || message.mentions.everyone;
        if (spam && await once(message.guild.id + ':automod:' + message.id)) {
          const ctx = await context(client, message.guild.id, message.author.id);
          await audit(ctx, 'automod.spam', 'observed', { targetId: message.id });
          if (ctx.config.settings.modules.automod === 'enforce' && ctx.config.settings.automod.deleteSpam && !ctx.config.settings.paused) {
            requireThat(ctx.me.permissionsIn(message.channel).has(P.ManageMessages), 'KAGE-PERMISSION', 'Falta Gerenciar mensagens.');
            if (!ctx.actor.permissions.has(P.ManageMessages)) { await message.delete(); await audit(ctx, 'automod.delete', 'confirmed', { targetId: message.id }); }
          }
        }
      }
      if (!spam && config.settings.modules.levels === 'enforce') await awardXp({ guild: message.guild, actor: message.member, config }, message);
    } catch (e) { safeError(e); }
  });
  if(guildMembers){
    client.on(Events.GuildMemberAdd,member=>{void eventLogger({guildId:member.guild.id,id:member.id+':'+member.joinedTimestamp,type:'member.join',category:'joins',actorId:member.id,targetId:member.id,at:member.joinedTimestamp}).catch(safeError);void memberAutomation(member,{welcome:true}).catch(safeError);return security.handle({type:'member-join',id:member.id+':'+member.joinedTimestamp,guildId:member.guild.id,userId:member.id,at:member.joinedTimestamp,accountCreatedAt:member.user.createdTimestamp,roleIds:[...member.roles.cache.keys()],bot:member.user.bot}).catch(safeError);});
    client.on(Events.GuildMemberUpdate,(before,after)=>{if(before.premiumSinceTimestamp!==after.premiumSinceTimestamp)void memberAutomation(after).catch(safeError);const added=[...after.roles.cache.keys()].filter(id=>!before.roles.cache.has(id)),removed=[...before.roles.cache.keys()].filter(id=>!after.roles.cache.has(id));if(added.length||removed.length)void security.handle({type:'member-role',id:after.id+':'+hashPlan([added,removed])+':'+Math.floor(Date.now()/1000),guildId:after.guild.id,userId:after.id,at:Date.now(),accountCreatedAt:after.user.createdTimestamp,roleIds:[...after.roles.cache.keys()],addedRoleIds:added,removedRoleIds:removed,bot:after.user.bot}).catch(safeError);});
  }
  if(guildMembers)client.on(Events.GuildMemberRemove,member=>eventLogger({guildId:member.guild.id,id:member.id+':leave:'+Date.now(),type:'member.leave',category:'leaves',actorId:member.id,targetId:member.id,at:Date.now()}).catch(safeError));
  if(messageEvents||messageContent){client.on(Events.MessageDelete,m=>eventLogger({guildId:m.guildId,id:m.id,type:'message.delete',category:'messages',targetId:m.id,actorId:m.author?.id,channelId:m.channelId,at:Date.now()}).catch(safeError));client.on(Events.MessageUpdate,(_before,m)=>eventLogger({guildId:m.guildId,id:m.id+':'+m.editedTimestamp,type:'message.edit',category:'messages',targetId:m.id,actorId:m.author?.id,channelId:m.channelId,at:m.editedTimestamp}).catch(safeError));}
  const auditedCategories=new Map([[AuditLogEvent.ChannelCreate,'channels'],[AuditLogEvent.ChannelUpdate,'channels'],[AuditLogEvent.ChannelDelete,'channels'],[AuditLogEvent.RoleCreate,'roles'],[AuditLogEvent.RoleUpdate,'roles'],[AuditLogEvent.RoleDelete,'roles'],[AuditLogEvent.MemberBanAdd,'punishments'],[AuditLogEvent.MemberBanRemove,'punishments'],[AuditLogEvent.MemberKick,'punishments']]);
  client.on(Events.GuildAuditLogEntryCreate,(entry,guild)=>{const category=auditedCategories.get(entry.action);if(category)void eventLogger({guildId:guild.id,id:entry.id,type:'admin.'+entry.action,category,actorId:entry.executorId,targetId:entry.targetId,at:entry.createdTimestamp}).catch(safeError);});
  if(guildMembers)client.on(Events.GuildUpdate,async(before,after)=>{if(before.premiumSubscriptionCount===after.premiumSubscriptionCount)return;try{const rows=await BoostGrant.find({guildId:after.id,state:'active'}).limit(500).lean();for(const row of rows){const member=await after.members.fetch({user:row.userId,force:true});await memberAutomation(member);}}catch(e){safeError(e);}});
  if(reactions)client.on(Events.MessageReactionAdd,async(reaction,user)=>{if(user.bot)return;try{if(reaction.partial)await reaction.fetch();const message=reaction.message;if(!message.guildId)return;const policy=await loadSecurity(message.guildId),v=policy.payload.verification;if(v.method==='reaction'&&v.state==='enforce'&&message.id===v.messageId&&message.channelId===v.channelId&&message.author?.id===client.user.id&&reaction.emoji.name==='✅'){const {nonce}=await security.challenge(message.guildId,user.id);await security.verify(message.guildId,user.id,nonce);}else{const member=await message.guild.members.fetch(user.id);await security.handle({type:'reaction',id:message.id+':'+user.id+':'+reaction.emoji.identifier,guildId:message.guildId,userId:user.id,channelId:message.channelId,at:Date.now(),accountCreatedAt:user.createdTimestamp,roleIds:[...member.roles.cache.keys()]});}}catch(e){safeError(e);}});
  if(nativeEvents)client.on(Events.AutoModerationActionExecution,async event=>{try{const me=await event.guild.members.fetchMe({force:true});if(!me.permissions.has(P.ManageGuild))return;const eventId=hashPlan([event.ruleId,event.userId,event.messageId,event.alertSystemMessageId,event.action.type,event.messageId||event.alertSystemMessageId?null:Math.floor(Date.now()/5000)]);await SecurityDecision.create({guildId:event.guild.id,eventId,ruleId:'native:'+event.ruleId,targetId:event.userId,channelId:event.channelId,action:String(event.action.type),state:'confirmed',confidenceClass:'platform',evidenceIds:[event.messageId,event.alertSystemMessageId].filter(Boolean),correlationId:eventId,expiresAt:new Date(Date.now()+(await getConfig(event.guild.id)).settings.auditRetentionDays*86400000)});}catch(e){if(e.code!==11000)safeError(e);}});
  const monitored = new Set([AuditLogEvent.ChannelDelete, AuditLogEvent.RoleDelete, AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberKick, AuditLogEvent.RoleUpdate, AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookDelete]);
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    if (!monitored.has(entry.action) || !entry.executorId || !entry.targetId || entry.executorId === client.user?.id) return;
    try {
      const config = await getConfig(guild.id);
      if (config.settings.modules.antinuke === 'disabled' || config.settings.paused) return;
      if (!await once(guild.id + ':audit:' + entry.id, 7)) return;
      const key = guild.id + ':' + entry.executorId + ':' + entry.action;
      // Apenas eventos recebidos agora; uma entrada antiga não conta como incidente atual.
      if (Math.abs(Date.now() - entry.createdTimestamp) > config.settings.antinuke.windowSeconds * 1000) return;
      const windowMs = config.settings.antinuke.windowSeconds * 1000;
      nukeWindow.windowMs = windowMs;
      const hit = nukeWindow.hit(key, entry.id);
      if (hit.count < config.settings.antinuke.threshold) return;
      if (!await once(guild.id + ':alert:' + entry.executorId + ':' + Math.floor(Date.now() / 60000))) return;
      const ctx = { guild, actor: { id: entry.executorId }, config };
      await audit(ctx, 'antinuke.pattern', 'review', { targetId: entry.targetId, correlationId: entry.id });
      if (config.settings.logChannelId) {
        const channel = await guild.channels.fetch(config.settings.logChannelId);
        const me = await guild.members.fetchMe({ force: true });
        if (channel?.isTextBased() && !channel.permissionsFor(guild.roles.everyone).has(P.ViewChannel) && me.permissionsIn(channel).has(P.SendMessages)) {
          await channel.send({ content: 'Kage · padrão administrativo para revisão. Ator ID ' + entry.executorId + ' · ' + hit.count + ' eventos na janela configurada. Referência ' + entry.id + '. Nenhuma punição automática aplicada.', allowedMentions: { parse: [] } });
        }
      }
    } catch(e) { safeError(e); }
  });
  return { client, login: () => client.login(token) };
}
