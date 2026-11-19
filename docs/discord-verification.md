# Fontes técnicas verificadas

Revisão em 11/11/2026. Consulta de documentação/SDK não equivale a integração real.

| Tema | Fonte primária | Aplicação |
| --- | --- | --- |
| Components V2 | https://docs.discord.com/developers/components/reference | Container, texto, separador, galeria, seção/acessório e File; limite agregado conservador |
| Mensagens | https://docs.discord.com/developers/resources/message | Separação V2/v1, edit/attachments, limite de bulk e flags |
| Guilda/cargos | https://docs.discord.com/developers/resources/guild | colors, ENHANCED_ROLE_COLORS, ROLE_ICONS, contagem de membros por cargo, invites disabled |
| Membros | https://docs.discord.com/developers/resources/guild#guild-member-object | premiumSince não comprova dois boosts individuais |
| Permissões | https://docs.discord.com/developers/topics/permissions | Hierarquia, bits atuais e Administrator |
| AutoMod | https://docs.discord.com/developers/resources/auto-moderation | Gatilhos 1/3/4/5/6, perfil e bloqueio de interação |
| Gateway | https://docs.discord.com/developers/events/gateway | Intents explícitas por módulo e eventos |
| Agenda | https://docs.discord.com/developers/resources/guild-scheduled-event | Evento externo com início/fim/local/imagem |
| Rate limits | https://docs.discord.com/developers/topics/rate-limits | Retry limitado/reautorizado e interrupção em resultado incerto |
| OAuth2 | https://docs.discord.com/developers/topics/oauth2 | state, escopos mínimos e callback |
| Auditoria | https://docs.discord.com/developers/resources/audit-log | Atribuição administrativa e retenção própria separadas |
| Imagens | https://sharp.pixelplumbing.com/api-output/ | Reprocessamento/metadata e saída PNG; assinaturas conferidas no sharp instalado |
| Dependência de lint | https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249 | Atualização transitiva para versão corrigida; audit repetido |

Assinaturas também conferidas no discord.js 14.28.1 instalado. [VERIFICAR] testes de REST/Gateway, capacidades da guilda, avaliação do provedor e alterações futuras antes de produção. Fontes oficiais não aprovam nossa implementação por si mesmas.
