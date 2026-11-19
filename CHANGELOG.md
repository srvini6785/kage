# Alterações do Kage

## 0.6.4 — 18/11/2026

- Auditoria ofensiva local identificou e corrigiu uma falha de autorização: o roteamento do Express não diferencia maiúsculas, mas o mapa de escopos diferençava; um usuário delegado somente com `view` alcançava `/Security`, `/Settings` e `/Audit-logs` ao capitalizar o caminho.
- `routeScope` e `authorizeDashboard` agora normalizam o caminho para minúsculas antes de mapear o escopo. Operações já criadas também ficam protegidas, pois o caminho gravado no plano passa pela mesma verificação no worker.
- Teste de regressão cobre variações de caixa em caminhos permitidos e negados.
- XSS revisado nos renderizadores de prévia do construtor e da estrutura: todos os valores dinâmicos passam por escape e os campos sensíveis têm regex estrita no schema; nenhum sink explorável encontrado.
- `npm audit --omit=dev` permanece com 0 vulnerabilidades. Validação local com 186 testes.

## 0.6.3 — 18/11/2026

- Anúncio de rota extraído para uma função única, deduplicado por rota em vez de por texto: telas públicas e acessos negados agora são anunciados de forma consistente, e atualizações da mesma rota não repetem a mensagem.
- Testes cobrem anúncio em Documentos, em rota negada, silêncio após atualizar a mesma rota e novo anúncio ao trocar para outra rota negada.
- Lista de permissões exigidas do bot no `staging-check` virou constante única, sem alterar o resultado da auditoria.
- Validação permanece com 186 testes; nenhum comportamento de negócio foi alterado nesta revisão.

## 0.6.2 — 18/11/2026

- Pré-checagem de staging `npm run staging-check`: valida variáveis e OAuth2, consulta Discord e MongoDB em modo somente leitura, confere permissões do bot e testa `/health` e `/ready` sem imprimir credenciais.
- `/ready` agora informa separadamente o estado do banco e do bot, mantendo 503 quando algum ainda não está pronto.
- Painel anuncia a troca de rota em região viva para leitores de tela e respeita `prefers-reduced-motion`.
- Validação com 186 testes, incluindo 5 novos casos de pré-checagem; build, manifesto e staging real continuam separados.

## 0.6.1 — 18/11/2026

- Redesign do painel em 320/768/1440px e nos temas claro/escuro, com menu móvel, foco visível, contraste ajustado e tabelas sem rolagem horizontal involuntária.
- Revisão automatizada de acessibilidade em 15 rotas e dois temas: zero violações axe; contraste amostrado entre 5,74:1 e 10,31:1.
- Segurança endurecida: ocultação central de tokens/webhooks/URIs em motivos e transcrições, respostas de autenticação sem cache, validação de code/access_token do OAuth2 e comprimento mínimo da chave de cifra de sessão.
- Validação final com 181 testes, lint, contratos tipados, build e manifesto; integrações reais e staging continuam pendentes.
- Versão 0.6.0 preservada como base; nenhum recurso anterior removido.

## 0.4.0 — 11/11/2026

- Assistente com categorias, tópicos, tipos texto/voz/anúncios/fórum, decoração determinística, ordem e exclusão de ramos do rascunho.
- Desfazer/refazer limitado e integrado ao autosave, preservando rascunhos v1 e troca explícita de versão.
- Treze templates v2 exportáveis, importação JSON validada em bytes e estrutura, remoção de campos extras e exemplos portáteis.
- Contratos de importação/exportação e /templates/apply com a mesma confirmação, escopo e idempotência do executor.
- Controle concorrente de criação, hash de sobrescritas, limites, dependências e resultado unknown sem duplicação automática.
- Autorização atualiza metadata/cargos antes de calcular permissões; erros de tamanho/JSON são identificados corretamente.
- Testes adicionais de estrutura, HTTP e autorização; integração real e revisão visual atual ainda pendentes.


## 0.3.0 — 11/11/2026

### Adicionado
- AutoMod nativo com quatro gatilhos, limites oficiais, alertas privados, prévia, confirmação, edição e desativação.
- Revisões antes/depois, versão local, autoria protegida e serialização por guilda; resultados incertos bloqueiam novas mudanças.
- Testes de contrato, capacidade, permissão revogada, concorrência, estado externo e desativação em situação degradada.

- Comandos slash e painel de moderação com motivo, prévia, confirmação, hierarquia, histórico e retenção.
- Banimento em lote limitado a vinte alvos, com relatório de elegibilidade e frase com contagem.
- Lock/unlock por snapshot, preservação de outras permissões e interrupção diante de edição manual.
- Limpeza com filtros, até cem mensagens examinadas, exclusão de antigas/fixadas e revalidação antes de apagar.
- Consulta de operação pelo próprio moderador e histórico paginado por cursor no painel/API.
- Diagnóstico portátil, verificação de hashes, manifesto, AGENTS.md e instruções de retomada Windows.

### Corrigido
- Build copia todos os arquivos do manifesto, incluindo o registro histórico de validação; integridade também conferida no diretório gerado.

- Fluxos de /banir e /timeout agora usam a política e o executor comuns; removido apenas o bloco duplicado que se tornou inalcançável.
- Falhas de política antes de efeitos não ficam indevidamente unknown; respostas HTTP 4xx confirmadas não são repetidas cegamente.
- Respostas assíncronas antigas da tela de moderação são descartadas após troca de guilda.
- Alteração concorrente de slowmode/bloqueio interrompe a ação em vez de sobrescrever estado novo.

### Limites
- Dados de teste são sintéticos. Discord/MongoDB reais, Windows, revisão visual deste pacote e rollback de incidentes precisam de validação.
- DM editável, escalonamento automático, atribuição por grupos de cargos, fila distribuída, restauração geral, agendamentos e novos motores de proteção continuam pendentes.

## 0.2.0

Assistente versionado, catálogos, editor v1/V2, sessão cifrada, schemas, idempotência, relatórios e documentação. Base original preservada.
