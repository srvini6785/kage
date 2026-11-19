# Construtor de servidores · Kage 0.6.5

Continuação da base 0.5.0 e das edições locais de interface. Atende aos passos das seções 5/6 do PDF e à orientação posterior de concentrar assistente e cargos em Construtor de servidores. Segurança e Editor de embeds permanecem ferramentas completas separadas.

## Fluxo

| Etapa | Comportamento | Código / evidência |
| --- | --- | --- |
| 1 · Estrutura | Treze templates, categorias/canais editáveis, importação/exportação, migração aditiva, desfazer/refazer | structure-editor.js, structure.test.js |
| 2 · Cargos | Presets, nome/cor/posição e permissões agrupadas; gestão de cargos atuais no mesmo espaço | server-builder-ui.js, roles.js, server-builder.test.js |
| 3 · Mensagens | Texto e imagens em v1 ou V2, destino em canal existente ou do projeto, regras numeradas e prévia aproximada | server-messages.js, server-builder-ui.js, builder-ui.test.js |
| 4 · Segurança | Carregar explicitamente a política atual, ajustar controles e incluir novas regras nativas no projeto | extended.js, native-automod-ui.js, security.js |
| Revisar e aplicar | Diff de todos os efeitos, configuração completa de segurança, frase calculada pelo backend e resultado por item | operations.js, server-builder.test.js |

Os caminhos de código acima são relativos a public/, backend/ ou bot-shared/; testes ficam em tests/. A matriz registra os caminhos completos.

## Contrato e preservação

O rascunho continua em /wizard, versionado e privado do operador. Mensagem nova usa kind=server-message, chave local, target e message. target escolhe channelId existente ou channelKey do projeto, nunca os dois. Sem destino é somente rascunho. Há no máximo dez mensagens. O schema estrito limita v1 a título/descrição/cor/imagem/miniatura e V2 a texto/cor/imagem; assets próprios também podem ser referenciados. Não aceita botões, links de ação, seções ou arquivos no formato simplificado. O Editor de embeds completo mantém esses recursos.

Mensagens antigas permanecem no rascunho. As que contêm componentes avançados são ignoradas na aplicação limitada e identificadas na revisão. Criar cópia simplificada é explícito, conserva o original e recusa excesso de texto sem truncar. Um destino removido/indisponível continua visível e pede nova escolha.

Segurança não muda ao selecionar template. O operador inclui uma política carregada da guilda ou regras nativas deliberadamente. Nenhum conteúdo da etapa exige ativação automática. Campos antigos continuam aceitos para compatibilidade, sem simular funções ausentes. Boas-vindas contínuas e eventos agendados permanecem nas telas próprias.

## Aplicação e autorização

O plano compõe categorias/canais, criação/posição de cargos, mensagens, política e regras nativas. O canal planejado só vira destino após um ID de criação confirmado. Reutilização usa o ID compatível; conflito ignora a mensagem e fica visível no diff. Falha de dependência interrompe o envio, sem escolher outro canal ou a raiz.

A prévia verifica o escopo de cada tarefa, permissões nativas, modo do módulo e assets próprios. Publicação em canal a criar exige previamente poderes para criar/enviar, EmbedLinks em v1 e AttachFiles para assets próprios. O worker repete autorização atual, pertencimento e acesso ao canal real imediatamente antes de enviar. Retirada de delegação interrompe o efeito pendente. Limites nativos contam regras existentes e todas as novas regras do projeto.

reviewConfig mostra a política e as regras efetivamente incluídas nas tarefas. Havendo segurança, a frase é APLICAR PROJETO; demais projetos usam APLICAR. A confirmação retorna queued, e não sucesso remoto. Fila/unknown/cancelamento/recibos e reconciliação preservam as regras anteriores.

## Interface e referência

A navegação concentra assistente e cargos em um projeto com quatro etapas; #wizard, #setup e #roles continuam funcionando como aliases. #roles abre a etapa de cargos. Uma delegação somente de cargos recebe a gestão correspondente sem consultar o rascunho de estrutura. Consultas delegadas de outros módulos recebem apenas os metadados de exibição necessários, sem IDs privados da configuração.

A interface preserva as edições locais de workspace.css: organização de aplicação administrativa, sidebar, tipografia contida, superfícies neutras e laranja #F26A21. Referência pública consultada: [Themesberg Figma Admin Dashboard](https://themesberg.com/product/figma/admin-dashboard-template) e [repositório oficial](https://github.com/themesberg/figma-admin-dashboard-template). Não houve importação de kit pago, cópia de marca nem inspeção do editor Figma. Não foi possível revisar a pintura final em navegador nesta sessão.

O menu móvel informa aria-expanded, fecha ao navegar inclusive para páginas públicas e responde a Escape com retorno de foco. Formulários têm labels e IDs únicos nos cenários exercitados. Isso não comprova responsividade, contraste computado ou leitura por tecnologia assistiva.

## Testes e limites

server-builder.test.js cobre composição/limites/RBAC/assets/dependência de canal e recibos. builder-ui.test.js cobre mensagens limitadas, cópia, destinos perdidos, rascunhos nativos separados, retry explícito e consulta delegada. app-navigation.test.js carrega a aplicação real em linkedom e percorre navegação, aliases, drawer e páginas delegadas. São testes locais com fixtures; Discord, MongoDB, visual e acessibilidade manual seguem no checklist de staging.
