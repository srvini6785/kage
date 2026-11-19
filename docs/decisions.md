# Decisões atuais e continuidade

18/11/2026 · Kage 0.6.5. Histórico distribuído: 0.1.0→0.2.0→0.3.0→0.4.0→0.5.0→0.6.0→0.6.1→0.6.2→0.6.3→0.6.4→0.6.5. Os pacotes anteriores foram preservados; esta pasta contém a continuação atual.

- Nome comercial único Kage por instrução expressa, mesmo onde o PDF cita variantes. Créditos, laranja, textos em pt-BR e placeholders preservados. O PDF original não foi alterado.
- A tentativa anterior no Windows teve helper_sandbox_lock_failed. O checkpoint anterior continuou no Linux. Na retomada atual, a cópia 0.5.0 foi recuperada e ampliada para 0.6.0 no Windows, preservando a pasta anterior. O ZIP e os scripts portáteis permitem retomada sem reconstruir o projeto.
- Express/Mongoose/discord.js e módulos funcionais foram mantidos. Não há migração de framework. Contratos TypeScript/JSDoc e lint foram adicionados sem converter todo o JavaScript.
- Treze templates continuam editáveis. Atualização de versão é aditiva, comparada e reversível no rascunho; não substitui edições silenciosamente. Boas-vindas e eventos usam as telas próprias, com confirmação separada; escolher template não ativa automação.
- Posição de cargo é um efeito separado da criação; o progresso registra o que funcionou. Ícones e gradientes dependem de capacidades reais da guilda. Administrator exige proprietário e frase de risco; nunca é padrão do bot.
- A API não fornece contagem individual comprovada de dois boosts. O preset literal permanece bloqueado; foi implementado benefício identificado de booster ativo + patamar de boosts da guilda, sem duplicar cargo nativo.
- IA só produz sinal de revisão. O provedor exige aprovação no ambiente e na política, allowlist, timeout e contrato estrito. Nenhum serviço/credencial foi inventado. Captcha externo não foi simulado; botão/reação são desafio de participação.
- Todos os novos controles começam desativados. Eventos atrasados e sinais de conta recente não são prova de abuso. Automação não concede cargos sensíveis. Quarentena automática retirada por verificação exige recibo próprio da mesma entrada; mudança posterior observada invalida o recibo.
- Fila queued é recuperável com claim/lease; running incerto não é repetido. Reconciliação humana não chama a API novamente. Rollback só exclui recursos novos, vazios e inalterados com fingerprint; operações antigas sem evidência ficam para revisão manual.
- Backup preserva estrutura/configuração/templates autorizados, sem mensagens ou concessões individuais. Hash detecta alteração acidental, não é assinatura de terceiros. Restauração é por lote e volta configurações pausadas; referência de cargo não resolvida não abre um canal por omissão.
- Configuração e intenção de auditoria são gravadas no mesmo CAS/outbox. Outros efeitos guardam intenção/resultado por operação; não se promete atomicidade distribuída entre Discord e banco.
- Consentimentos são versionados. Exclusão revoga sessões/cancela trabalhos e remove dados próprios, pseudonimizando referências principais necessárias. Não promete apagar cópias baixadas, mensagens Discord, todas as evidências operacionais ou tornar dados anônimos.
- Regras nativas pertencem ao Discord e continuam com Kage offline/pausado; desativá-las exige ação explícita. Logs Kage armazenam metadados minimizados, com HMAC por guilda e retenção.
- Dependências fixadas: sharp, ESLint, TypeScript e linkedom; minimatch 11.0.8 fixado por override após alerta do audit no lint. Regressão passou após a atualização. Build e manifesto incluem código/testes/documentos/PDF, sem .env real, node_modules ou dist redundante.
- 186 testes locais não aprovam produção. A revisão visual automatizada em 320/768/1440px e dois temas foi concluída; permanecem externos: leitor de tela real, configuração e testes Discord/OAuth2/MongoDB, provedor de IA, campos legais/contato/link e revisão responsável. A matriz conserva essas lacunas e as adaptações explícitas acima.

## Checkpoint Windows em 11/11/2026

A cópia 0.5.0 foi recuperada em pasta separada no Windows, preservando a 0.2.0 existente. Instalação, diagnóstico, 159 testes, build, manifesto e migração dry-run passaram; checagem DOM complementar percorreu 18 telas. Não houve alteração do código de execução. A revisão visual ainda está bloqueada pelas ferramentas; Discord/OAuth2/MongoDB e provedor reais não foram usados. Este checkpoint substitui a pendência histórica de execução local no Windows.

## Continuação 0.6.0 no Windows

As edições locais do novo workspace foram preservadas em checkpoint antes de continuar. Por orientação posterior do usuário, assistente e cargos ficam no Construtor de servidores; Segurança e Editor de embeds completos permanecem separados. Mensagens no construtor são somente texto/imagens v1/V2. Política e regras nativas são opt-in no plano, com revisão completa, frase explícita e revalidação por tarefa.

A interface usa a organização administrativa de referência pública Themesberg Figma, com laranja Kage e créditos preservados; não se afirma inspeção do editor Figma ou importação de kit. Novos contratos e testes estão em server-builder.md. A suíte atual tem 180 testes aprovados no Windows; integrações reais e revisão visual continuam pendentes. A documentação Windows anterior fica preservada no histórico do JSON.

## Fechamento 0.6.1 em 18/11/2026

O painel recebeu ajuste visual responsivo e de contraste, revisado em navegador real nas 15 rotas, 320/768/1440px e dois temas, com zero violações axe. Teclado, menu móvel e Escape foram exercitados; leitor de tela real não foi executado. A segurança recebeu ocultação central de credenciais em motivos/transcrições, no-store em autenticação e validação adicional do callback OAuth2. A suíte passou a 181 testes. Staging real continua pendente de credenciais e ambiente próprios, sem segredos no chat.

## Fechamento 0.6.2 em 18/11/2026

A preparação de staging ganhou uma pré-checagem local somente leitura que valida variáveis, OAuth2, bot, permissões e MongoDB sem imprimir segredos. `/ready` passou a separar banco e bot; a demo confirmou o anúncio de rota em região viva e a regra de movimento reduzido. A suíte passou a 186 testes. A variante online depende das credenciais do proprietário e não foi executada; staging real continua sendo o aceite externo.

## Auditoria de segurança 0.6.4 em 18/11/2026

- Roteamento do Express 5 é insensível a caixa; o mapa de escopos não era. Caminhos como `/Security` passavam pela verificação de `view` e chegavam a rotas privilegiadas. `routeScope` e `authorizeDashboard` agora normalizam para minúsculas antes de decidir.
- A correção vale também para planos já criados: o caminho bruto gravado em `dashboardPath` é reavaliado pela mesma função antes de cada tarefa no worker.
- A revisão de XSS confirmou escape em todas as prévias dinâmicas e validação estrita de cor, chave e nome no schema compartilhado.
- Dependências continuam sem vulnerabilidades conhecidas em produção; nenhuma alteração de arquitetura foi necessária.

## Fechamento 0.6.3 em 18/11/2026

O anúncio de rota passou a ser uma função única, deduplicada pela rota e não pelo texto, evitando repetição ao atualizar a mesma tela e cobrindo telas públicas e acessos negados. Os testes verificam anúncio em Documentos, acesso negado, silêncio após atualização e novo anúncio ao trocar de rota negada. A lista de permissões do bot na pré-checagem virou constante única. Nenhum fluxo de negócio mudou e a suíte permanece com 186 testes.

## Persistência de login e entrada no painel em 19/11/2026

- Reproduzida falha em sessão nova com connect-mongo 5.1.0 e kruptein reais: decryptSession já converte JSON em objeto, mas o unserialize padrão tenta JSON.parse novamente. A configuração agora serializa uma vez e preserva o objeto já decifrado, sem desligar a criptografia.
- A recuperação anterior apenas limpava o cookie e não corrigia o roundtrip. O callback bem-sucedido agora retorna a /#overview; falhas retornam ao login com mensagem persistente, sem repetir um código OAuth consumido.
- Entrada sem sessão apresenta somente o login Discord, sem a casca do painel ou guilda fictícia. Conta autenticada em home/login abre diretamente Visão geral. O runtime estático é live e descritores demo antigos são rejeitados; fixtures continuam restritas aos testes.
- Ausência de servidores, sessão expirada e indisponibilidade têm caminhos separados de recuperação. Respostas JSON null válidas continuam representando rascunhos ausentes. O botão Atualizar não anuncia sucesso quando a reinicialização falha; a regressão foi reproduzida em teste antes da correção.
- Evidências locais usam MongoStore/kruptein reais com coleção simulada e Discord simulado: 228 testes aprovados e 16 cenários no Edge headless isolado com fixtures locais. Login desktop/móvel e dashboard foram inspecionados; não equivale a login OAuth real nem aprovação de produção.
- Antes da publicação, o Render ainda servia assets do commit 598c842 e respondia 401 limpando o cookie recém-criado por /auth/login. O usuário autorizou commit/push desta correção; a conferência externa posterior deve confirmar assets novos e leituras de sessão sem descarte do cookie, mantendo OAuth completo como aceite separado.

## Endurecimento pós-publicação em 19/11/2026

- Parsers JSON foram movidos para depois da autenticação e do CSRF, com teto por rota, para que corpos grandes de requisições anônimas sejam recusados com 401 sem leitura.
- Chaves passaram a ser segregadas por HKDF a partir do segredo mestre: token OAuth2 (`oauth-token`), pseudônimo de exclusão (`pseudonym`) e máscara de logs (`log-mask`). Em produção, `SESSION_ENCRYPTION_KEY` é obrigatória e distinta de `SESSION_SECRET`.
- `trust proxy` e `Secure` seguem `PUBLIC_ORIGIN`; o cookie de produção vira `__Host-kage.sid`.
- Auditoria de acesso negado é limitada a um registro por usuário a cada 60 segundos; logout e exclusão revogam o token no Discord; `/health` e `/ready` deixam de expor versão e estado interno; idempotência não grava `/backup` e `/access`.
- O deploy invalida sessões antigas: o usuário entra novamente.

## Publicação 0.6.5 em 18/11/2026

- O login retornava 503 em produção porque o connect-mongo usa kruptein, que exige ao menos duas maiúsculas, duas minúsculas, dois dígitos e dois caracteres especiais no segredo. Segredos base64url falham nessa regra com frequência. A chave do session store passou a ser derivada por SHA-256 em base64url com sufixo fixo, garantindo a complexidade sem reduzir a entropia da configuração.
- Sessões criadas com a chave anterior deixam de ser legíveis; o usuário entra novamente após o deploy. A mudança vale para qualquer instalação, sem exigir regeração manual do segredo.
- A IA de moderação ganhou `AI_PROVIDER_STYLE=openai` para OpenAI, Groq, OpenRouter e Gemini por endpoint compatível, com resposta JSON validada e normalizada. O modo `contract` permanece como padrão e a IA continua somente de revisão, sem sanção automática.
- Para o bot público, `npm run register:global` registra comandos globais e o convite passou a pedir permissões mínimas curadas (sem Administrator), ajustáveis por `INVITE_PERMISSIONS`.
- Validação local: 190 testes, lint, contratos, build e manifesto. Staging real, leitor de tela e revisão legal continuam pendentes.
