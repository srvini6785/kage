export const BRAND={name:'Kage',version:'0.6.5',author:'Feito por Marcos Vinicius',support:'Apoio e direcionamento: SVR Company',supportUrl:'[LINK_SERVIDOR_SVR]'};
const template=(id,name,names,options={})=>({id,name,version:2,author:'Marcos Vinicius',description:'Estrutura editável; objetos existentes são preservados.',permissions:['ManageChannels'],categories:[{key:id+'-root',name:'comunidade-'+id,private:false}],channels:names.split('|').map((name,i)=>({key:'channel-'+i,name,type:['voz','salas-de-estudo'].includes(name)?2:name==='fórum'?15:['anúncios','avisos'].includes(name)?5:0,topic:'',private:['equipe','staff','logs'].includes(name),parentKey:id+'-root'})),...options});
export const templates=[
 template('emoji','Com emoji','informações|conversa|mídia|voz|eventos',{emoji:true}),
 template('plain','Sem emoji','informações|comunidade|suporte|voz'),
 template('separator','Com separador','informações|comunidade|suporte',{separator:true}),
 template('no-separator','Sem separador','informações|conversa|suporte|voz'),
 template('minimal','Minimalista','regras|geral|mídia|voz|suporte'),
 template('complete','Completo','anúncios|fórum|eventos|tickets|mídia|staff|voz'),
 template('gamer','Gamer','lobby|procura-de-grupo|clips|campeonatos|voz'),
 template('study','Comunidade de estudos','avisos|disciplinas|dúvidas|materiais|salas-de-estudo'),
 template('store','Loja e vendas','catálogo|pedidos|suporte|avisos|equipe'),
 template('roleplay','Roleplay','lore|fichas|regras|cenas|suporte|staff'),
 template('creator','Criação de conteúdo','briefings|divulgação|collabs|eventos|feedback'),
 template('support','Suporte e tickets','entrada|tickets|equipe|faq|logs'),
 template('music','Música e eventos','agenda|palco|feedback|voz')
];
export const rolePresets=[
 {id:'decoration',name:'Cargo de enfeite',permissions:[],description:'Aparência sem privilégios.'},
 {id:'member',name:'Cargo de membro',permissions:[],description:'Acesso depende de configuração explícita por canal.'},
 {id:'vip',name:'VIP',permissions:[],description:'Benefícios visuais, sem poderes de moderação.'},
 {id:'vip-plus',name:'VIP mais potente',permissions:[],description:'Acima do VIP, sem acesso de staff.'},
 {id:'boost',name:'Boost de 2 impulsos',permissions:[],description:'A API não comprova dois boosts individuais. Use benefício de booster ativo + patamar da guilda em Segurança. Não duplica o cargo nativo.',disabled:true},
 {id:'junior',name:'Staff júnior',permissions:['ModerateMembers','ManageMessages'],description:'As permissões nativas não limitam duração ou quantidade fora do Kage. Revise o escopo.'},
 {id:'middle',name:'Staff médio',permissions:['KickMembers','ModerateMembers','ManageMessages'],description:'Moderação com motivo e hierarquia.'},
 {id:'senior',name:'Staff sênior',permissions:['KickMembers','BanMembers','ModerateMembers','ManageMessages','ManageChannels','ViewAuditLog'],description:'Permissões granulares de canais e moderação.'},
 {id:'admin',name:'Administração',permissions:['Administrator'],description:'Ignora sobrescritas de canal. Prefira Staff sênior.',risk:'critical'}
].map((p,i)=>({version:1,color:'#F26A21',position:i+1,...p}));
export const securityControls=[
 ['native','AutoMod nativo','Regras da plataforma, separadas das regras Kage.','ManageGuild','Limites por gatilho e exceções.','Desativar a regra nativa.'],
 ['mentions','Spam de menções','Sinais de flood e menções na base existente.','ManageMessages','Pode sinalizar conversas movimentadas.','Desativar AutoMod.'],
 ['raid','Anti-raid','Entradas em massa e contas recentes são sinais para revisão.','ManageGuild','Eventos atrasados não autorizam punição.','Retirar quarentena após revisão.'],
 ['ai','Filtro de burlas com IA','Somente registro; provedor não aprovado.','ManageMessages','Ironia e baixa confiança exigem revisão humana.','Desativar análise e aplicar retenção.'],
 ['verification','Verificação de membros','Botão, reação ou captcha conforme implementação aprovada.','ManageRoles','Pode bloquear membros legítimos.','Remover a restrição.'],
 ['invites','Proteção de convites','Allowlist de convites externos.','ManageMessages','Exceções amplas podem permitir abuso.','Desativar a regra.'],
 ['new-accounts','Contas novas','Idade não é prova de abuso.','ManageGuild','Priorizar aviso e revisão.','Retirar quarentena.'],
 ['emergency','Emergência','Contenção com estado anterior.','ManageChannels','Afeta comunicação e exige confirmação forte.','Restaurar somente as permissões alteradas.'],
 ['sensitive-roles','Cargos sensíveis','Impedir concessão automática de staff.','ManageRoles','Regra nunca eleva o próprio ator.','Revogar apenas concessões auditadas.'],
 ['custom','Regras customizadas','Gatilhos e ações declarativas.','ManageGuild','Código livre e regex arbitrária são proibidos.','Pausar a regra preservando evidência.'],
 ['audit','Auditoria de segurança','Ator, resultado e correlação sem mensagens completas.','ViewAuditLog','Retenção configurável, sem histórico eterno.','Ajustar retenção.'],
 ['kill-switch','Pausa por módulo','Interrompe efeitos sem apagar registros.','ManageGuild','Revisar operações em andamento.','Reativar após revisar o incidente.']
].map(([id,name,benefit,permission,risk,rollback])=>({id,name,benefit,permission,risk,rollback,available:['native','mentions','raid','verification','invites','new-accounts','emergency','sensitive-roles','custom','audit','kill-switch','ai'].includes(id),intents:id==='mentions'?['MessageContent']:[],data:'IDs, configuração e evidência mínima'}));
export function newWizard(){const t=templates.find(t=>t.id==='minimal');return {step:1,templateId:t.id,templateVersion:t.version,style:{emoji:false,separator:false},categories:structuredClone(t.categories),channels:structuredClone(t.channels),roles:[],embeds:[],security:{automod:'disabled',antinuke:'disabled'},rules:[],language:'pt-BR',timezone:'America/Sao_Paulo'};}
export const moderationCommands=['ban','kick','timeout','warn','unwarn','warnings','unban','lista-bans','slowmode','lock','unlock','limpar','cargo'];
