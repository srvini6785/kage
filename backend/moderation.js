import {randomUUID} from 'node:crypto';
import {PermissionFlagsBits as P,GatewayIntentBits,Routes} from 'discord.js';
import {requireThat,KageError,retentionDate,redactSecrets} from '../src/core/policy.js';
import {moderationTarget,audit} from '../src/services.js';
import {Punishment,ChannelLock} from './models.js';
import {moderationSchema} from '../bot-shared/moderation.js';
import {parse} from '../bot-shared/schemas.js';
import {assertRole} from './guards.js';
const permission={ban:P.BanMembers,unban:P.BanMembers,kick:P.KickMembers,timeout:P.ModerateMembers,warn:P.ModerateMembers,unwarn:P.ModerateMembers,'role-add':P.ManageRoles,'role-remove':P.ManageRoles};
export function safeReason(value){return redactSecrets(value).replace(/@(everyone|here)/gi,'@\u200b$1').slice(0,400);}
export function assertModerationPermission(ctx,action){requireThat(!ctx.config.settings.paused,'GUILD_NOT_READY','As ações estão pausadas.',409);const bit=permission[action];if(bit)requireThat(ctx.actor.permissions.has(bit)&&ctx.me.permissions.has(bit),'PERMISSION_MISSING','Operador ou Kage sem a permissão necessária.');}
export function selectCleanup(messages,filters,now=Date.now()){
 const matching=messages.filter(m=>!m.pinned&&(!filters.userId||m.author.id===filters.userId)&&(filters.bots==='all'||(filters.bots==='only'?m.author.bot:!m.author.bot))&&(!filters.contains||m.content.toLocaleLowerCase('pt-BR').includes(filters.contains.toLocaleLowerCase('pt-BR')))&&(!filters.links||/https?:\/\//i.test(m.content))&&(!filters.attachments||m.attachments.size>0)&&(!filters.before||m.createdTimestamp<Date.parse(filters.before))&&(!filters.after||m.createdTimestamp>Date.parse(filters.after))).slice(0,filters.count);
 return {eligible:matching.filter(m=>now-m.createdTimestamp<14*86400000),tooOld:matching.filter(m=>now-m.createdTimestamp>=14*86400000)};
}
export function overwriteValue(channel,guildId){const o=channel.permissionOverwrites.cache.get(guildId);return o?.deny.has(P.SendMessages)?false:o?.allow.has(P.SendMessages)?true:null;}
export async function checkModeration(ctx,input,{punishments=Punishment,locks=ChannelLock}={}){
 const p=parse(moderationSchema,input);requireThat(ctx.client.isReady(),'GUILD_NOT_READY','O Kage está desconectado. Aguarde antes de aplicar.',409);assertModerationPermission(ctx,p.action);let target,channel,role,lock;
 if(p.targetId&&p.action!=='unban'){
  target=await moderationTarget(ctx,p.targetId).catch(e=>{if(e.code===10007)throw new KageError('GUILD_NOT_READY','Membro indisponível nesta guilda.',409);throw e;});
  if(p.action==='ban')requireThat(target.bannable,'PERMISSION_HIERARCHY','Alvo não pode ser banido.');
  if(p.action==='kick')requireThat(target.kickable,'PERMISSION_HIERARCHY','Alvo não pode ser expulso.');
  if(p.action==='timeout')requireThat(target.moderatable,'PERMISSION_HIERARCHY','Alvo não pode receber timeout.');
 }
 if(p.action==='unban'){const entry=await ctx.guild.bans.fetch(p.targetId).catch(e=>{if(e.code===10026)return null;throw e;});requireThat(entry,'GUILD_NOT_READY','Banimento não encontrado.',409);}
 if(p.action==='unwarn'){const row=await punishments.findOne({id:p.punishmentId,guildId:ctx.guild.id,targetId:p.targetId,action:'warn',revokedAt:null,expiresAt:{$gt:new Date()}}).lean();requireThat(row,'GUILD_FORBIDDEN','Aviso indisponível neste escopo.');}
 if(p.action.startsWith('role-')){role=await ctx.guild.roles.fetch(p.roleId);requireThat(role,'GUILD_NOT_READY','Cargo indisponível.',409);assertRole(ctx,{position:role.position,permissions:role.permissions.toArray(),riskConfirmation:p.riskConfirmation},role);if(p.action==='role-add'&&role.permissions.has([P.Administrator],false))requireThat(p.riskConfirmation==='EU ASSUMO O RISCO ADMINISTRADOR'&&ctx.actor.id===ctx.guild.ownerId,'SECURITY_REVIEW_REQUIRED','Cargo Administrator exige proprietário e frase de risco.');else if(p.action==='role-add'&&role.permissions.any([P.ManageGuild,P.ManageRoles,P.BanMembers,P.ManageChannels]))requireThat(p.riskConfirmation==='CONCEDER CARGO SENSÍVEL'&&ctx.actor.id===ctx.guild.ownerId,'SECURITY_REVIEW_REQUIRED','Cargo sensível exige proprietário e frase CONCEDER CARGO SENSÍVEL.');}
 if(p.channelId){channel=await ctx.guild.channels.fetch(p.channelId);requireThat(channel?.guildId===ctx.guild.id&&channel.type===0,'GUILD_FORBIDDEN','Canal indisponível.');const required=[P.ViewChannel,...(p.action==='cleanup'?[P.ManageMessages,P.ReadMessageHistory]:p.action==='slowmode'?[P.ManageChannels]:[P.ManageRoles])];requireThat(ctx.actor.permissionsIn(channel).has(required)&&ctx.me.permissionsIn(channel).has(required),'PERMISSION_MISSING','Falta permissão no canal.');}
 if(p.action==='cleanup'&&(p.filters.contains||p.filters.links||p.filters.attachments))requireThat(ctx.client.options.intents.has(GatewayIntentBits.MessageContent),'INTENT_REQUIRED','Os filtros de conteúdo exigem Message Content configurada no bot.',409);
 if(p.action==='lock'){lock=await locks.findOne({guildId:ctx.guild.id,channelId:p.channelId,state:{$ne:'restored'}}).lean();requireThat(!lock,'CONFLICT_VERSION','Há um bloqueio ou resultado pendente neste canal.',409);}
 if(p.action==='unlock'){lock=await locks.findOne({guildId:ctx.guild.id,channelId:p.channelId,state:'active',expiresAt:{$gt:new Date()}}).lean();requireThat(lock,'CONFLICT_VERSION','Nenhum bloqueio Kage restaurável neste canal.',409);requireThat(overwriteValue(channel,ctx.guild.id)===false,'CONFLICT_VERSION','Permissão alterada manualmente. Revise sem sobrescrever.',409);}
 return {input:p,target,channel,role,lock};
}
export async function moderationPlan(ctx,input,deps){const c=await checkModeration(ctx,input,deps),p=c.input,task={kind:'moderation',input:p};let note='Permissão e hierarquia serão revalidadas imediatamente antes do efeito.';
 if(p.action==='cleanup'){const selected=selectCleanup([...(await c.channel.messages.fetch({limit:100})).values()],p.filters);task.messageIds=selected.eligible.map(m=>m.id);task.excludedOldIds=selected.tooOld.map(m=>m.id);note='Até 100 mensagens recentes examinadas; '+task.messageIds.length+' elegíveis, '+selected.tooOld.length+' antigas excluídas. Mensagens fixadas são preservadas.';requireThat(task.messageIds.length>0,'CONTENT_TOO_OLD','Nenhuma mensagem elegível nesta busca.',409);}
 if(p.action==='lock'){task.beforeSendMessages=overwriteValue(c.channel,ctx.guild.id);note='Bloqueia SendMessages de @everyone. Administrator e exceções podem continuar enviando. Snapshot preservado para /unlock por '+ctx.config.settings.auditRetentionDays+' dias; depois, revisão manual.';}
 if(p.action==='unlock'){task.lockOperationId=c.lock.operationId;task.beforeSendMessages=c.lock.beforeSendMessages;}
 if(p.action==='slowmode')task.beforeSeconds=c.channel.rateLimitPerUser;
 return {access:'moderation',tasks:[task],diff:[{kind:'moderation',name:p.action+' · '+(p.targetId||p.channelId),action:p.action==='cleanup'?'delete':'apply',note:note+' Motivo: '+safeReason(p.reason)}]};
}
export async function applyModeration(ctx,task,operationId,itemIndex,{punishments=Punishment,locks=ChannelLock,auditFn=audit}={}){
 requireThat(typeof operationId==='string'&&operationId.length>0&&Number.isInteger(itemIndex)&&itemIndex>=0,'SCHEMA_INVALID','Referência de operação obrigatória.',400);
 const c=await checkModeration(ctx,task.input,{punishments,locks}),p=c.input,reason=safeReason(p.reason),auditReason=(reason+' · Kage '+operationId).slice(0,512);let detail={};
 const auditAction='moderation.'+p.action.replace('-','.');const auditData={correlationId:operationId,targetId:p.targetId||p.channelId,reason,module:'moderation',policyVersion:'0.3.0'};
 await auditFn(ctx,auditAction,'started',auditData);
 if(p.action==='ban')await ctx.guild.members.ban(p.targetId,{deleteMessageSeconds:0,reason:auditReason});
 if(p.action==='kick')await c.target.kick(auditReason);
 if(p.action==='timeout')await c.target.timeout(p.minutes*60000,auditReason);
 if(p.action==='unban')await ctx.guild.members.unban(p.targetId,auditReason);
 if(p.action==='role-add')await c.target.roles.add(c.role,auditReason);
 if(p.action==='role-remove')await c.target.roles.remove(c.role,auditReason);
 if(p.action==='unwarn'){const r=await punishments.updateOne({id:p.punishmentId,guildId:ctx.guild.id,targetId:p.targetId,action:'warn',revokedAt:null},{$set:{revokedAt:new Date(),revokedBy:ctx.actor.id,revokeReason:reason}});requireThat(r.modifiedCount===1,'CONFLICT_VERSION','Aviso já alterado.',409);}
 if(p.action==='slowmode'){requireThat(c.channel.rateLimitPerUser===task.beforeSeconds,'CONFLICT_VERSION','Slowmode mudou desde a prévia.',409);await c.channel.setRateLimitPerUser(p.seconds,auditReason);detail={beforeSeconds:task.beforeSeconds,seconds:p.seconds};}
 if(p.action==='lock'){
  requireThat(overwriteValue(c.channel,ctx.guild.id)===task.beforeSendMessages,'CONFLICT_VERSION','Permissão mudou desde a prévia.',409);
  const scope={guildId:ctx.guild.id,channelId:p.channelId};let saved;
  const old=await locks.findOne({...scope,state:'restored'}).lean();
  const values={actorId:ctx.actor.id,operationId,beforeSendMessages:task.beforeSendMessages,state:'pending',expiresAt:retentionDate(ctx.config.settings.auditRetentionDays)};
  if(old)saved=await locks.findOneAndUpdate({...scope,state:'restored'},{$set:values},{new:true});else try{saved=await locks.create({...scope,...values});}catch(e){if(e.code===11000)throw new KageError('CONFLICT_VERSION','Outro bloqueio começou.',409);throw e;}
  requireThat(saved,'CONFLICT_VERSION','Outro bloqueio começou.',409);
  try{await c.channel.permissionOverwrites.edit(ctx.guild.id,{SendMessages:false},{reason:auditReason});await locks.updateOne({...scope,operationId},{$set:{state:'active'}});}catch(e){await locks.updateOne({...scope,operationId},{$set:{state:Number.isInteger(e.status)&&e.status>=400&&e.status<500?'restored':'unknown'}}).catch(()=>{});throw e;}
 }
 if(p.action==='unlock'){
  requireThat(c.lock.operationId===task.lockOperationId&&c.lock.beforeSendMessages===task.beforeSendMessages,'CONFLICT_VERSION','O bloqueio mudou desde a prévia.',409);
  const scope={guildId:ctx.guild.id,channelId:p.channelId,state:'active',operationId:c.lock.operationId};const claim=await locks.findOneAndUpdate(scope,{$set:{state:'restoring'}},{new:true});requireThat(claim,'CONFLICT_VERSION','Restauração já em andamento.',409);
  try{await c.channel.permissionOverwrites.edit(ctx.guild.id,{SendMessages:c.lock.beforeSendMessages},{reason:auditReason});await locks.updateOne({...scope,state:'restoring'},{$set:{state:'restored'}});}catch(e){await locks.updateOne({...scope,state:'restoring'},{$set:{state:Number.isInteger(e.status)&&e.status>=400&&e.status<500?'active':'unknown'}}).catch(()=>{});throw e;}
 }
 if(p.action==='cleanup'){
  const messages=[...(await c.channel.messages.fetch({limit:100})).values()],selected=selectCleanup(messages.filter(m=>task.messageIds.includes(m.id)),{...p.filters,count:100}),ids=selected.eligible.map(m=>m.id);detail={deletedIds:ids,skippedIds:task.messageIds.filter(id=>!ids.includes(id)),tooOldIds:[...(task.excludedOldIds||[]),...selected.tooOld.map(m=>m.id)]};
  if(ids.length===1)await selected.eligible[0].delete();else if(ids.length>1)await ctx.client.rest.post(Routes.channelBulkDelete(p.channelId),{body:{messages:ids},reason:auditReason});
 }
 const row=await punishments.create({id:randomUUID(),guildId:ctx.guild.id,targetId:p.targetId||p.channelId,actorId:ctx.actor.id,action:p.action,reason,durationMinutes:p.minutes,operationId,itemIndex,expiresAt:retentionDate(ctx.config.settings.auditRetentionDays)});
 await auditFn(ctx,auditAction,'confirmed',auditData);
 const {afterModeration}=await import('./moderation-options.js');const notification=await afterModeration(ctx,row).catch(()=>({state:"degraded"}));
 return {notification,kind:'moderation',action:p.action,targetId:p.targetId||p.channelId,punishmentId:row.id,...detail};
}
export function historyFilter(guildId,{targetId,action,cursor,after,before}={}){return {guildId,...(after||before?{createdAt:{...(after?{$gte:new Date(after)}:{}),...(before?{$lte:new Date(before)}:{})}}:{}),expiresAt:{$gt:new Date()},...(targetId?{targetId}:{}),...(action?{action}:{}),...(cursor?{_id:{$lt:cursor}}:{})};}
