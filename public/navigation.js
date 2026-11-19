export const navigationItems=[
 ['overview','Visão geral','grid'],['builder','Construtor de servidores','layout'],
 ['_','Administração'],['security','Segurança','shield'],['moderation','Moderação','shield'],['composer','Editor de embeds','message'],
 ['_','Comunidade'],['tickets','Tickets','ticket'],['levels','Níveis e XP','chart'],['economy','Economia','coins'],['schedules','Agendamentos','history'],
 ['_','Servidor'],['logs','Atividades','history'],['backups','Backups','download'],['governance','Equipe e acessos','users'],['settings','Configurações','settings'],
 ['_','Conta'],['profile','Minha conta','users'],['documents','Documentos','book']
];
export const legacyPages=['wizard','roles','setup','embeds'];
export function canonicalPage(page){return ({wizard:'builder',roles:'builder',setup:'builder',embeds:'composer'})[page]||page;}
export function pageScope(page){return ({builder:'structure',wizard:'structure',setup:'structure',security:'security',automod:'security',antinuke:'security',roles:'roles',composer:'messages',embeds:'messages',moderation:'moderation',tickets:'moderation',backups:'backups',schedules:'schedules',logs:'audit',settings:'settings',governance:'audit'})[page]||'view';}
export function pageAllowed(scopes,page){if(!scopes)return true;if(['profile','home','about','invite','support','documents','help'].includes(page)||page.startsWith('legal-'))return true;if(canonicalPage(page)==='builder')return scopes.includes('structure')||scopes.includes('roles');return scopes.includes(pageScope(page));}
