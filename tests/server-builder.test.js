import test from 'node:test';
import assert from 'node:assert/strict';
import {Collection,PermissionsBitField,PermissionFlagsBits as P} from 'discord.js';
import {parse,embedSchema,wizardSchema} from '../bot-shared/schemas.js';
import {builderEmbedSchema,serverMessageSchema} from '../bot-shared/server-messages.js';
import {defaultSecurity} from '../bot-shared/security.js';
import {nativeRuleSchema} from '../bot-shared/native-automod.js';
import {newWizard} from '../public/catalog.js';
import {newBuilderMessage} from '../public/server-builder-ui.js';
import {wizardDiff,checkTask,checkPreviewTasks,previewOperation,processQueuedOperation} from '../backend/operations.js';
import {authorizeDashboard} from '../backend/access.js';
import {hashPlan} from '../src/core/policy.js';
import {memoryModel} from './helpers/memory.js';
const gid='100000000000000001',uid='100000000000000002',cid='100000000000000003',rid='100000000000000004';
function fixture(){
 const rows=new Collection(),effects=[],bits=new PermissionsBitField([P.ManageGuild,P.ManageChannels,P.ManageRoles,P.SendMessages,P.EmbedLinks,P.ViewChannel,P.AttachFiles,P.ReadMessageHistory,P.Connect,P.Speak]);
 const make=(id,name='avisos',type=0)=>({id,guildId:gid,name,type,parentId:null,position:0,flags:{has:()=>false},permissionOverwrites:{cache:new Collection()},permissionsFor:()=>new PermissionsBitField([P.ViewChannel]),send:async payload=>{effects.push({channelId:id,payload});return {id:'message',channelId:id};}});
 const ctx={client:{isReady:()=>true,options:{intents:{has:()=>true}}},guild:{id:gid,ownerId:uid,features:['COMMUNITY'],channels:{fetch:async id=>id?rows.get(id)||null:rows},roles:{everyone:{id:gid},fetch:async()=>new Collection()},autoModerationRules:{fetch:async()=>new Collection()}},actor:{id:uid,permissions:bits,permissionsIn:()=>bits,roles:{highest:{position:20},cache:new Collection([[rid,{}]])}},me:{id:'bot',permissions:bits,permissionsIn:()=>bits,roles:{highest:{position:30}}},config:{version:1,settings:{paused:false,modules:{setup:'enforce',embeds:'enforce'}}}};
 rows.set(cid,make(cid));return {ctx,rows,effects,make};
}
const draft=()=>({...newWizard(),categories:[],channels:[{key:'rules',name:'regras',type:0,topic:'',private:false,parentKey:''}]});
const message=(d,mode='v1')=>newBuilderMessage(mode,d);
const native=(type=1)=>parse(nativeRuleSchema,{name:'Filtro',trigger:type===1?{triggerType:1,triggerMetadata:{keywordFilter:['teste']}}:{triggerType:5,triggerMetadata:{mentionTotalLimit:5}},actions:[{type:1}],enabled:false});
test('Contrato do construtor aceita somente texto e imagens v1/V2; editor completo preserva componentes',()=>{
 for(const mode of ['v1','v2']){const row=message(draft(),mode);assert.equal(parse(builderEmbedSchema,row).message.mode,mode);assert.throws(()=>parse(serverMessageSchema,{...row.message,buttons:[{label:'Ajuda',url:'https://example.com'}]}));assert.throws(()=>parse(serverMessageSchema,{...row.message,sections:[]}));assert.throws(()=>parse(serverMessageSchema,{...row.message,fileAssetIds:[]}));}
 const advanced={mode:'v1',title:'Título',description:'Texto',color:'#F26A21',channelId:cid,buttons:[{label:'Ajuda',url:'https://example.com'}]};assert.equal(parse(embedSchema,advanced).buttons.length,1);const d=draft();d.embeds=[advanced];assert.equal(parse(wizardSchema,d).embeds[0].buttons.length,1);
 const bad=message(draft());bad.target.channelId=cid;assert.throws(()=>parse(builderEmbedSchema,bad));
});
test('Projeto compõe estrutura, cargos, mensagem, política e AutoMod sem produzir efeitos',async()=>{
 const f=fixture(),d=draft();d.roles=[{presetId:'member',name:'Membro',color:'#F26A21',position:2,permissions:[]}];d.embeds=[message(d)];d.security.policy=defaultSecurity();d.security.nativeRules=[{rule:native(),reason:'Filtro da comunidade'}];
 const p=await wizardDiff(f.ctx,parse(wizardSchema,d),{nativeFn:async(_ctx,input)=>({tasks:[{kind:'native-automod',input}],diff:[{kind:'native',name:input.rule.name,action:'create'}]})});
 assert.deepEqual(p.tasks.map(t=>t.kind),['category','channel','role','role-position','embed','security-policy','native-automod']);assert.equal(p.requiredPhrase,'APLICAR PROJETO');assert.equal(p.tasks.find(t=>t.kind==='embed').channelKey,'rules');assert.equal(p.tasks.find(t=>t.kind==='embed').embed.channelId,'');assert.equal(f.effects.length,0);
});
test('Reutilização de canal resolve o destino; conflito e destino sem canal não publicam em outro lugar',async()=>{
 const f=fixture(),d=draft();f.rows.get(cid).name='regras';d.embeds=[message(d)];const p=await wizardDiff(f.ctx,parse(wizardSchema,d));assert.equal(p.channelIds.rules,cid);assert.equal(p.tasks.find(t=>t.kind==='embed').embed.channelId,cid);
 f.rows.get(cid).type=2;const blocked=await wizardDiff(f.ctx,parse(wizardSchema,d));assert.ok(!blocked.tasks.some(t=>t.kind==='embed'));assert.ok(blocked.diff.some(t=>t.kind==='embed'&&t.action==='ignore'));
 d.embeds[0].target.channelKey='missing';await assert.rejects(wizardDiff(f.ctx,parse(wizardSchema,d)),{code:'SCHEMA_INVALID'});
 d.embeds[0].target.channelKey='';assert.ok(!(await wizardDiff(f.ctx,parse(wizardSchema,d))).tasks.some(t=>t.kind==='embed'));assert.equal(f.effects.length,0);
});
test('Mensagem legada com componentes permanece salva e é ignorada pelo construtor limitado',async()=>{
 const f=fixture(),d=draft();d.embeds=[{mode:'v1',title:'Legada',description:'Texto',color:'#F26A21',channelId:cid,buttons:[{label:'Ajuda',url:'https://example.com'}]}];const before=structuredClone(d),p=await wizardDiff(f.ctx,parse(wizardSchema,d));assert.deepEqual(d,before);assert.ok(!p.tasks.some(t=>t.kind==='embed'));assert.match(p.diff.find(t=>t.kind==='embed').note,/preservado/);
});
test('Limite nativo inclui regras existentes e todas as regras planejadas no mesmo projeto',async()=>{
 const f=fixture(),d=draft();d.security.nativeRules=[{rule:native(5),reason:'Uma regra'},{rule:native(5),reason:'Outra regra'}];let planned=0;const options={nativeFn:async()=>{planned++;return {tasks:[],diff:[]};}};await assert.rejects(wizardDiff(f.ctx,parse(wizardSchema,d),options),{code:'NATIVE_LIMIT'});assert.equal(planned,1);
 f.ctx.guild.autoModerationRules.fetch=async()=>new Collection([['existing',{triggerType:5}]]);d.security.nativeRules.pop();planned=0;await assert.rejects(wizardDiff(f.ctx,parse(wizardSchema,d),options),{code:'NATIVE_LIMIT'});assert.equal(planned,0);
});
test('Prévia autoriza cada módulo do projeto; delegação só de estrutura não amplia mensagens, cargos ou segurança',async()=>{
 const f=fixture(),access=memoryModel(),operations=memoryModel(),d=draft();f.ctx.actor.id='delegate';f.ctx.actor.permissions=new PermissionsBitField([P.ManageChannels,P.ManageRoles,P.SendMessages,P.EmbedLinks]);f.ctx.dashboardScopes=['view','structure'];await access.create({guildId:gid,grants:[{roleId:rid,scopes:['structure']}]});const dashboardFn=(ctx,path)=>authorizeDashboard(ctx,path,{access});
 for(const extra of [x=>x.embeds.push(message(x)),x=>x.roles.push({presetId:'member',name:'Membro',color:'#F26A21',position:2,permissions:[]}),x=>x.security.policy=defaultSecurity()]){
  const input=structuredClone(d);extra(input);const payload=await wizardDiff(f.ctx,parse(wizardSchema,input),{securityFn:async(_ctx,p)=>p});await assert.rejects(previewOperation(f.ctx,payload,{operations,dashboardFn,auditFn:async()=>{}}),{code:'GUILD_FORBIDDEN'});
 }
 assert.equal(operations.rows.length,0);assert.equal(f.effects.length,0);
});
test('Canal planejado é permitido só na prévia e mensagem exige permissão atual no destino real',async()=>{
 const f=fixture(),d=draft();d.embeds=[message(d)];const p=await wizardDiff(f.ctx,parse(wizardSchema,d)),t=p.tasks.find(t=>t.kind==='embed');await checkPreviewTasks(f.ctx,p);await assert.rejects(checkTask(f.ctx,t),{code:'CONFLICT_VERSION'});
 const resolved={...t,embed:{...t.embed,channelId:cid}};await checkTask(f.ctx,resolved);f.ctx.me.permissionsIn=()=>new PermissionsBitField([P.ViewChannel]);await assert.rejects(checkTask(f.ctx,resolved),{code:'PERMISSION_MISSING'});assert.equal(f.effects.length,0);
});
test('Worker publica somente no ID confirmado da criação e guarda recibo por mensagem',async()=>{
 const f=fixture(),d=draft();d.embeds=[message(d,'v2')];const payload=await wizardDiff(f.ctx,parse(wizardSchema,d)),operations=memoryModel();await operations.create({id:'job',kind:'dashboard-v2',guildId:gid,actorId:uid,configVersion:1,payload,hash:hashPlan(payload),status:'queued'});const created='100000000000000019',category='100000000000000018',published=[];
 await processQueuedOperation(f.ctx.client,'job',{operations,contextFn:async()=>f.ctx,auditFn:async()=>{},structureFn:async(_ctx,t)=>{const id=t.kind==='category'?category:created;f.rows.set(id,f.make(id,t.kind==='category'?t.name:t.channel.name,t.kind==='category'?4:0));return {resourceId:id,kind:t.kind};},prepareFn:async(_ctx,e)=>({content:e.text}),publicationFn:async(_ctx,e,msg)=>{published.push({e,msg});return {id:'receipt'};}});
 assert.equal(operations.rows[0].status,'applied');assert.equal(f.effects.length,1);assert.equal(f.effects[0].channelId,created);assert.equal(published[0].e.channelId,created);assert.equal(operations.rows[0].result.results.find(r=>r.kind==='embed').publicationId,'receipt');
});
test('Worker interrompe mensagem após falha na criação e não usa um canal existente como fallback',async()=>{
 const f=fixture(),d=draft();d.embeds=[message(d)];const payload=await wizardDiff(f.ctx,parse(wizardSchema,d)),operations=memoryModel();await operations.create({id:'job',kind:'dashboard-v2',guildId:gid,actorId:uid,configVersion:1,payload,hash:hashPlan(payload),status:'queued'});
 await processQueuedOperation(f.ctx.client,'job',{operations,contextFn:async()=>f.ctx,auditFn:async()=>{},structureFn:async(_ctx,t)=>{if(t.kind==='category'){const id='100000000000000018';f.rows.set(id,f.make(id,t.name,4));return {resourceId:id,kind:'category'};}throw Object.assign(new Error('indisponível'),{status:403});}});assert.equal(f.effects.length,0);assert.equal(operations.rows[0].status,'partial');assert.equal(operations.rows[0].result.remaining,1);
});
test('Escopo de mensagens é conferido novamente imediatamente antes do envio do projeto',async()=>{
 const f=fixture(),d=draft();d.categories=[];d.channels=[];const row=message(d);row.target={channelId:cid,channelKey:''};d.embeds=[row];const p=await wizardDiff(f.ctx,parse(wizardSchema,d)),payload={...p,dashboard:true,dashboardPath:'/wizard'},operations=memoryModel();await operations.create({id:'job',kind:'dashboard-v2',guildId:gid,actorId:uid,configVersion:1,payload,hash:hashPlan(payload),status:'queued'});let checks=0;
 await processQueuedOperation(f.ctx.client,'job',{operations,contextFn:async()=>f.ctx,auditFn:async()=>{},dashboardFn:async(_ctx,path)=>{if(path==='/embeds'&&++checks===2)throw Object.assign(new Error('acesso revogado'),{status:403,code:'GUILD_FORBIDDEN'});},prepareFn:async()=>({}),publicationFn:async()=>({id:'never'})});assert.equal(checks,2);assert.equal(f.effects.length,0);assert.equal(operations.rows[0].status,'failed');
});

test('Publicação planejada exige EmbedLinks e anexos antes de criar canais',async()=>{
 const f=fixture(),d=draft();d.embeds=[message(d)];let p=await wizardDiff(f.ctx,parse(wizardSchema,d)),t=p.tasks.find(t=>t.kind==='embed');
 f.ctx.actor.permissions.remove(P.EmbedLinks);
 await assert.rejects(checkTask(f.ctx,t,{plannedChannels:['rules']}),{code:'PERMISSION_MISSING'});
 f.ctx.actor.permissions.add(P.EmbedLinks);t.embed.imageAssetId='12345678-1234-4234-8234-123456789012';let assets=0;
 f.ctx.me.permissions.remove(P.AttachFiles);
 await assert.rejects(checkTask(f.ctx,t,{plannedChannels:['rules'],assetFn:async()=>{assets++;return {};}}),{code:'PERMISSION_MISSING'});
 assert.equal(assets,1);assert.equal(f.effects.length,0);
 await assert.rejects(checkTask(f.ctx,t,{plannedChannels:['rules'],assetFn:async()=>{throw Object.assign(new Error('imagem alheia'),{code:'GUILD_FORBIDDEN'});}}),{code:'GUILD_FORBIDDEN'});
});
test('Revisão do projeto contém a política e todas as regras efetivamente planejadas',async()=>{
 const f=fixture(),d=draft();d.security.policy=defaultSecurity();d.security.nativeRules=[{rule:native(),reason:'Regra explícita'}];
 const p=await wizardDiff(f.ctx,parse(wizardSchema,d),{nativeFn:async(_ctx,input)=>({tasks:[{kind:'native-automod',input}],diff:[]})});
 assert.deepEqual(p.reviewConfig.securityPolicy,p.tasks.find(t=>t.kind==='security-policy').policy);
 assert.deepEqual(p.reviewConfig.nativeRules,p.tasks.filter(t=>t.kind==='native-automod').map(t=>t.input.rule));
 assert.equal(p.reviewConfig.nativeRules[0].enabled,false);assert.equal(p.reviewConfig.securityPolicy.ai.state,'disabled');
});
