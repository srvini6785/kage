import {randomUUID} from 'node:crypto';
import {PermissionFlagsBits as P} from 'discord.js';
import {Operation} from '../src/db.js';
import {context,audit} from '../src/services.js';
import {requireThat,hashPlan} from '../src/core/policy.js';
import {assertRole} from './guards.js';
import {runBatch} from './batch.js';
import {checkModeration,applyModeration} from './moderation.js';
import {nativeCaps} from '../bot-shared/native-automod.js';
import {builderEmbedSchema,builderMessageToEmbed,hasAdvancedBuilderContent} from '../bot-shared/server-messages.js';
import {checkNative,applyNative,nativePlan} from './native-automod.js';
import {structureDiff,checkStructure,applyStructure,overwriteHash} from './structure.js';
import {prepareMessage,recordPublication,checkPublishedTask,applyPublishedTask} from './messages.js';
import {loadAsset} from './media.js';
import {authorizeDashboard} from './access.js';
import {checkModerationOptions,saveModerationOptions} from './moderation-options.js';
import {checkChannelMutation,applyChannelMutation} from './recovery.js';
import {updateSettings} from '../src/services.js';
import {checkRollback,applyRollback} from './rollback.js';
import {checkMemberAutomation,saveMemberAutomation} from './member-automation.js';
import {checkLogPolicy,saveLogPolicy} from './event-logger.js';
import {saveAccess} from './access.js';
import {Schedule} from './models.js';
import {checkSchedule,saveSchedule,checkEvent,applyEvent} from './schedules.js';
import {checkRoleTask,applyRole,rolePlan,applyRoleDelete} from './roles.js';
import {checkSecurityPolicy,saveSecurityPolicy} from './security-engine.js';
import {embedSchema,parse} from '../bot-shared/schemas.js';
export function messagePayload(input,variables={usuario:'Membro',servidor:'Servidor',contagem:'0'}){
 let e=parse(embedSchema,input);const render=s=>s.replace(/\{(usuario|servidor|contagem)\}/g,(_,k)=>String(variables[k]).replace(/@/g,'@\u200b')).replace(/@(everyone|here)/g,'@\u200b$1'),allowedMentions={parse:[],repliedUser:false};
 if(e.mode==='v1')e=parse(embedSchema,{...e,title:render(e.title),description:render(e.description),author:render(e.author),footer:render(e.footer),fields:e.fields.map(f=>({...f,name:render(f.name),value:render(f.value)}))});else e=parse(embedSchema,{...e,text:render(e.text),sections:e.sections.map(s=>({...s,text:render(s.text)}))});
 if(e.mode==='v2')return {flags:32768,allowedMentions,components:[{type:17,accent_color:parseInt(e.color.slice(1),16),components:[{type:10,content:e.text},...(e.separator?[{type:14,spacing:1,divider:true}]:[]),...((e.image||e.imageAssetId)?[{type:12,items:[{media:{url:e.imageAssetId?'attachment://kage-image.png':e.image}}]}]:[]),...e.sections.map(s=>({type:9,components:[{type:10,content:s.text}],accessory:s.button?{type:2,style:5,label:s.button.label,url:s.button.url}:{type:11,media:{url:s.thumbnail}}})),...e.fileAssetIds.map((_,i)=>({type:13,file:{url:'attachment://kage-file-'+i+'.png'}}))]}]};
 return {embeds:[{title:e.title||undefined,description:e.description||undefined,color:parseInt(e.color.slice(1),16),fields:e.fields,...(e.author?{author:{name:e.author}}:{}),...(e.footer?{footer:{text:e.footer}}:{}),...((e.image||e.imageAssetId)?{image:{url:e.imageAssetId?'attachment://kage-image.png':e.image}}:{}),...((e.thumbnail||e.thumbnailAssetId)?{thumbnail:{url:e.thumbnailAssetId?'attachment://kage-thumbnail.png':e.thumbnail}}:{})}],allowedMentions,...(e.buttons.length?{components:[{type:1,components:e.buttons.map(b=>({type:2,style:5,label:b.label,url:b.url}))}]}:{})};
}
export async function wizardDiff(ctx,draft,{securityFn=checkSecurityPolicy,nativeFn=nativePlan}={}){
 const structure=await structureDiff(ctx,draft),tasks=structure.tasks,diff=structure.diff,roles=await ctx.guild.roles.fetch();
 for(const [index,role] of draft.roles.entries()){assertRole(ctx,role);const exists=[...roles.values()].find(r=>r.name===role.name);diff.push({kind:'role',name:role.name,action:exists?'reuse':'create',note:exists?'Cargo existente preservado.':'Criação e posicionamento serão registrados separadamente.'});if(!exists){const p=await rolePlan(ctx,role),roleKey='builder-role-'+index;tasks.push(...p.tasks.map(t=>({...t,roleKey})));}}
 for(const input of draft.embeds){
  let e,channelKey='';
  if(input.kind==='server-message'){
   const item=parse(builderEmbedSchema,input);channelKey=item.target.channelKey;
   if(channelKey){const c=draft.channels.find(c=>c.key===channelKey);requireThat(c&&[0,5].includes(c.type),'SCHEMA_INVALID','Destino da mensagem não é um canal de texto deste projeto.',400);if(!structure.channelIds?.[channelKey]&&!structure.tasks.some(t=>t.kind==='channel'&&t.channel.key===channelKey)){diff.push({kind:'embed',name:'Mensagem · '+c.name,action:'ignore',note:'Canal de destino em conflito ou indisponível; mensagem preservada no rascunho.'});continue;}}
   e=builderMessageToEmbed(item,item.target.channelId||structure.channelIds?.[channelKey]||'');
  }else{if(hasAdvancedBuilderContent(input)){diff.push({kind:'embed',name:'Mensagem avançada do rascunho anterior',action:'ignore',note:'Conteúdo preservado. Publique componentes avançados pelo Editor de embeds completo.'});continue;}e=input;}
  if(e.channelId||channelKey){tasks.push({kind:'embed',embed:e,...(channelKey?{channelKey}:{})});diff.push({kind:'embed',name:e.mode==='v1'?e.title||e.description.slice(0,60):e.text.slice(0,60),action:'publish',note:channelKey?'Destino vinculado ao canal do projeto; o ID só é usado depois da criação confirmada.':'Mensagem de texto e imagens no destino selecionado.'});}
  else diff.push({kind:'embed',name:'Mensagem sem destino',action:'ignore',note:'Mantida somente no rascunho.'});
 }
 const configuredPolicy=draft.security?.policy;
 if(configuredPolicy){const policy=await securityFn(ctx,configuredPolicy);tasks.push({kind:'security-policy',policy});diff.push({kind:'security',name:'Proteções do projeto',action:'edit',note:'Política Kage será aplicada após a estrutura e as mensagens. Estados e exceções foram selecionados explicitamente.'});}
 const nativeCounts=new Map(),nativeRules=draft.security?.nativeRules||[];
 if(nativeRules.length){const current=await ctx.guild.autoModerationRules.fetch({cache:false});for(const rule of current.values())nativeCounts.set(rule.triggerType,(nativeCounts.get(rule.triggerType)||0)+1);}
 for(const item of nativeRules){const type=item.rule.trigger.triggerType,count=(nativeCounts.get(type)||0)+1;requireThat(count<=nativeCaps[type],'NATIVE_LIMIT','O projeto excede o limite nativo deste gatilho, incluindo regras existentes.',409);nativeCounts.set(type,count);const p=await nativeFn(ctx,{action:'create',rule:item.rule,reason:item.reason});tasks.push(...p.tasks);diff.push(...p.diff);}
 if(!configuredPolicy&&!nativeRules.length)diff.push({kind:'security',name:'Segurança',action:'ignore',note:'Nenhuma alteração de segurança foi incluída no projeto.'});
 return {...structure,builderVersion:1,tasks,diff,reviewConfig:{securityPolicy:tasks.find(t=>t.kind==='security-policy')?.policy||null,nativeRules:tasks.filter(t=>t.kind==='native-automod').map(t=>t.input.rule)},requiredPhrase:configuredPolicy||nativeRules.length?'APLICAR PROJETO':'APLICAR'};
}
function plannedMessageTargets(payload){return payload.tasks.filter(t=>t.kind==='channel'&&t.structureVersion===2).map(t=>t.channel.key);}
export async function checkPreviewTasks(ctx,payload,{dashboardFn=authorizeDashboard}={}){for(const t of payload.tasks){if(payload.builderVersion===1&&ctx.dashboardScopes)await dashboardFn(ctx,taskScope(t));await checkTask(ctx,t,{plannedChannels:plannedMessageTargets(payload)});}}
export async function checkTask(ctx,task,{plannedChannels=[],assetFn=loadAsset}={}){
 requireThat(ctx.client.isReady(),'GUILD_NOT_READY','O Kage está desconectado.',409);
 requireThat(!ctx.config.settings.paused||(task.kind==='native-automod'&&task.input.action==='disable'),'GUILD_NOT_READY','As ações estão pausadas.',409);
 if(task.structureVersion===2)await checkStructure(ctx,task);
 if(['category','channel'].includes(task.kind)&&task.structureVersion!==2){
  requireThat(ctx.config.settings.modules.setup==='enforce','GUILD_NOT_READY','Ative o Construtor em Execução nas Configurações.',409);
  requireThat(ctx.actor.permissions.has(P.ManageChannels)&&ctx.me.permissions.has(P.ManageChannels),'PERMISSION_MISSING','É necessário Gerenciar canais.');
  if(task.parentId){const parent=await ctx.guild.channels.fetch(task.parentId);requireThat(parent&&ctx.actor.permissionsIn(parent).has([P.ViewChannel,P.ManageChannels])&&ctx.me.permissionsIn(parent).has([P.ViewChannel,P.ManageChannels]),'PERMISSION_MISSING','Categoria indisponível ou sem permissão.');}
 }
 if(task.kind==='logging-policy')await checkLogPolicy(ctx,task.policy);
 if(task.kind==='role-delete'){const r=await ctx.guild.roles.fetch(task.roleId);requireThat(r,'GUILD_NOT_READY','Cargo indisponível.',409);assertRole(ctx,{position:r.position,permissions:r.permissions.toArray(),riskConfirmation:task.riskConfirmation},r);}
 if(task.kind==='rollback-resource')await checkRollback(ctx,task);
 if(task.kind==='member-automation')await checkMemberAutomation(ctx,task.policy);
 if(task.kind==='guild-invites'){requireThat(ctx.actor.permissions.has(P.ManageGuild)&&ctx.me.permissions.has(P.ManageGuild),'PERMISSION_MISSING','Pausar convites exige Gerenciar servidor.');requireThat(ctx.guild.features.includes('INVITES_DISABLED')===task.before,'CONFLICT_VERSION','Estado de convites mudou.',409);}
 if(task.kind==='channel-mutation')await checkChannelMutation(ctx,task);
 if(task.kind==='settings-restore')requireThat(ctx.actor.permissions.has(P.ManageGuild),'PERMISSION_MISSING','Restauração exige Gerenciar servidor.');
 if(task.kind==='moderation-policy')await checkModerationOptions(ctx,task.policy);
 if(task.kind==='access-config')requireThat(ctx.actor.id===ctx.guild.ownerId,'PERMISSION_MISSING','Delegação exige proprietário.');
 if(task.kind==='event')await checkEvent(ctx,task.event);
 if(task.kind==='schedule-config')await checkSchedule(ctx,task.schedule);
 if(task.kind==='message-edit')await checkPublishedTask(ctx,task);
 if(task.kind==='security-policy')await checkSecurityPolicy(ctx,task.policy);
 if(task.kind==='moderation')await checkModeration(ctx,task.input);
 if(task.kind==='native-automod')await checkNative(ctx,task.input);
 if(['role','role-position'].includes(task.kind))await checkRoleTask(ctx,task);
 if(task.kind==='embed'){const e=parse(embedSchema,task.embed);const assets=[e.imageAssetId,e.thumbnailAssetId,...(e.fileAssetIds||[])].filter(Boolean);for(const id of assets)await assetFn(ctx,id);requireThat(ctx.config.settings.modules.embeds==='enforce','GUILD_NOT_READY','Ative Embeds em Execução.',409);if(task.channelKey&&!task.embed.channelId){requireThat(plannedChannels.includes(task.channelKey),'CONFLICT_VERSION','O canal planejado não foi criado; mensagem não será enviada em outro destino.',409);requireThat(ctx.config.settings.modules.setup==='enforce'&&ctx.actor.permissions.has([P.ManageChannels,P.ViewChannel,P.SendMessages,...(e.mode==='v1'?[P.EmbedLinks]:[]),...(assets.length?[P.AttachFiles]:[])])&&ctx.me.permissions.has([P.ManageChannels,P.ViewChannel,P.SendMessages,...(e.mode==='v1'?[P.EmbedLinks]:[]),...(assets.length?[P.AttachFiles]:[])]),'PERMISSION_MISSING','Sem autorização para criar e publicar no canal planejado.');return;}const c=await ctx.guild.channels.fetch(task.embed.channelId),needed=[P.ViewChannel,P.SendMessages,...(task.embed.mode==='v1'?[P.EmbedLinks]:[]),...((task.embed.imageAssetId||task.embed.thumbnailAssetId||task.embed.fileAssetIds?.length)?[P.AttachFiles]:[])];requireThat(c?.guildId===ctx.guild.id&&[0,5].includes(c.type)&&ctx.actor.permissionsIn(c).has(needed)&&ctx.me.permissionsIn(c).has(needed),'PERMISSION_MISSING','Canal indisponível ou sem permissão.');}
}
export async function previewOperation(ctx,payload,{operations=Operation,auditFn=audit,dashboardFn=authorizeDashboard}={}){payload={...payload,...(ctx.dashboardScopes?{dashboard:true,dashboardPath:ctx.dashboardPath}:{})};await checkPreviewTasks(ctx,payload,{dashboardFn});const plan={id:randomUUID(),guildId:ctx.guild.id,actorId:ctx.actor.id,kind:'dashboard-v2',configVersion:ctx.config.version,payload,hash:hashPlan(payload),status:'preview',expiresAt:new Date(Date.now()+300000)};await auditFn(ctx,'operation.preview','requested',{correlationId:plan.id});await operations.create(plan);await auditFn(ctx,'operation.preview','confirmed',{correlationId:plan.id});return plan;}
export async function launchOperation(client,ctx,id,confirmation='APLICAR',{operations=Operation,auditFn=audit,contextFn=context,schedule=setImmediate,structureFn=applyStructure,dashboardFn=authorizeDashboard,prepareFn=prepareMessage,publicationFn=recordPublication}={}){
 const plan=await operations.findOne({id,guildId:ctx.guild.id,actorId:ctx.actor.id,kind:'dashboard-v2'}).lean();
 requireThat(plan&&!plan.cancelRequested&&plan.status==='preview'&&+new Date(plan.expiresAt)>Date.now()&&plan.configVersion===ctx.config.version&&plan.hash===hashPlan(plan.payload),'CONFLICT_VERSION','Prévia expirada, alterada ou já usada.',409);
 requireThat(confirmation===(plan.payload.requiredPhrase||'APLICAR'),'SECURITY_REVIEW_REQUIRED','Digite exatamente a frase de confirmação da prévia.',409);
 await checkPreviewTasks(ctx,plan.payload,{dashboardFn});await auditFn(ctx,'operation.confirm','requested',{correlationId:id});
 const claim=await operations.findOneAndUpdate({id,guildId:ctx.guild.id,actorId:ctx.actor.id,status:'preview',cancelRequested:{$ne:true}},{$set:{status:'queued'}},{new:true});requireThat(claim,'CONFLICT_VERSION','Operação já confirmada.',409);
 schedule(()=>processQueuedOperation(client,id,{operations,auditFn,contextFn,structureFn,dashboardFn,prepareFn,publicationFn}));return {ok:true,id,state:'queued',correlationId:id,message:'Execução iniciada. Acompanhe os resultados por item.'};
}

export async function processQueuedOperation(client,id,{operations=Operation,auditFn=audit,contextFn=context,structureFn=applyStructure,dashboardFn=authorizeDashboard,prepareFn=prepareMessage,publicationFn=recordPublication}={}){
 const plan=await operations.findOne({id,kind:'dashboard-v2',status:'queued'}).lean();if(!plan)return false;
 if(plan.hash!==hashPlan(plan.payload)){await operations.updateOne({id,status:'queued'},{$set:{status:'failed'}});return false;}
 const workerId=randomUUID(),claim=await operations.findOneAndUpdate({id,status:'queued'},{$set:{status:'running',workerId,leaseUntil:new Date(Date.now()+60000)}},{new:true});if(!claim)return false;
 const ctx={guild:{id:plan.guildId},actor:{id:plan.actorId}};
 const heartbeat=setInterval(()=>operations.updateOne({id,workerId,status:'running'},{$set:{leaseUntil:new Date(Date.now()+60000)}}).catch(()=>{}),10000);heartbeat.unref?.();
 try{
let categoryId=plan.payload.categoryId;const categoryIds={...plan.payload.categoryIds},categoryHashes={},roleIds={...plan.payload.roleIds},channelIds={...plan.payload.channelIds};const resolved=t=>t.kind==='embed'&&t.channelKey?{...t,embed:{...t.embed,channelId:t.embed.channelId||channelIds[t.channelKey]||''}}:t.kind==='role-position'?{...t,roleId:t.roleId||roleIds[t.roleKey]}:t.structureVersion===2&&t.kind==='channel'?{...t,parentId:t.parentId||categoryIds[t.parentKey],parentHash:t.parentHash||categoryHashes[t.parentKey],...(t.overwrites?{overwrites:t.overwrites.map(o=>({...o,id:o.id||roleIds[o.roleKey]}))}:{})}:t.structureVersion===2&&t.overwrites?{...t,overwrites:t.overwrites.map(o=>({...o,id:o.id||roleIds[o.roleKey]}))}:t;
  try{const result=await runBatch(plan.payload.tasks,{
   authorize:async t=>{if(plan.payload.scheduleId){const schedule=await Schedule.findOne({id:plan.payload.scheduleId,guildId:plan.guildId,version:plan.payload.scheduleVersion,cancelRequested:{$ne:true}}).lean();requireThat(schedule,'CONFLICT_VERSION','Agendamento cancelado ou alterado.',409);}const active=await operations.findOne({id,workerId,status:'running'}).lean();requireThat(active&&+new Date(active.leaseUntil)>Date.now(),'CONFLICT_VERSION','Lease da operação perdida; reconcilie antes de repetir.',409);const fresh=await contextFn(client,ctx.guild.id,ctx.actor.id,{manager:!plan.payload.dashboard&&plan.payload.access!=='moderation'});requireThat(fresh.config.version===plan.configVersion,'CONFLICT_VERSION','Configuração mudou.',409);if(plan.payload.dashboard){await dashboardFn(fresh,plan.payload.dashboardPath||taskScope(t));if(plan.payload.builderVersion===1)await dashboardFn(fresh,taskScope(t));}await checkTask(fresh,resolved(t));},
   effect:async(t,index)=>{const fresh=await contextFn(client,ctx.guild.id,ctx.actor.id,{manager:!plan.payload.dashboard&&plan.payload.access!=='moderation'});requireThat(fresh.config.version===plan.configVersion,'CONFLICT_VERSION','Configuração mudou.',409);if(plan.payload.dashboard){await dashboardFn(fresh,plan.payload.dashboardPath||taskScope(t));if(plan.payload.builderVersion===1)await dashboardFn(fresh,taskScope(t));}await checkTask(fresh,resolved(t));
    if(t.kind==='logging-policy')return saveLogPolicy(fresh,t.policy);
    if(t.kind==='role-delete')return applyRoleDelete(fresh,t,id);
    if(t.kind==='rollback-resource')return applyRollback(fresh,t,id);
    if(t.kind==='member-automation')return saveMemberAutomation(fresh,t.policy);
    if(t.kind==='guild-invites'){await fresh.guild.disableInvites(t.disabled);return {kind:t.kind,before:t.before,disabled:t.disabled};}
    if(t.kind==='channel-mutation')return applyChannelMutation(fresh,t,id);
    if(t.kind==='settings-restore'){const settings=structuredClone(t.settings);settings.logChannelId=channelIds['channel-'+settings.logChannelId]||settings.logChannelId;settings.tickets.categoryId=categoryIds['cat-'+settings.tickets.categoryId]||settings.tickets.categoryId;settings.tickets.supportRoleId=roleIds[settings.tickets.supportRoleId]||settings.tickets.supportRoleId;await updateSettings(fresh,{version:t.version,settings});return {kind:'settings-restore'};}
    if(t.kind==='moderation-policy')return saveModerationOptions(fresh,t.policy);
    if(t.kind==='access-config')return saveAccess(fresh,t.access);
    if(t.kind==='event')return applyEvent(fresh,t,id);
    if(t.kind==='schedule-config')return saveSchedule(fresh,t.schedule);
    if(t.kind==='message-edit')return applyPublishedTask(fresh,t,id);
    if(t.kind==='security-policy')return saveSecurityPolicy(fresh,t.policy);
    if(t.kind==='moderation')return applyModeration(fresh,t,id,index);
    if(t.kind==='native-automod')return applyNative(fresh,t,id,index);
    if(t.structureVersion===2){const task=resolved(t),r=await structureFn(fresh,task,id);if(t.kind==='category'){categoryIds[t.key]=r.resourceId;categoryHashes[t.key]=r.categoryHash;}else channelIds[t.channel.key]=r.resourceId;return r;}
    if(t.kind==='category'){const c=await fresh.guild.channels.create({name:t.name,type:4,reason:'Kage '+id});categoryId=c.id;return {resourceId:c.id,kind:t.kind};}
    if(t.kind==='channel'){const c=t.channel,result=await fresh.guild.channels.create({name:c.name,type:c.type,parent:t.parentId||categoryId,topic:c.type===0?c.topic+' · Kage '+id:undefined,...(c.private?{permissionOverwrites:[{id:fresh.guild.id,deny:[P.ViewChannel]},{id:fresh.actor.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:fresh.me.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]}]}:{}),reason:'Kage '+id});return {resourceId:result.id,kind:t.kind};}
    if(['role','role-position'].includes(t.kind)){const r=await applyRole(fresh,resolved(t),id,{assetFn:loadAsset});if(t.kind==='role')roleIds[t.roleKey]=r.resourceId;return r;}
    const task=resolved(t),c=await fresh.guild.channels.fetch(task.embed.channelId),payload=await prepareFn(fresh,task.embed),msg=await c.send(payload);const publication=await publicationFn(fresh,task.embed,msg);return {resourceId:msg.id,channelId:c.id,publicationId:publication.id,kind:t.kind};
   },
   cancelled:async()=>Boolean((await operations.findOne({id,guildId:ctx.guild.id}).lean())?.cancelRequested),
   checkpoint:async r=>{await operations.updateOne({id,guildId:ctx.guild.id,workerId,status:'running'},{$set:{status:'running',result:r,leaseUntil:new Date(Date.now()+60000)}});}
  });await operations.updateOne({id,guildId:ctx.guild.id,workerId,status:'running'},{$set:{status:result.state,result,leaseUntil:null}});await auditFn(ctx,'operation.execute',result.state,{correlationId:id});}
  catch{await operations.updateOne({id,guildId:ctx.guild.id,workerId,status:'running'},{$set:{status:'unknown',leaseUntil:null}}).catch(()=>{});}

 }finally{clearInterval(heartbeat);}return true;
}
export function startOperationWorker(client,{operations=Operation,intervalMs=2000}={}){let busy=false;const tick=async()=>{if(busy||!client.isReady())return;busy=true;try{await operations.updateMany({kind:'dashboard-v2',status:'running',leaseUntil:{$lt:new Date()}},{$set:{status:'unknown','result.state':'unknown'}});const jobs=await operations.find({kind:'dashboard-v2',status:'queued'}).sort({createdAt:1}).limit(5).lean();for(const job of jobs)await processQueuedOperation(client,job.id,{operations});}catch{console.error('Kage worker: DATABASE_UNAVAILABLE');}finally{busy=false;}};const timer=setInterval(tick,intervalMs);timer.unref?.();void tick();return {tick,stop:()=>clearInterval(timer)};}

function taskScope(t){if(t.kind==='moderation')return '/moderation';if(t.kind.includes('role'))return '/roles';if(t.kind.includes('security')||t.kind.includes('native'))return '/security';if(t.kind==='embed'||t.kind==='message-edit')return '/embeds';if(t.kind.includes('schedule')||t.kind==='event')return '/schedules';if(t.kind.includes('restore')||t.kind.includes('rollback'))return '/backup';if(t.kind==='access-config')return '/access';return '/wizard';}
