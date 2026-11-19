# Verificação do Kage 0.6.5

18/11/2026 · Windows (win32) · Node.js 24.15.0 · base 0.6.4 preservada.

| Verificação | Resultado |
| --- | --- |
| npm run validate | Sintaxe, lint, contratos TypeScript/JSDoc e 190 testes aprovados; zero falhas |
| Testes adicionados | 31 sobre os 159 da base: 22 do construtor/interface/segurança, 5 da pré-checagem de staging, 1 da chave de sessão, 2 do adaptador de IA e 1 do convite público |
| npm run doctor | Dependências presentes, versão correta e zero problemas |
| npm run staging-check | Execução offline sem .env reportou as sete variáveis obrigatórias ausentes e o guilda opcional, sem imprimir valores |
| npm run traceability | 141 IDs/páginas e todos os caminhos conferidos; 79 implementados localmente, 15 verificados localmente, 47 parciais |
| npm run release-manifest / verify-release | Integridade conferida na fonte e em dist |
| npm run build | Aplicação Node preparada em dist no Windows |
| Migração | Dry-run aditivo de 28 coleções; não aplicada (evidência de 11/11, código de migração inalterado) |
| HTTP demo | 7 recursos atuais retornaram 200, incluindo HTML 0.6.5 e arquivos novos |
| Preservação | Checkpoint antes das edições, nenhum arquivo anterior removido, PDF original inalterado |

## Revisão visual e acessibilidade

15 rotas foram abertas em navegador real em 320, 768 e 1440px, nos temas escuro e claro. Não houve rolagem horizontal da página em nenhuma combinação; o único excesso interno é o ponto de presença de um avatar de 30px, que não desloca o layout. O axe-core não apontou violações nas 15 rotas nos dois temas. O contraste amostrado ficou entre 5,74:1 e 10,31:1, acima do mínimo AA para texto normal. Menu móvel, Escape e retorno de foco foram exercitados; a 0.6.2 adiciona anúncio de rota em região viva e regras de movimento reduzido verificadas na demo, mas leitor de tela real não foi executado nesta sessão. A 0.6.3 centraliza o anúncio em uma função deduplicada por rota e cobre em teste as telas públicas, o acesso negado, o silêncio ao atualizar a mesma rota e o novo anúncio ao mudar de rota negada.

## Segurança aplicada nesta etapa

Motivos, transcrições e exportações passam por ocultação central de tokens, webhooks e URIs de conexão. Respostas de /api e /auth usam no-store. O callback OAuth2 valida state, formato do code, access_token e expiração limitada. SESSION_ENCRYPTION_KEY, quando definida, precisa de pelo menos 32 caracteres. A pré-checagem de staging valida esses requisitos, consulta Discord/MongoDB em modo somente leitura e nunca imprime valores secretos. A 0.6.5 deriva a chave do session store para um valor que sempre atende à complexidade do kruptein, eliminando o 503 de login causado por segredos base64url sem caracteres especiais suficientes. O adaptador de IA ganhou o estilo compatível com OpenAI mantendo HTTPS, allowlist, timeout, teto de resposta e recomendação limitada a allow/review. A suíte cobre esses caminhos; não substitui teste com provedor real.

## Cobertura do construtor e interface

server-builder.test.js valida composição e defaults, v1/V2 restritos, legado avançado preservado, limites nativos agregados, autorização por módulo, canal planejado/reutilizado/conflitante, permissões de imagens/assets, configuração completa na revisão e recibos de publicação. O worker não envia em canal alternativo se a criação falhar e revalida o escopo de mensagens imediatamente antes do envio.

builder-ui.test.js cobre labels/IDs, cópia sem truncar nem modificar o original, destinos indisponíveis, rascunhos nativos distintos, falha de carregamento sem retry automático e consulta delegada sem configuração privada. app-navigation.test.js carrega os módulos reais em linkedom, percorre rotas e aliases, páginas públicas e delegadas e testa fechamento do menu, Escape e anúncio de rota. staging.test.js cobre configuração válida, variáveis ausentes, HTTPS, callback divergente, placeholders, booleanos, IA incompleta e ausência de segredos no relatório.

## Pré-checagem de staging

`npm run staging-check` é somente leitura e não grava no Discord nem no MongoDB. Sem `--online`, confere formato e coerência das variáveis; `--online` autentica o bot, lê o aplicativo e a guilda, verifica permissões operacionais e faz ping/listagem de coleções; `--http` consulta `/health` e `/ready` de uma instância em execução. Nenhum token, segredo, URI ou ID é impresso. A execução real depende das credenciais do proprietário e ainda não foi feita.

## Limites da evidência

Testes HTTP exercitam Express/sessão/CSRF/Origin/escopo/idempotência. Banco e SDK Discord usam fixtures. Não equivalem a MongoDB real ou efeitos REST/Gateway. A revisão axe e o teclado não medem leitor de tela, pintura em todas as fontes nem contraste com zoom extremo. A 0.5.0 teve validação Linux e Windows; o código atual foi executado nesta sessão Windows. Dependências não mudaram; npm ci e audit completos não foram repetidos nesta etapa. A pré-checagem foi exercitada offline; as variantes `--online` e `--http` dependem das credenciais e da instância do proprietário.

Não foram usados segredos reais, registrados comandos globais, aplicadas migrações ou executados efeitos em guildas. A instância pública no Render foi provisionada pelo proprietário; login, OAuth2 real, MongoDB de staging, provedor de IA, carga/concorrência, revisão legal e aceite manual continuam dependendo de configuração e evidência externas. A matriz não declara conformidade integral do PDF nem aprovação de produção. Roteiro: staging-checklist.md. Relatório: release-checks.json e windows-verification.json.
