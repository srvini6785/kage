# Assistente e templates · Kage 0.6.5

Implementa a continuação das seções 5.1/5.4, fichas dos treze templates e contrato templates/apply do briefing mestre. A superfície permanece beta: integração real e revisão visual desta versão não foram executadas.

## Edição e preservação

O passo 1 permite criar do zero, editar até dez categorias e quarenta canais, selecionar texto/voz/anúncios/fórum, alterar tópico e categoria, definir exceção privada, ordenar itens novos e excluir ramos do rascunho. Desfazer/refazer mantém até vinte estados na memória da aba. Autosave continua versionado no backend; desfazer durante salvamento gera uma nova revisão, sem restaurar uma versão antiga silenciosamente.

A prévia usa a mesma função de nomes do backend. Nome base de canal é minúsculo, sem espaços, barras ou menções. Emoji pertence a um conjunto fechado, pode ser retirado por item e nunca substitui o nome textual. O separador é ・. O tamanho final, incluindo decoração, não pode passar de cem caracteres. Categorias podem ter espaços, mas não controles, menções ou barras. A validação local ajuda durante a edição; o servidor sempre revalida.

Os treze templates mantêm os nomes e IDs anteriores, agora com versão 2 e categorias explícitas. Rascunhos v1 não recebem uma nova árvore automaticamente. Selecionar outro template ou Usar versão atual do template é uma escolha explícita que substitui somente estrutura/estilo, preservando cargos, regras, mensagens e configurações de proteção. Arquivos antigos sem categorias mantêm a categoria legada Kage · templateId. Os exemplos portáteis estão em templates/.

## Importar e exportar

| Contrato | Limite / regra |
| --- | --- |
| format | kage-template |
| schemaVersion | 1; outra versão é recusada |
| version | Versão autoral 1–999 do template; separada do formato do arquivo e da revisão do rascunho |
| Arquivo UTF-8 | Até 262.144 bytes (256 KiB), conferidos também no servidor |
| Estrutura | Dez categorias, quarenta canais, chaves locais únicas, referências existentes |
| Decoração | Duas flags booleanas e emoji permitido por item |
| Tópicos | Até 1.024 caracteres; voz não aceita tópico neste editor |
| Campos extras | Removidos antes de persistir/importar; valores não aparecem na auditoria |
| Chaves reservadas | __proto__, constructor e prototype são recusadas; profundidade limitada |

Importar valida e altera apenas o rascunho. Não cria canais, concede cargos nem ativa módulos. A interface descarta a resposta se a guilda/rascunho mudar durante a leitura ou validação. Exportar produz somente metadados do template, estilo, categorias e canais planejados: sem guildId, IDs de objetos reais, permissões livres, membros, cargos, embeds, mensagens enviadas ou segredos do ambiente. Tópicos são textos digitados pelo operador e precisam ser revisados antes de compartilhar. Não se promete detectar uma credencial que alguém tenha escrito manualmente dentro de um tópico.

O body HTTP comum continua limitado a 128 KiB; somente a rota de importação aceita envelope JSON de até 1 MiB para acomodar escapes. O conteúdo do arquivo continua limitado a 256 KiB. Payload malformado ou excessivo retorna SCHEMA_INVALID com HTTP 400/413. A demonstração valida o formato localmente e não produz efeitos Discord; o ambiente conectado reaplica o schema do servidor.

## Diff e aplicação

| Situação | Comportamento |
| --- | --- |
| Nome ausente e dependências disponíveis | Criar após confirmação |
| Um objeto visível com nome/tipo compatível | Reutilizar sem mover, renomear, editar tópico ou permissões |
| Nome em vários objetos, tipo diferente ou privacidade incompatível | Conflito; preservar objeto existente |
| Categoria em conflito | Ignorar o ramo; não criar filhos na raiz |
| Anúncio/fórum sem Community | Não autorizado; não substituir silenciosamente por texto |
| Permissões da categoria mudaram após a prévia | Interromper por conflito |
| Nova categoria não confirmada ou apagada | Interromper o filho; sem fallback para raiz |

ManageChannels é exigido do operador e Kage, com Construtor em enforce e bot conectado. Exceções privadas exigem ManageRoles e as permissões de acesso concedidas; canais de voz usam Connect/Speak. Herança copia as sobrescritas atuais da categoria, validando se os dois possuem esses poderes. Sobrescrita contendo ManageRoles não pode ser copiada por quem não tenha a autorização administrativa exigida pela plataforma. Isso não é recomendação para conceder Administrator ao bot: escolha outra categoria ou uma exceção privada explícita.

Privado fecha ViewChannel de @everyone e abre somente operador/Kage; Administrator pode continuar acessando. Uma categoria já existente só satisfaz um pedido privado se @everyone não puder vê-la. Outros cargos com sobrescritas podem continuar acessando; a estrutura existente não é reescrita para remover esses acessos.

Novos canais são anexados após as posições visíveis e criados na ordem do rascunho; o Discord pode agrupar tipos e normalizar nomes. A posição de canais existentes não é alterada explicitamente. Há teto local de quinhentos canais não thread e cinquenta filhos por categoria. Como a API pode omitir canais inacessíveis, contagem e detecção de nomes se limitam aos objetos visíveis; a plataforma pode rejeitar a criação por limite ou acesso. Não se promete unicidade global contra canais ocultos ou edições externas concorrentes.

## Concorrência, resultados e reversão

StructureControl serializa um efeito estrutural por guilda, com IDs de operação/item e estado mínimo. A intenção do item e os resultados ficam no Operation existente. Duas operações não podem criar o mesmo objeto simultaneamente por esta camada; depois da primeira, a seguinte revalida o nome e para. Mudanças pelo Discord ou pelo fluxo legado ainda podem acontecer entre a última leitura e o envio: não existe compare-and-swap remoto nesta API.

Rejeição HTTP 4xx confirmada libera o controle; 429 interrompe esta aplicação, sem retry automático, e pede outra prévia depois da espera. Transporte, 5xx ou persistência incerta após envio mantém unknown/busy e bloqueia novas criações nesta camada até reconciliação manual. Cancelamento ocorre antes do próximo item e preserva os já criados. Após queda durante um envio, não libere o controle para repetir cegamente.

Não há exclusão de objetos reais neste fluxo e não há rollback automático. A reversão do rascunho é desfazer; a revisão manual de objetos criados exige conferir IDs confirmados e uso posterior antes de qualquer remoção. A futura ferramenta de reconciliação/rollback continua pendente. Operações expiram em sete dias; rascunhos em trinta dias/dez versões; controle operacional mínimo permanece com a configuração da guilda até o fluxo de limpeza ser implementado.

## Fontes e testes

Documentação Discord de Guild e Channel, consultada em 11/11/2026: https://docs.discord.com/developers/resources/guild e https://docs.discord.com/developers/resources/channel. A documentação anuncia ocultação/omissão de canais sem ViewChannel em 16/11/2026; não usar metadados de canais obfuscados. SDK instalado: discord.js 14.28.1. Não foram ativadas intents novas.

tests/structure.test.js cobre contrato, legado, decoração, remoção de campos, limites em bytes, versões, desfazer, conflitos, privacidade, Community, permissão revogada, sobrescritas alteradas, lotação, dependências, concorrência, unknown e várias categorias no worker. tests/template-http.test.js cobre sessão/CSRF/escopo, envelope, limites, exportação e o contrato de aplicação. tests/context.test.js verifica atualização de cargos e propriedade antes de autorizar. Efeitos e banco são fixtures.

Ainda pendentes nesta área: eventos agendados reais, boas-vindas por template, renomeação explícita de objetos existentes, métricas de abandono/conflito/tempo, migração assistida entre versões, rollback e reconciliação automática, integração real e revisão visual/acessibilidade manual.

## Atualização 0.5.0

Atualização de template compara inclusões e preserva edições existentes, estilo, nomes/chaves e itens personalizados. A confirmação muda somente o rascunho e mantém desfazer. Rename/move/delete existem como planos explícitos em Backups; restauração e rollback guardam limites e fingerprints. Boas-vindas fica em Segurança e eventos em Agendamentos, sem ativação implícita ao escolher template. Posição dos cargos agora é uma tarefa separada e confirmada no resultado. Detalhes em implementation.md.

## Construtor 0.6.0

A navegação chama este fluxo de Construtor de servidores. As quatro etapas agora são Estrutura, Cargos, Mensagens e Segurança. Política carregada explicitamente e novas regras nativas podem compor a mesma operação, com revisão completa e frase APLICAR PROJETO. Mensagens do projeto são somente texto/imagens v1/V2; canal planejado exige criação confirmada antes de publicar. Ferramentas completas permanecem separadas. Conteúdo anterior e aliases foram preservados. Detalhes e testes em server-builder.md.
