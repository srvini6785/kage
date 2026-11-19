# Kage 0.6.4

Continuação do código 0.6.3, preservando bot, painel, módulos, comandos e o briefing mestre v1.1 de 85 páginas. Feito por Marcos Vinicius. Apoio e direcionamento: SVR Company.

## Demonstração

Use Node.js 22.13+ da série 22, ou Node.js 24+. Na pasta kage:

```sh
npm ci
npm run demo
```

Abra http://127.0.0.1:3040. Dados fictícios ficam no navegador e nenhuma chamada Discord é feita. Uploads exigem backend real para reprocessamento seguro.

## Implementado nesta continuação

- Construtor de servidores em Estrutura → Cargos → Mensagens → Segurança, com Segurança e Editor de embeds completos também separados.
- Mensagens limitadas a texto/imagens v1/V2 dentro do projeto, com destinos existentes/planejados e política/regras nativas na revisão final explícita.
- Assistente de quatro passos, treze templates, árvore editável, JSON portátil, comparação aditiva de versões, regras numeradas e desfazer/refazer.
- Anti-raid/contas recentes, convites com allowlist, verificação por botão/reação, regras declarativas e emergência reversível.
- AutoMod nativo de palavras, spam, presets, menções e perfil; eventos e restauração de revisões com confirmação.
- Cargos com permissões agrupadas, paleta/contraste, posição, ícones de 128px e gradientes conforme capacidade; edição/exclusão e atribuição por grupo.
- Mensagens v1/V2, seis modelos, campos, links, seções, anexos, upload reprocessado, edição de publicações e histórico restaurável.
- Moderação comum preservada e ampliada com DM opcional, escalonamento e comandos de grupo.
- Boas-vindas e benefício de booster ativo vinculado ao patamar da guilda, com concessões próprias rastreadas.
- Agenda de mensagens/eventos com imagem, fuso, repetição diária/semanal e cancelamento auditado.
- Backup validado, restauração por lote, alteração explícita de canais, rollback de criações vazias e reconciliação.
- Acesso delegado por cargo, preferências globais, consentimentos versionados, exportação/exclusão de dados próprios e revogação de sessões.
- Fila persistente com leases, auditoria recuperável da configuração, logs filtrados/mascarados e indicadores agregados.
- Painel responsivo em 320/768/1440px, temas claro/escuro, foco visível, contraste revisado e menu móvel com Escape.
- Ocultação de tokens/webhooks/URIs em motivos e transcrições, respostas de autenticação sem cache e validação OAuth2.
- Pré-checagem de staging sem imprimir segredos: valida variáveis, OAuth2, bot, permissões, MongoDB e os endpoints `/health` e `/ready`.
- Diagnóstico `/ready` com estado separado de banco e bot, anúncio de troca de rota para leitores de tela e respeito a movimento reduzido.

As proteções adicionais começam desativadas; Observação não sanciona. O construtor preserva canais existentes; política e regras nativas só entram no plano por escolha explícita. Selecionar template não ativa proteções. Configure boas-vindas em Segurança e eventos em Agendamentos.

## Ambiente real

1. Copie `.env.example` para `.env` local. Configure aplicação Discord, callback OAuth2, MongoDB e segredos; não envie esses valores pelo chat.
2. Rode `npm run staging-check` para conferir a configuração local sem expor credenciais. Use `npm run staging-check -- --online` para consultar Discord e MongoDB e `--http` com a instância iniciada.
3. Configure HTTPS em produção e chaves aleatórias para sessão/cifra. PUBLIC_ORIGIN deve coincidir com a origem do painel.
4. Rode `npm run migrate -- --dry-run`; confira o banco antes de aplicar `npm run migrate`. A migração é aditiva.
5. Habilite somente intents necessárias no ambiente/portal. Não dê Administrator ao Kage como atalho.
6. Registre os comandos na guilda de staging escolhida com `npm run register` e inicie com `npm start`.
7. Execute `docs/staging-checklist.md` antes de operar numa comunidade real.

## Verificações

```sh
npm run doctor
npm run staging-check
npm run verify-release
npm run validate
npm run build
npm run migrate -- --dry-run
```

`validate` executa sintaxe, lint, contratos tipados e testes. O JavaScript existente foi preservado; a checagem de tipos cobre os contratos e o cliente tipado, sem declarar conversão integral do legado. Build gera a aplicação Node em dist/. Após editar, regenere o manifesto com `npm run release-manifest` antes do build.

## Limites reais

Versão beta validada localmente, sem alegação de conformidade integral ou aprovação de produção. A validação local também passou no Windows (186 testes, build e migração dry-run; docs/windows-verification.md). A revisão de layout foi feita em 320/768/1440px nos dois temas, com zero violações axe nas 15 rotas; leitor de tela real não foi executado. OAuth2/Discord/MongoDB reais, migração aplicada e cenários de staging ainda precisam ser executados.

A IA tem adaptador de provedor e atua somente como sinal para revisão humana. Nenhum provedor está aprovado/configurado e nenhuma chamada de IA foi feita. Botão/reação confirmam participação, sem prometer identidade ou captcha externo. A API não comprova dois boosts por pessoa; esse preset continua bloqueado e a condição alternativa é identificada na interface.

Regras nativas continuam no Discord com Kage pausado/offline. Resultado incerto exige conferência e reconciliação pelo proprietário. Rollback exige fingerprint de criação, objeto vazio/sem concessões e nova confirmação; operações antigas sem essa evidência exigem revisão manual. Backup não recupera mensagens apagadas nem concessões individuais. Imagens próprias expiram em trinta dias e precisam ser reenviadas para ocorrências posteriores.

Os modelos legais exigem responsável, contato e revisão. Preserve `[LINK_SERVIDOR_SVR]` e `[VERIFICAR]`. Use somente Kage como nome comercial.

## Retomada e evidências

Leia `RETOMAR_WINDOWS.md`, `AGENTS.md` e `docs/handoff.json`. O PDF original e sua extração integral acompanham o pacote. `docs/delivery.md` resume a entrega; `docs/server-builder.md` descreve o novo fluxo; `docs/traceability.json` e `.md` mapeiam as 141 seções para código, testes e lacunas. Detalhes em `docs/implementation.md`, `docs/api.md` e `docs/verification.md`.
