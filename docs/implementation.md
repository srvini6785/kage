# Implementação 0.6.5

A base JavaScript/Express/Mongoose/discord.js foi ampliada; não foi substituída por um projeto novo. Catálogos e dados de demonstração não são evidência de efeitos Discord. Os novos controles começam desativados.

## Segurança e automações

bot-shared/security.js valida política versionada, estados disabled/observe/enforce, isenções e até trinta regras declarativas. backend/security-engine.js deduplica eventos por guilda/evento/regra, ignora eventos antigos, revalida autor/permissões/configuração e limita decisões por alvo. Literais são normalizados; não há execução de regex arbitrária ou código.

Anti-raid considera janela de entradas e idade da conta como sinais, sem banimento automático. Quarentena usa cargo explicitamente escolhido e sem permissões sensíveis. Verificação usa nonce armazenado por hash, vínculo usuário/guilda/versão, validade e consumo único. Botão e reação confirmam participação. A retirada automática de quarentena exige concessão Kage confirmada na mesma entrada; remoção posterior observada invalida a concessão. Ausência de evidência exige revisão manual.

Convites são resolvidos pelo SDK Discord; interno/permitido/desconhecido não vira prova de convite externo. Exclusão exige convite externo confirmado, regra em execução e mensagem atual não fixada. IA recebe no máximo 2.000 caracteres, se aprovada tanto no ambiente quanto na política, com destino HTTPS em allowlist, redirect recusado, timeout e resposta limitada/validada. O contrato próprio só retorna sinal de revisão; não aplica sanções. Não foi configurado nem testado provedor real.

DM após punição é opcional, sem garantia de entrega. Escalonamento por avisos tem janela, versões e recibo único; banimento automático exige proprietário e frase explícita. Perda de permissão interrompe a ação. Regras nativas continuam sob execução do Discord e não obedecem à pausa local.

Boas-vindas usa o conteúdo configurado e o novo membro como variável. Benefício booster exige premiumSince e patamar da guilda; a API não informa dois boosts individuais. Só concessões próprias são revogadas. Cargo nativo/gerenciado nunca é duplicado ou editado.

## Efeitos duráveis

A confirmação faz claim preview→queued no MongoDB. O worker disputa queued→running com workerId e lease de sessenta segundos, renovada a cada dez. Outro processo não recebe o mesmo claim. A cada item: lease, cancelamento, versão, escopo do painel, permissão nativa e precondições são revalidados. Dependências de categorias/cargos são resolvidas por chave e IDs confirmados.

Fila queued pode ser recuperada depois de reinício. Lease running vencida vira unknown; efeitos possivelmente enviados não são reexecutados. Reconciliação exige proprietário, frase e descrição da conferência real e não repete chamadas. Concorrência de produção com vários processos precisa de staging, embora claims sejam exercitados nas fixtures.

O executor comum respeita um retry_after explícito para 429 e autoriza novamente; controles nativo/estrutural encerram rejeição conhecida e pedem nova prévia. Timeout/transporte/falha após envio preservam unknown. Cancelamento para antes do próximo item, sem desfazer efeitos anteriores.

Atualização de configuração grava a nova versão e uma entrada de auditoria no mesmo documento/CAS. O flusher publica a entrada com eventKey único e só então a retira da outbox. Falha conserva a auditoria para retomada. Outros efeitos têm intenção persistida na operação e recibos próprios; não se declara transação distribuída entre MongoDB e Discord.

## Mensagens e mídia

Imagens próprias: PNG/JPEG/WebP estático, até 2 MiB, 4.096px e 16 megapixels; reprocessadas em PNG com remoção de metadados. SVG/GIF/bytes inválidos são recusados. Assets pertencem a guilda/operador, com quota vinte e validade de trinta dias; upload tem limite por usuário. Ícones são reduzidos a 128×128. Imagem remota de evento é limitada ao CDN Discord, sem redirects e com teto de bytes antes de reprocessar.

v1 oferece campos, autor, rodapé, imagem, miniatura e links. V2 oferece Container/Text Display/Separator/Media Gallery/Section/Thumbnail/Button/File; sem mistura com embeds/content. Variáveis são inertes e limites são conferidos depois de expandir. Menções são desabilitadas. Voltar uma mensagem V2 para v1 exige outra publicação.

PublishedMessage guarda fingerprint do retorno Discord, versão e até dez revisões. Editar/restaurar exige autoria Kage, escopo do operador, canal original e fingerprint atual; mudança externa impede sobrescrita. Timeout de edição bloqueia o registro para revisão.

## Agenda e recuperação

Agenda é persistente, uma vez/diária/semanal, com fuso IANA. Repetição conserva horário local; hora inexistente por DST é pulada e horário ambíguo usa a primeira ocorrência. Ocorrência mais de cinco minutos atrasada é ignorada, sem despejar backlog. Cada ocorrência tem ID estável de operação; cancelamento/versionamento invalida despacho já enfileirado. A ocorrência ainda valida o instante do evento e os módulos no worker. Arquivo expirado faz a publicação falhar, exigindo novo envio.

Backup v2 contém estrutura de cargos/canais, sobrescritas de cargos, configuração e templates, com hash. Importação valida escopo, integridade quando fornecida, schema, limites e duplicatas. Hash não é assinatura/autenticidade de terceiro. Restore preserva existentes; homônimos conflitantes e referências de cargo não resolvidas não viram concessões públicas. Lote máximo: vinte cargos, dez categorias e quarenta canais. Configuração restaurada fica pausada com módulos desativados. Concessões individuais, mensagens e permissões individuais de usuários não são restauradas.

Rollback só aceita criações confirmadas com fingerprint, vazias/sem concessões, em ordem inversa. Alterações manuais são preservadas. Operações antigas sem fingerprint não permitem exclusão automática. Rename/move/delete são planos explícitos com leitura atual; excluir canal com conteúdo exige autorização adicional e é irreversível.

## Painel, dados e observabilidade

O proprietário delega escopos por cargo. Delegações incluem leitura básica e não concedem permissões Discord. A rota original fica na operação e é reautorizada por item. Rascunhos, uploads e publicações mantêm escopo do operador. Preferências são globais, separadas da guilda; notificações são avisos no próprio painel, sem e-mail/push.

Consentimentos guardam finalidade, versão, data e escolha. Tema local opcional só persiste após aceite; demonstração salva dados fictícios por ação explícita. Exportação NDJSON percorre dados próprios e minimiza registros de terceiros. Exclusão cancela trabalhos próprios, revoga sessões por epoch e remove preferências, rascunhos, imagens e perfil; referências principais de auditoria são pseudonimizadas. Evidências mínimas, configuração de guilda, mensagens Discord e cópias baixadas têm tratamento separado. Pseudonimização não é anonimização.

Logs opcionais guardam metadados de entrada/saída, mensagem editada/apagada e eventos administrativos autorizados. Não copiam texto bruto. HMAC é separado por guilda. Fonte/canal privado/permissões são revalidados. Métricas: janela de sete dias, contagem por ação/resultado, estado/duração das operações, readiness; coleta limitada a dez mil registros e sinaliza o teto. Não há score de pessoa nem alerta externo enviado.

## Retenção e validação

Auditoria/backups/publicações: prazo por guilda de 1–90 dias. Segurança: prazo de 1–90 dias próprio. Imagens/rascunhos: trinta dias. Recibos HTTP: 24h. Operações: sete dias. Desafios: TTL configurado. Sessão: até uma hora, com inatividade máxima de trinta minutos; epoch de revogação dura duas horas. Agendas concluídas/canceladas expiram pelo prazo da guilda; agenda ativa e concessões ainda necessárias persistem até encerramento. TTL MongoDB é assíncrono; leituras sensíveis também filtram vencimento.

Lint, contratos TypeScript/JSDoc e testes locais são executáveis com npm run validate. Só contratos/cliente tipado estão sob checagem estrita de tipos, preservando o legado JS. Testes de DOM conferem labels/IDs/fluxos selecionados; não comprovam layout/contraste computado/tecnologia assistiva. A validação local Windows foi executada e aprovada (windows-verification.md). Discord, MongoDB e revisão visual reais permanecem no roteiro de staging.

## Construtor unificado 0.6.0

O workspace concentra estrutura/cargos/mensagens/segurança e preserva os módulos completos. O contrato simplificado, o destino por chave local, a revisão de segurança e as verificações por tarefa estão em server-builder.md. Consultas delegadas recebem metadados mínimos; rascunhos nativos do projeto e do módulo são distintos.
