export const moduleInfo = {
  automod: { name: 'AutoMod', icon: 'shield', desc: 'Menos spam. Mais espaço para boas conversas.', detail: 'Regras determinísticas de flood e menções. Análise por IA ainda não conectada.', note: 'Regras de mensagens' },
  antinuke: { name: 'Anti-nuke', icon: 'bolt', desc: 'Um olhar atento às mudanças no seu servidor.', detail: 'Monitora padrões de auditoria e alerta a equipe. Esta versão não pune membros automaticamente.', note: 'Proteção administrativa' },
  tickets: { name: 'Tickets', icon: 'ticket', desc: 'Cada conversa no lugar certo, do início ao fim.', detail: 'Atendimento privado com cargo de suporte, encerramento e transcrições protegidas.', note: 'Central de atendimento' },
  levels: { name: 'Níveis & XP', icon: 'chart', desc: 'Reconheça quem faz sua comunidade acontecer.', detail: 'XP por servidor, cooldown e filtro contra mensagens repetidas.', note: 'Progresso da comunidade' },
  economy: { name: 'Economia', icon: 'coins', desc: 'Uma recompensa a mais para participar.', detail: 'Saldo e recompensa diária em moeda virtual, sem valor em dinheiro.', note: 'Moedas virtuais' },
  embeds: { name: 'Embeds', icon: 'message', desc: 'Anúncios com a personalidade da sua comunidade.', detail: 'Crie uma mensagem, confira a prévia e confirme a publicação.', note: 'Mensagens personalizadas' },
  setup: { name: 'Construtor', icon: 'layout', desc: 'Uma boa estrutura para o seu próximo começo.', detail: 'Modelos de categorias e canais. A execução exige prévia e confirmação.', note: 'Estrutura do servidor' }
};
export const demoGuilds = [{ id: 'demo-kage', name: 'Kage Community', memberCount: 2486 }, { id: 'demo-svr', name: 'SVR · Laboratório', memberCount: 148 }];
export function demoDefaults(id) {
  const lab = id === 'demo-svr';
  const settings = { modules: { automod: 'observe', antinuke: 'observe', tickets: 'enforce', levels: 'enforce', economy: 'disabled', embeds: 'enforce', setup: 'disabled' }, automod: { maxMessages: 6, windowSeconds: 10, maxMentions: 6, deleteSpam: false }, antinuke: { threshold: 5, windowSeconds: 30 }, tickets: { categoryId: 'demo-category', supportRoleId: 'demo-support', maxOpen: 1, retentionDays: 7 }, levels: { xpPerMessage: 15, cooldownSeconds: 60 }, economy: { dailyAmount: 100 }, logChannelId: 'demo-logs', auditRetentionDays: 30, paused: false };
  const now = Date.now();
  return { config: { guildId: id, version: 1, settings }, guild: demoGuilds.find(g => g.id === id), logs: [
    { id: 'demo-1', action: 'ticket.open', actorId: 'Luna', targetId: '#0003', result: 'confirmed', createdAt: new Date(now - 120000).toISOString() },
    { id: 'demo-2', action: 'automod.spam', actorId: 'Membro exemplo', targetId: '#geral', result: 'observed', createdAt: new Date(now - 480000).toISOString() },
    { id: 'demo-3', action: 'config.update', actorId: 'Marcos', result: 'confirmed', createdAt: new Date(now - 1500000).toISOString() },
    { id: 'demo-4', action: 'ticket.close', actorId: 'Equipe de suporte', targetId: '#0002', result: 'confirmed', createdAt: new Date(now - 3600000).toISOString() },
    { id: 'demo-5', action: 'antinuke.pattern', actorId: 'Operador exemplo', result: 'review', createdAt: new Date(now - 7200000).toISOString() }
  ], tickets: lab ? [] : [
    { id: 'demo-ticket-3', displayId: '0003', ownerId: 'Luna', state: 'open', channelId: 'demo-help', createdAt: new Date(now - 120000).toISOString() },
    { id: 'demo-ticket-2', displayId: '0002', ownerId: 'Rafael', state: 'closed', channelId: 'demo-help', createdAt: new Date(now - 86400000).toISOString() },
    { id: 'demo-ticket-1', displayId: '0001', ownerId: 'Sofia', state: 'open', channelId: 'demo-help', createdAt: new Date(now - 9000000).toISOString() },
    { id: 'demo-ticket-0', displayId: '0004', ownerId: 'Theo', state: 'open', channelId: 'demo-help', createdAt: new Date(now - 1800000).toISOString() }
  ], profiles: (lab ? ['Kai', 'Lia', 'Noah'] : ['Luna', 'Rafael', 'Sofia', 'Theo', 'Nina', 'Kai', 'Lia', 'Noah']).map((name, i) => ({ userId: name, xp: 18250 - i * 1735, wallet: 500 + (8 - i) * 100, level: Math.floor(Math.sqrt((18250 - i * 1735) / 100)) })), channels: [{ id: 'demo-general', name: 'geral', type: 0 }, { id: 'demo-announcements', name: 'avisos', type: 0 }, { id: 'demo-logs', name: 'kage-logs', type: 0 }, { id: 'demo-help', name: 'atendimento', type: 0 }, { id: 'demo-category', name: 'ATENDIMENTO', type: 4 }], roles: [{ id: 'demo-support', name: 'Equipe de suporte' }, { id: 'demo-mod', name: 'Moderação' }], discordReady: false };
}
export const actionNames = { 'ticket.open': 'Novo ticket aberto', 'ticket.close': 'Ticket encerrado', 'ticket.export': 'Transcrição exportada', 'automod.spam': 'Sinal de spam identificado', 'automod.delete': 'Mensagem removida', 'config.update': 'Configuração atualizada', 'antinuke.pattern': 'Padrão administrativo sinalizado', 'setup.execute': 'Estrutura do servidor', 'setup.preview': 'Prévia de estrutura criada', 'embed.execute': 'Publicação de embed', 'embed.preview': 'Prévia de embed criada', 'ban.execute': 'Ação de banimento', 'moderation.timeout': 'Timeout de membro' };
