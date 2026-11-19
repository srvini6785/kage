# AutoMod nativo · Kage 0.6.4

Referência: https://docs.discord.com/developers/resources/auto-moderation, conferida em 11/11/2026, e implementação do discord.js 14.28.1 instalado. Contrato em bot-shared/native-automod.js; política/efeito em backend/native-automod.js; interface na tela Segurança. Não substitui o AutoMod Kage existente.

## Superfície implementada

| Gatilho | Limite por guilda | Campos | Ações oferecidas |
| --- | --- | --- | --- |
| Palavras-chave, tipo 1 | 6 | 1.000 palavras de 60 caracteres; 10 regex Rust de 260; allowlist 100 × 60 | Bloquear, alertar, timeout |
| Spam, tipo 3 | 1 | Sem metadata de outro gatilho | Bloquear, alertar |
| Presets, tipo 4 | 1 | Presets 1/2/3; allowlist 1.000 × 60 | Bloquear, alertar |
| Menções, tipo 5 | 1 | 1–50 menções únicas; proteção de mention raid | Bloquear, alertar, timeout |
| Perfil, tipo 6 | 1 | Palavras/regex/allowlist | Alerta, bloqueio de interação |

Os limites contam também regras de outros criadores. Strings e arrays são limitados antes da chamada remota; regex permanece dado inerte e só o Discord valida sua sintaxe Rust. A versão local não tenta executar regex em JavaScript. Timeout tem teto de 2.419.200 segundos. Mensagem de bloqueio tem até 150 caracteres. Uma ação de cada tipo, no máximo três. Até vinte cargos e cinquenta canais isentos, sem @everyone como exceção global.

## Permissões, dados e confirmação

Operador e Kage precisam de ManageGuild atual. Configurar timeout também exige ModerateMembers dos dois. O canal de alerta deve ser de texto, da guilda, acessível ao operador/Kage e fechado para @everyone. Outros cargos com acesso ao canal ainda podem ler os alertas; revise as sobrescritas da equipe no Discord. Canal público ou removido é recusado. Alertas nativos podem copiar conteúdo de membros; a interface informa isso antes da ativação.

Criar, editar e desativar geram uma prévia de cinco minutos, sem efeito. Ela inclui a configuração normalizada, hash do estado atual e frase: ATIVAR REGRA NATIVA quando ativa, APLICAR REGRA NATIVA quando desativada. A confirmação usa o executor comum, claim atômico e revalidação por item. Uma edição externa entre prévia e execução interrompe o efeito. O Discord não fornece compare-and-swap remoto; permanece uma janela entre a última leitura e o PATCH, que precisa ser avaliada em staging.

Somente regras criadas pelo próprio usuário bot do Kage podem ser alteradas. Outros criadores ficam em leitura. O gatilho não pode ser trocado por edição. Não há exclusão: a desativação envia apenas enabled=false, preservando ações/exceções e podendo funcionar mesmo com o Kage pausado, sem ModerateMembers ou com o antigo canal de alerta removido. Ainda exige ManageGuild e autoria Kage.

Regra desativada não observa eventos. Não é oferecido um modo observe fictício. A pausa do Kage impede novas configurações ativas, mas não interrompe regras já executadas pelo Discord. Para parar uma regra, use a desativação com prévia; se há resultado incerto bloqueando escritas, revise diretamente no Discord.

## Persistência, concorrência e reversão

NativeControl serializa alterações nativas de uma guilda, com contador de versão local e referência de operação. NativeRevision registra guilda, criador, operador, regra, versão local, motivo minimizado, antes, pedido, depois e estado. Revisões expiram segundo auditRetentionDays e as leituras aplicam o prazo explicitamente. NativeControl mantém apenas controle operacional e IDs até limpeza de configuração da guilda; o fluxo completo de exclusão de dados continua pendente no produto.

A intenção é salva antes da chamada remota. HTTP 400/403/404/429 confirmado não significa sucesso e não dispara repetição automática neste módulo; uma nova prévia permite corrigir e tentar novamente. Timeout, erro de transporte ou falha de persistência após envio gera unknown, bloqueando novas alterações nativas nessa guilda. Não há desbloqueio automático por tempo: reconciliação manual deve comparar a operação e a regra real antes de liberar o controle. Não apague o bloqueio para repetir uma criação incerta.

Desativação interrompe a regra; o histórico permite restauração por prévia. Eventos nativos são opcionais por intent e guardam somente metadados. Reconciliação de queda exige conferência humana. Worker com claim/lease foi testado localmente, sem comprovação de operação distribuída em produção.

## Evidência

tests/native-automod.test.js usa SDK e persistência simulados: limites, gatilhos, campos extras, intenção sem efeito, perda de permissão, alertas privados, exceções, criador externo, estado manual, desativação de regra degradada, concorrência, intenção antes do efeito, 4xx/429 e unknown sem retry. Integração Discord/MongoDB e revisão visual atual ainda não foram executadas.

## Atualização 0.5.0

O perfil tipo 6 agora é editável para regras do Kage: palavras/regex/allowlist, evento de atualização de membro (2), alerta e bloqueio de interação (ação 4). Não oferece bloqueio de mensagem ou timeout nesse gatilho. O estado inicial continua desativado.

A tela oferece histórico antes/depois e restauração de revisão confirmada por nova prévia. Eventos de execução são opcionais por intent e registrados com IDs/metadados, sem copiar conteúdo. Controles unknown são liberados somente por reconciliação do proprietário após conferência. Claims/leases da fila e workers concorrentes são exercitados localmente, sem alegar validação distribuída real. Esta atualização substitui os parágrafos históricos acima que descreviam perfil/histórico/eventos como não implementados.

## Uso no construtor 0.6.0

A mesma validação e executor nativos atendem o módulo completo e a etapa Segurança do projeto. O construtor inclui somente novas regras; editar/desativar existentes continua no módulo Segurança. Rascunhos locais dos dois contextos ficam separados e preservados ao alternar. Limites da prévia incluem todas as regras do projeto e as existentes.
