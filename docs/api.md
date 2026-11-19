# API

Todas as escritas autenticadas exigem Origin igual a PUBLIC_ORIGIN, X-CSRF-Token, Idempotency-Key de 16–100 caracteres e schema estrito. Dados sensíveis usam no-store. O ID do ator é obtido da sessão. Erros novos incluem requestId, correlationId, code, message, state, applied, fieldErrors, retryable e nextAction.

| Recurso | Métodos | Comportamento |
| --- | --- | --- |
| /health e /ready | GET | Liveness (`{status:'ok'}`) e readiness (200/503 sem detalhes internos) |
| /api/me | GET/PUT | Perfil e preferências globais |
| /api/guilds | GET | Guildas autorizadas |
| /api/guilds/:id/settings | GET/PUT | Configuração por versão |
| /api/guilds/:id/wizard | GET/PUT | Rascunho privado do operador |
| /api/guilds/:id/wizard/preview | POST | Diff do rascunho salvo |
| /api/guilds/:id/templates | GET | Catálogo versionado |
| /api/guilds/:id/roles | GET/POST | Lista ou prévia de criação |
| /api/guilds/:id/roles/:roleId | PATCH | Prévia de edição |
| /api/guilds/:id/embeds | GET/POST | Rascunhos de mensagens |
| /api/guilds/:id/embeds/:embedId | PATCH | Edição por versão |
| /api/guilds/:id/embeds/:embedId/preview | POST | Prévia de publicação |
| /api/guilds/:id/operations/:operationId/confirm | POST | Confirmação com APLICAR; retorna 202 |
| /api/guilds/:id/operations/:operationId | GET | Resultado por item |
| /api/guilds/:id/operations/:operationId/cancel | POST | Parada antes do próximo item |
| /api/guilds/:id/security | GET/PUT | Metadados e configuração existente |
| /api/guilds/:id/security/native | GET | Regras nativas; externas somente leitura; versões locais |
| /api/guilds/:id/security/native/preview | POST | nativeMutationSchema; criar/editar/desativar, sem efeito |
| /api/guilds/:id/security/emergency | POST | 409, desativado |
| /api/guilds/:id/audit-logs | GET | 50 itens, cursor _id, filtros action/result |
| /api/guilds/:id/backup | POST | Estrutura autorizada sem mensagens |
| /api/guilds/:id/restore | POST | 409, desativado |
| /api/logout | POST | Revoga sessão |

Rotas legadas state/config/plans/tickets foram preservadas. /templates/apply confirma somente uma prévia de estrutura autorizada. Unknown não deve ser repetido automaticamente. Uniformização completa de erros legados e atomicidade entre auditoria e dados ainda pendentes.


## Rotas da moderação 0.3.0

| Rota sob /api/guilds/:id | Método | Contrato |
| --- | --- | --- |
| /moderation/preview | POST | moderationSchema estrito; ação específica, alvo/canal e motivo |
| /moderation/batch-preview | POST | Até 20 targetIds únicos e motivo; frase calculada no backend |
| /punishments | GET | 50 itens por página; cursor, targetId e action; retenção explícita |

Confirmação de operação aceita a frase exibida pelo plano. Planos comuns usam APLICAR; banimento em lote exige BANIR N MEMBROS. Receber 202 significa queued, não aplicado. O histórico retorna IDs necessários para /unwarn e a referência de operação.

Regras nativas ativas exigem ATIVAR REGRA NATIVA; desativadas usam APLICAR REGRA NATIVA. Desativação envia apenas enabled=false e funciona durante pausa do Kage; leituras exigem ManageGuild atual. Contrato e limites em native-automod.md.

## Templates 0.4.0

| Rota sob /api/guilds/:id | Método | Contrato |
| --- | --- | --- |
| /templates | GET | Treze templates v2; cargos separados no catálogo |
| /templates/import | POST | {json: string}; arquivo UTF-8 até 256 KiB; retorna estrutura normalizada, sem aplicar |
| /templates/export | POST | {draft: wizardSchema}; retorna somente template estrutural |
| /templates/apply | POST | {operationId: UUID, confirmation: frase}; prévia estrutural mesmo ator/guilda, responde 202 queued |

As quatro rotas têm autorização atual. Escritas exigem Origin/CSRF/chave de idempotência. /wizard/preview continua sendo a origem do plano salvo; /operations/:id/confirm preserva compatibilidade e também valida o plano. Importar/exportar não ativa módulos nem faz efeitos Discord. Somente o envelope de importação tem parser até 1 MiB; arquivo continua limitado a 256 KiB. Estrutura parcial e erros incertos são reportados por item. Não existe restauração automática de uma estrutura após timeout.

## Contratos adicionais 0.5.0 (atuais)

As referências anteriores a emergência/restore desativados descrevem as rotas diretas legadas. Essas rotas continuam recusando execução sem prévia; os fluxos abaixo estão implementados. Escritas novas produzem uma operação de prévia, e a confirmação retorna queued. A frase é a fornecida pelo backend, não necessariamente APLICAR.

| Rota sob /api/guilds/:id | Método | Contrato e efeito |
| --- | --- | --- |
| /security/policy | GET | Política adicional + versão |
| /security/policy/preview | POST | securityPolicySchema; confirmação APLICAR PROTEÇÕES |
| /security/decisions | GET | Até 50 registros, cursor _id e prazo |
| /security/emergency/preview | POST | channelIds, reason, pauseInvites; snapshot de convites e lock |
| /security/emergency/restore-preview | POST | channelIds, reason, operationId opcional para convites; estado original confirmado |
| /security/native/:ruleId/history | GET | Revisões da guilda/regra dentro do prazo |
| /security/native/:ruleId/restore-preview | POST | revisionId, reason; nova prévia comparada à regra atual |
| /moderation/options | GET | DM e etapas com versão |
| /moderation/options/preview | POST | moderationOptionsSchema; ban automático exige proprietário/frase extra |
| /roles/group-preview | POST | sourceRoleId, targetRoleId, action add/remove, reason; até cem elegíveis |
| /roles/:roleId/delete-preview | POST | riskConfirmation; quantidade e fingerprint conferidos novamente |
| /assets | POST | data base64, PNG/JPEG/WebP estático até 2 MiB; reprocessamento |
| /assets/:assetId | GET/DELETE | Somente asset de guilda/operador atual e válido |
| /publications | GET | Publicações próprias dentro do prazo |
| /publications/:id/preview | POST | version, embed; mantém canal e compara fingerprint |
| /publications/:id/restore-preview | POST | version, restoreVersion; restauração também exige prévia |
| /members/automation | GET | Boas-vindas e booster + versão |
| /members/automation/preview | POST | memberAutomationSchema; sem ativação implícita |
| /schedules | GET | Até cem agendas próprias |
| /schedules/preview | POST | scheduleSchema; mensagem v1/V2 ou evento externo |
| /schedules/:id/cancel | POST | version; cancela e invalida ocorrência enfileirada |
| /backups | GET | Até trinta backups da guilda no prazo |
| /backup/import | POST | manifest até 1 MiB no formulário; valida scope/schema/hash/duplicatas |
| /restore/preview | POST | backupId, channelIds/roleIds, restoreSettings, riskConfirmation |
| /structure/preview | POST | channelId, edit/delete, nome/tópico/parentId; allowNonEmpty explícito |
| /rollback/preview | POST | operationId; somente criação comprovada e inalterada/vazia |
| /operations/:id/reconcile | POST | Proprietário; confirmation, reason, resolution; sem efeito remoto |
| /access | GET | Delegações; somente proprietário |
| /access/preview | POST | accessSchema; DELEGAR ACESSO; sem conceder privilégios Discord |
| /logging/policy | GET | Configuração versionada de metadados |
| /logging/policy/preview | POST | logPolicySchema, filtros e mascaramento |
| /audit-logs | GET | cursor, action, result, from/to ISO; cinquenta por página |
| /metrics | GET | Janela de sete dias, até dez mil registros, teto sinalizado |

Rotas globais: PUT /api/me também aceita notifications; PUT /api/me/consents aceita escolhas versionadas terms/privacy/cookies; GET /api/me/export transmite NDJSON próprio; POST /api/me/deletion exige EXCLUIR MEUS DADOS e revoga sessões. Não pertencem à configuração de guilda.

Scopes são view, settings, security, moderation, messages, structure, roles, backups, schedules e audit. Delegação ativa inclui leitura básica, mas cada efeito exige a permissão nativa atual. A operação conserva o caminho autorizado e o worker o revalida por item. Recibos idempotentes não pulam autenticação/autorização.

Limites HTTP: envelope JSON comum 128 KiB; importação de template 1 MiB com arquivo até 256 KiB; backup 2 MiB; asset 4 MiB com arquivo decodificado até 2 MiB. Endpoints não aceitam caminhos do filesystem nem URL arbitrária para upload. Parser maior não altera o limite do arquivo/schema.

A configuração usa outbox atômica com versão; o flusher publica Audit de forma idempotente. Não há promessa de atomicidade distribuída com Discord. Integração real e uniformização integral de todos os códigos históricos ainda exigem revisão; erros novos têm envelope minimizado.

## Construtor 0.6.0

As rotas /wizard e /wizard/preview permanecem. wizardSchema.embeds admite o contrato legado ou builderEmbedSchema: {kind: "server-message", key, target: {channelId, channelKey}, message: serverMessageSchema}. target escolhe somente um destino; mensagem nova aceita apenas texto e imagens v1/V2. security.policy é opcional; security.nativeRules aceita até dez entradas {rule, reason}. Nenhuma inclusão é implícita ao escolher template. A prévia devolve builderVersion=1, diff, tarefas internas e reviewConfig com política/regras efetivas. Segurança usa APLICAR PROJETO na confirmação; sem segurança usa APLICAR.

Cada tarefa exige seu escopo atual: structure, roles, messages ou security; o worker repete a conferência por efeito. Metadados de /state para delegados incluem apenas campos necessários às telas, sem IDs privados de configuração. Detalhes em server-builder.md.
