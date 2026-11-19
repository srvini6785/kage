import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {api} from '../public/api.js';
import {extension} from '../public/extended.js';
import {demoDefaults,demoGuilds} from '../public/data.js';
import {dashboardConfig} from '../backend/access.js';
const tick=async()=>{for(let n=0;n<6;n++)await new Promise(setImmediate);};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
test('Painel completo mantém rotas, drawer acessível e consulta delegada sem formulários privados',async t=>{
 const {document,window}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
 const timers=new Set(),originalTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{const id=originalTimeout(fn,ms,...args);timers.add(id);return id;};
 const globals=['document','window','location','localStorage','sessionStorage'],before=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.assign(globalThis,{document,window,location:new URL('http://127.0.0.1/#overview'),localStorage:storage(),sessionStorage:storage()});window.scrollTo=()=>{};
 const methods={init:api.init,guilds:api.guilds,state:api.state};let state=demoDefaults(demoGuilds[0].id);
 api.init=async()=>{api.mode='demo';api.user={username:'Marcos Vinicius'};};api.guilds=async()=>structuredClone(demoGuilds);api.state=async()=>structuredClone(state);
 t.after(()=>{extension.reset();for(const id of timers)clearTimeout(id);globalThis.setTimeout=originalTimeout;Object.assign(api,methods);for(const k of globals){if(before[k])Object.defineProperty(globalThis,k,before[k]);else delete globalThis[k];}});
 await import('../public/app.js');await tick();
 assert.equal(document.querySelector('h1').textContent,'Visão geral');
 const menu=document.querySelector('#menu-toggle'),sidebar=document.querySelector('#sidebar');
 const route=async page=>{location.hash=page;window.dispatchEvent(new window.Event('hashchange'));await tick();};
 menu.click();assert.equal(menu.getAttribute('aria-expanded'),'true');assert.ok(sidebar.classList.contains('open'));
 await route('documents');assert.equal(menu.getAttribute('aria-expanded'),'false');assert.ok(!sidebar.classList.contains('open'));assert.match(document.querySelector('#main').textContent,/Documentos/);assert.match(document.querySelector('#route-status').textContent,/Informações/);
 menu.click();const escape=new window.Event('keydown',{cancelable:true});escape.key='Escape';window.dispatchEvent(escape);assert.equal(menu.getAttribute('aria-expanded'),'false');assert.ok(escape.defaultPrevented);
 await route('roles');assert.match(document.querySelector('#breadcrumb-page').textContent,/Construtor/);assert.match(document.querySelector('[aria-current="step"]').textContent,/Cargos/);assert.match(document.querySelector('#route-status').textContent,/Construtor/);
 for(const page of ['builder','composer','security','moderation','schedules','backups','governance','profile','logs','settings','tickets','automod','antinuke','levels','economy','about','support']){await route(page);assert.ok(document.querySelector('#main').textContent.trim(),page);assert.ok(!document.querySelector('#main').textContent.includes('Conexão indisponível.'),page);}
 assert.ok(document.querySelector('#navigation a[href="#composer"]'));assert.ok(document.querySelector('#navigation a[href="#security"]'));assert.equal(document.querySelector('#navigation a[href="#roles"]'),null);
 state.scopes=['view','moderation','audit'];state.config=dashboardConfig({guild:state.guild,config:state.config,dashboardScopes:state.scopes});
 document.querySelector('#refresh').click();await tick();
 for(const page of ['levels','economy','tickets','logs']){await route(page);assert.ok(!document.querySelector('#main form[data-form="module"]'),page);assert.ok(!document.querySelector('#main [data-action="ticket-settings"]'),page);assert.ok(!document.querySelector('#main').textContent.includes('undefined'),page);}
 await route('builder');assert.match(document.querySelector('#main').textContent,/Acesso indisponível/);assert.match(document.querySelector('#route-status').textContent,/Acesso indisponível/);
 document.querySelector('#route-status').textContent='';document.querySelector('#refresh').click();await tick();assert.equal(document.querySelector('#route-status').textContent,'');
 await route('automod');assert.match(document.querySelector('#route-status').textContent,/Acesso indisponível/);
});
