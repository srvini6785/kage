import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderBuilderRoles,renderBuilderMessages,renderBuilderSecurity,newBuilderMessage,simplifiedMessageCopy} from '../public/server-builder-ui.js';
import {navigationItems,canonicalPage,pageAllowed} from '../public/navigation.js';
import {newWizard} from '../public/catalog.js';
import {defaultSecurity} from '../bot-shared/security.js';
import {nativeView,bindNative,resetNative} from '../public/native-automod-ui.js';
import {extension} from '../public/extended.js';
import {dashboardConfig} from '../backend/access.js';
import {defaults} from '../src/core/settings.js';

const baseHost=()=>({id:'demo',api:{mode:'demo'},data:{roles:[],channels:[],botPosition:20,config:{settings:{modules:{setup:'disabled'}}}},redraw(){},toast(){}});
const tick=async()=>{for(let n=0;n<4;n++)await new Promise(setImmediate);};
test('Navegação concentra cargos/assistente no construtor e preserva ferramentas completas',()=>{
 const names=navigationItems.map(n=>n[0]);assert.equal(names.filter(n=>n==='builder').length,1);
 for(const old of ['wizard','roles','setup']){assert.ok(!names.includes(old));assert.equal(canonicalPage(old),'builder');}
 assert.ok(names.includes('composer'));assert.ok(names.includes('security'));
 assert.ok(pageAllowed(['view','roles'],'builder'));assert.ok(!pageAllowed(['view'],'builder'));
});
test('Etapas do construtor têm rótulos, IDs únicos e mensagens sem controles de componentes avançados',()=>{
 const d=newWizard();d.roles=[{presetId:'member',name:'Membro',color:'#F26A21',position:2,permissions:[]}];
 d.embeds=[newBuilderMessage('v1',d),newBuilderMessage('v2',d)];d.security.policy=defaultSecurity();
 for(const html of [renderBuilderRoles(d,baseHost()),renderBuilderMessages(d,baseHost()),renderBuilderSecurity(d,baseHost())]){
  const {document}=parseHTML('<main>'+html+'</main>'),ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const el of document.querySelectorAll('input,select,textarea'))assert.ok(el.closest('label')||document.querySelector('label[for="'+el.id+'"]'),el.outerHTML);
 }
 const messages=parseHTML(renderBuilderMessages(d,baseHost())).document;
 assert.equal(messages.querySelectorAll('[data-message-json]').length,0);assert.equal(messages.querySelectorAll('[data-bm-target]').length,2);
});
test('Destino removido permanece visível e não troca automaticamente para outro canal',()=>{
 const d=newWizard(),m=newBuilderMessage('v1',d);m.target.channelKey='apagado';d.embeds=[m];
 const {document}=parseHTML(renderBuilderMessages(d,baseHost())),lost=document.querySelector('option[value="planned:apagado"]');
 assert.ok(lost.hasAttribute('selected'));assert.ok(lost.hasAttribute('disabled'));assert.match(lost.textContent,/Canal removido/);assert.equal(m.target.channelKey,'apagado');
 m.target={channelId:'100000000000000009',channelKey:''};const unavailable=parseHTML(renderBuilderMessages(d,baseHost())).document.querySelector('option[value="existing:100000000000000009"]');assert.ok(unavailable.hasAttribute('selected'));assert.ok(unavailable.hasAttribute('disabled'));assert.match(unavailable.textContent,/indisponível/);
});
test('Cópia simplificada preserva original e recusa texto excessivo sem truncar',()=>{
 const d=newWizard(),old={mode:'v1',title:'Regras',description:'Texto',author:'Equipe',color:'#5865F2',fields:[{name:'Canal',value:'Conversa'}],footer:'Kage',channelId:'100000000000000003',buttons:[{label:'Abrir',url:'https://example.com'}]};
 const before=structuredClone(old),copy=simplifiedMessageCopy(old,d);assert.deepEqual(old,before);
 assert.match(copy.message.description,/Equipe/);assert.match(copy.message.description,/Canal\nConversa/);assert.equal(copy.message.buttons,undefined);assert.equal(copy.message.color,'#5865F2');
 old.description='x'.repeat(4096);const long=structuredClone(old);assert.throws(()=>simplifiedMessageCopy(old,d),/4.096/);assert.deepEqual(old,long);
});
test('Editor nativo conserva rascunhos distintos entre projeto e módulo',t=>{
 const {document,window}=parseHTML('<main id="mount"></main>');globalThis.document=document;resetNative();bindNative(()=>{});
 t.after(()=>{resetNative();delete globalThis.document;});
 const mount=document.querySelector('#mount'),module=baseHost(),builder={...baseHost(),builder:{onNativeRule(){}}};
 function render(host){mount.innerHTML=nativeView(host);for(const el of mount.querySelectorAll('input[type="checkbox"]'))el.checked=el.hasAttribute('checked');}
 function name(text){const input=mount.querySelector('#native-name');input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true}));}
 render(module);name('Filtro individual');render(builder);assert.equal(mount.querySelector('#native-name').value,'Regra Kage');
 name('Filtro do projeto');render(module);assert.equal(mount.querySelector('#native-name').value,'Filtro individual');
 render(builder);assert.equal(mount.querySelector('#native-name').value,'Filtro do projeto');
});
test('Falha ao carregar projeto para sem retry automático e permite tentar novamente',async t=>{
 const {document}=parseHTML('<main id="mount"></main>');globalThis.document=document;extension.reset();
 t.after(()=>{extension.reset();delete globalThis.document;});
 const host=baseHost();host.api={mode:'live',async request(){calls++;if(calls===1)throw new Error('Serviço indisponível');return {version:1,draft:newWizard()};}};
 host.data.scopes=['view','structure'];let calls=0;host.redraw=()=>{document.querySelector('#mount').innerHTML=extension.render('builder',host);};
 host.redraw();await tick();assert.equal(calls,1);assert.match(document.querySelector('#mount').textContent,/Tentar novamente/);
 await tick();assert.equal(calls,1);await extension.action('reload-wizard');await tick();assert.equal(calls,2);assert.ok(document.querySelector('.builder-workspace'));
});
test('Cargo delegado pode administrar cargos sem carregar o rascunho de estrutura',()=>{
 extension.reset();let reads=0;const host=baseHost();host.data.scopes=['view','roles'];host.api={mode:'live',request(){reads++;throw new Error('não deve consultar');}};
 const html=extension.render('builder',host);assert.match(html,/Administração de cargos/);assert.match(html,/data-feature-form="role"/);assert.equal(reads,0);extension.reset();
});
test('Consulta delegada recebe metadados necessários sem expor a configuração privada',()=>{
 const settings=defaults();settings.tickets.categoryId='100000000000000003';settings.tickets.supportRoleId='100000000000000004';settings.logChannelId='100000000000000005';
 const ctx={guild:{id:'guild'},config:{version:2,settings},dashboardScopes:['view','moderation','audit']},safe=dashboardConfig(ctx);
 assert.equal(safe.settings.tickets.retentionDays,7);assert.equal(safe.settings.auditRetentionDays,30);assert.equal(safe.settings.economy.dailyAmount,100);
 assert.equal(safe.settings.tickets.categoryId,undefined);assert.equal(safe.settings.tickets.supportRoleId,undefined);assert.equal(safe.settings.logChannelId,undefined);
 ctx.dashboardScopes.push('settings');assert.equal(dashboardConfig(ctx).settings.tickets.categoryId,settings.tickets.categoryId);
});
