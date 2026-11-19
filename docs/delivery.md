# Entrega Kage 0.6.5

18/11/2026 · Windows · continuação 0.6.2 com preservação das edições locais. O PDF de 85 páginas permanece a especificação principal; a reorganização segue a orientação posterior do usuário.

| Frente | Resultado | Evidência |
| --- | --- | --- |
| Construtor de servidores | Estrutura → Cargos → Mensagens → Segurança; gestão atual de cargos no mesmo espaço | public/extended.js, public/server-builder-ui.js |
| Ferramentas completas | Segurança e Editor de embeds continuam separados e acessíveis | public/navigation.js, tests/app-navigation.test.js |
| Mensagens do projeto | Somente texto/imagens v1/V2, canais existentes ou planejados; conteúdo anterior preservado | bot-shared/server-messages.js, tests/server-builder.test.js |
| Segurança do projeto | Política e regras nativas entram na revisão e fila somente por escolha explícita | backend/operations.js, tests/server-builder.test.js |
| Autorizações | Escopo por tarefa, assets próprios e revalidação antes de publicação; canal criado precisa de recibo | tests/server-builder.test.js |
| Interface | Workspace responsivo em 320/768/1440px, temas claro/escuro, menu móvel, foco e contraste revisados | public/workspace.css, tests/builder-ui.test.js, tests/app-navigation.test.js |
| Acessibilidade | Zero violações axe em 15 rotas e dois temas; contraste amostrado entre 5,74:1 e 10,31:1; anúncio de rota e movimento reduzido | docs/verification.md, public/app.js, public/workspace.css |
| Staging | Pré-checagem local sem expor segredos, incluindo OAuth2, bot, permissões, MongoDB e `/ready` | scripts/staging-check.js, scripts/staging-audit.js, tests/staging.test.js |
| Segurança aplicada | Ocultação de credenciais, autenticação sem cache e validação OAuth2 | src/core/policy.js, src/web.js, backend/moderation.js, tests/security.test.js |
| Continuidade | Base, recursos completos, créditos, placeholders e PDF preservados; 141 IDs mantidos | docs/traceability.json, docs/handoff.json |

Os módulos de segurança, moderação, agenda, recuperação, acesso e observabilidade da 0.5.0 continuam presentes. As adaptações reais da API continuam em implementation.md. Detalhes do construtor: server-builder.md. Verificação: verification.md e windows-verification.md. Retomada: RETOMAR_WINDOWS.md.

A validação local terminou com 186 testes, lint, contratos tipados, build, manifesto e demo HTTP. A revisão visual foi concluída em navegador real; leitor de tela real não foi executado. Nenhum banco, guilda ou serviço externo foi alterado.

## Pendências externas

- Configurar e testar OAuth2, Discord/Gateway e MongoDB em staging, com migração aplicada somente ao banco conferido; comece por `npm run staging-check`.
- Percorrer docs/staging-checklist.md em guilda de teste, incluindo canal criado/reutilizado, revogação de escopos, reinício/claims/outbox, recuperação e rollback.
- Definir provedor de IA e avaliar dados/corpus reais, se desejado; o adaptador segue fechado e somente para revisão humana.
- Fornecer responsável, contato e link oficial e revisar os modelos legais. [LINK_SERVIDOR_SVR] e [VERIFICAR] permanecem.
- Conferir com leitor de tela real em estação dedicada.

queued não significa aplicado. Resultados remotos incertos não recebem retry cego. Boas-vindas e eventos não são ativados ao escolher um template. Esta entrega não declara aprovação de produção ou cumprimento integral das 85 páginas.
