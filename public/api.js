import { demoDefaults, demoGuilds } from './data.js';
const clone = x => structuredClone(x);
const storageKey = id => 'kage:demo:v1:' + id;
function getDemo(id) {
  try { const x = JSON.parse(localStorage.getItem(storageKey(id))); if(x?.config?.settings && x?.guild?.id === id) return x; } catch {}
  return demoDefaults(id);
}
function saveDemo(id, state) {
  try { localStorage.setItem(storageKey(id), JSON.stringify(state)); } catch { throw new Error('O navegador não permitiu salvar a demonstração.'); }
}
export const api = {
  mode: 'loading', csrf: '', user: null,
  async init() {
    Object.assign(this,{mode:'loading',user:null,csrf:'',discordReady:false,messageContent:false,preferences:{},preferencesError:null});
    try {
      const runtime = await fetch('./runtime.json', { cache: 'no-store', credentials:'same-origin', signal: AbortSignal.timeout(20000) });
      if (!runtime.ok) throw new Error('Não foi possível verificar o ambiente do Kage.');
      const descriptor = await runtime.json().catch(()=>null);
      if(descriptor?.mode !== 'live') throw new Error('Ambiente desconhecido. Nenhuma ação foi habilitada.');
      const data = await this.request('bootstrap');
      if(data?.mode!=='live'||!(data.user===null||typeof data.user?.id==='string'&&typeof data.user?.username==='string')||data.user&&typeof data.csrf!=='string')throw new Error('O serviço não confirmou seu estado. Tente atualizar a página.');
      this.mode = 'live'; this.user = data.user; this.csrf = data.csrf; this.discordReady = data.discordReady;
      this.messageContent = data.messageContent;
      if(this.user){
        try{const me=await this.request('me');this.preferences=me.preferences||{};if(['light','dark'].includes(this.preferences.theme))document.documentElement.dataset.theme=this.preferences.theme;}
        catch(e){if(e.status===401)throw e;this.preferencesError='Suas preferências não foram carregadas. '+e.message;}
      }
    } catch(e) { this.mode=e.status===401?'live':'unavailable';this.user=null;this.csrf='';throw e; }
  },
  async request(path, method = 'GET', body, {background=false}={}) {
    let res;
    try { res = await fetch('./api/' + path, { method, cache:'no-store', credentials:'same-origin', headers: { 'Content-Type': 'application/json', ...(background?{'X-Kage-Background':'1'}:{}), ...(!['GET','HEAD'].includes(method)?{'Idempotency-Key':crypto.randomUUID()}:{}), ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) }); }
    catch { throw Object.assign(new Error('A conexão não respondeu. Tente novamente; se estava salvando, confira a operação antes de repetir.'),{code:'NETWORK_UNAVAILABLE'}); }
    const data = await res.json().catch(()=>undefined);
    if(res.status===401){this.user=null;this.csrf='';this.preferences={};throw Object.assign(new Error('Sua sessão expirou ou foi revogada. Entre novamente com Discord.'),{status:401,code:'AUTH_REQUIRED'});}
    if(!res.ok||data===undefined){const e=new Error((data?.message||(res.status===429?'Muitas solicitações. Aguarde um minuto e tente novamente.':'O serviço não confirmou seu estado. Tente atualizar a página.'))+(data?.requestId?' Referência: '+data.requestId:''));Object.assign(e,{status:res.status,code:data?.code,state:data?.state,fieldErrors:data?.fieldErrors});throw e;}
    return data;
  },
  async guilds() { return this.mode === 'demo' ? clone(demoGuilds) : this.request('guilds'); },
  async state(id) { return this.mode === 'demo' ? clone(getDemo(id)) : this.request('guilds/' + encodeURIComponent(id) + '/state'); },
  async save(id, version, settings) {
    if(this.mode !== 'demo') return this.request('guilds/' + id + '/config', 'PUT', { version, settings });
    const s = getDemo(id);
    if(s.config.version !== version) throw new Error('A configuração mudou em outra aba. Atualize antes de salvar.');
    s.config.settings = clone(settings); s.config.version++;
    s.logs.unshift({ id: 'demo-' + crypto.randomUUID(), action: 'config.update', actorId: 'Marcos', result: 'simulated', createdAt: new Date().toISOString() });
    s.logs = s.logs.slice(0, 60); saveDemo(id, s); return clone(s.config);
  },
  async plan(id, kind, payload) {
    if(this.mode !== 'demo') return this.request('guilds/' + id + '/plans', 'POST', kind === 'setup' ? { kind, template: payload.template } : { kind, payload });
    const s = getDemo(id);
    if(s.config.settings.paused || s.config.settings.modules[kind === 'embed' ? 'embeds' : kind] !== 'enforce') throw new Error('Selecione o modo Execução neste módulo e salve antes de gerar o plano.');
    return { id: crypto.randomUUID(), guildId: id, actorId: 'demo', configVersion: s.config.version, kind, payload: clone(payload), expiresAt: Date.now() + 300000 };
  },
  async confirm(id, plan) {
    if(this.mode !== 'demo') return this.request('guilds/' + id + '/plans/' + plan.id + '/confirm', 'POST', {});
    const s = getDemo(id);
    if(plan.guildId !== id || plan.configVersion !== s.config.version || plan.expiresAt < Date.now() || plan.used || s.config.settings.paused) throw new Error('Plano expirado, usado ou configuração alterada. Gere outra prévia.');
    plan.used = true;
    if(plan.kind === 'setup') {
      if (s.channels.some(c => c.name === plan.payload.category)) throw new Error('Já existe uma categoria desse modelo na demonstração.');
      s.channels.push({ id: 'demo-' + crypto.randomUUID(), name: plan.payload.category, type: 4 }, ...plan.payload.channels.map(name => ({ id: 'demo-' + crypto.randomUUID(), name, type: 0 })));
    }
    s.logs.unshift({ id: plan.id, action: plan.kind + '.execute', actorId: 'Marcos', result: 'simulated', createdAt: new Date().toISOString() });
    saveDemo(id, s);
    return { message: 'Simulação concluída. Nenhuma alteração foi enviada ao Discord.' };
  },
  reset(id) { localStorage.removeItem(storageKey(id)); },
  async logout() { if(this.mode === 'live') await this.request('logout', 'POST', {}); location.reload(); }
};
