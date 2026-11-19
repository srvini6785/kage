# Moderação 0.3.0

| Superfície | Permissão mínima do operador e Kage | Efeito e limite |
| --- | --- | --- |
| /ban, /banir e lote no painel | BanMembers + hierarquia | Não apaga histórico de mensagens; prévia/confirmar |
| /kick | KickMembers + hierarquia | Expulsão confirmada; retorno depende de convite |
| /timeout | ModerateMembers + hierarquia | Até 28 dias no contrato; comando legado mantém até 60 minutos |
| /warn, /unwarn, /warnings | ModerateMembers | Aviso com retenção; revogação preserva o registro |
| /unban, /lista-bans | BanMembers | Desbanir com prévia; leitura limitada a 50 resultados |
| /slowmode | ManageChannels no canal | 0–21600 segundos; para se mudou desde a prévia |
| /lock, /unlock | ManageRoles no canal | Somente SendMessages de @everyone; snapshot com prazo |
| /limpar | ManageMessages + ReadMessageHistory + ViewChannel | Examina até 100 mensagens recentes; não apaga fixadas nem antigas |
| /cargo adicionar/remover | ManageRoles + hierarquia | Um membro por plano; cargo gerenciado/@everyone bloqueado |
| /operacao | Mesma guilda e próprio ator | Estado e confirmações, sem expor operação de outro usuário |

Painel HTTP ainda requer ManageGuild para entrar na área administrativa. Slash commands de moderação exigem a permissão específica, sem impor ManageGuild adicional. O worker revalida permissão, hierarquia, guilda, estado do bot e versão antes do efeito.

Toda escrita usa o executor existente com claim atômico. O banco armazena o motivo minimizado, operador, alvo, ação, duração, operação e TTL. A trilha de auditoria recebe início e confirmação por item. DM e escalonamento configuráveis foram adicionados na 0.5.0, começando desativados; detalhes abaixo.

Banimento em massa: até vinte IDs únicos. A prévia separa alvos não elegíveis; a frase é BANIR N MEMBROS para a contagem elegível. Cancelamento para antes do próximo item; o que já foi aplicado permanece registrado. Resultado desconhecido requer reconciliação e não dispara retry.

Lock preserva estado true/false/herdado e altera somente um bit, sem apagar sobrescritas. A janela de restauração segue a retenção da guilda. Mudança manual, novo bloqueio ou expiração bloqueiam a restauração automática. Não promete travar Administrator ou todas as exceções.

Limpeza: quantidade, autor, bots, trecho literal, link, anexo e datas. Conteúdo/anexos exigem Message Content configurada. Na execução, selecionados são conferidos novamente contra fixação, conteúdo, idade e presença. Itens antigos ou modificados aparecem como ignorados. Não percorre todo o histórico do servidor.

Fontes oficiais consultadas em 11/11/2026: [Guild Resource](https://docs.discord.com/developers/resources/guild), [Message Resource](https://docs.discord.com/developers/resources/message), [Channels Resource](https://docs.discord.com/developers/resources/channel). Assinaturas do discord.js 14.28.1 conferidas também nas declarações instaladas.

## Atualização 0.5.0

DM configurável e escalonamento foram implementados em backend/moderation-options.js. disabled é padrão; observe registra sem sancionar. Etapas exigem permissão atual do autor; ban automático exige proprietário e frase ESCALONAMENTO PODE BANIR. Recibos impedem repetir uma etapa na mesma janela/política. DM fechada não desfaz a punição confirmada. Grupos de cargos (até cem alvos) têm prévia/elegibilidade e frase por contagem, também disponíveis por slash. Estas regras substituem a descrição histórica de ausência de DM/escalonamento. Os limites de limpeza/lock continuam válidos.
