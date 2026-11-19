# Validação de staging para a próxima sessão

Roteiro pendente, não evidência de execução. Use guilda de testes e banco separado. RETOMAR_WINDOWS.md contém instalação e recuperação do ambiente; nenhum segredo deve ser enviado ao chat.

## Pré-requisitos conferidos localmente em 18/11/2026

- Node.js 24.15.0, dependências instaladas, `npm run validate` com 186 testes e `npm run doctor` sem problemas.
- Demonstração HTTP local em 127.0.0.1:3040 e revisão de layout em 320/768/1440px nos dois temas; a revisão de acessibilidade automatizada não substitui leitor de tela real.
- Migração somente em dry-run aditivo; nenhum banco real, segredo, guilda, comando ou serviço externo foi usado.

## Antes de executar

1. Crie uma aplicação Discord de teste com bot e OAuth2; registre o callback `http://localhost:3040/auth/callback` no ambiente local.
2. Suba um MongoDB separado para staging e copie `.env.example` para `.env` no computador que executará o serviço. Não envie valores ao chat.
3. Gere segredos aleatórios com pelo menos 32 caracteres para `SESSION_SECRET` e `SESSION_ENCRYPTION_KEY`; ajuste `PUBLIC_ORIGIN`, `DISCORD_GUILD_ID` e intents.
4. Rode `npm run staging-check`; depois `npm run staging-check -- --online` para consultar Discord e MongoDB sem imprimir segredos. Corrija os bloqueios antes de continuar.
5. Rode `npm run doctor`, `npm run migrate -- --dry-run` e confira o banco antes de aplicar `npm run migrate`.
6. Inicie com `npm start` em guilda de teste, rode `npm run staging-check -- --http` e percorra os cenários abaixo, sem usar Administrator como atalho.

| Cenário | Resultado esperado |
| --- | --- |
| Login/logout, sessão vencida, permissão revogada | Nova leitura/escrita recusada; polling para; credenciais não aparecem no erro |
| Guilda alheia em URL, plano ou rascunho | 403 uniforme; nenhum efeito nem dado de outra guilda |
| POST sem Origin/CSRF, chave reaproveitada com corpo diferente | Rejeição antes de executar |
| Prévia com config/hash/ator/validade alterados | Confirmação recusada |
| Dois cliques de confirmação | Uma execução, resultado consultável por ID |
| Assistente v1 aberto depois de catálogo v2 | Canais antigos preservados até troca explícita |
| JSON com campo extra, arquivo acima de 256 KiB e referência de categoria inválida | Extra removido; demais casos recusados antes de alterar o rascunho/Discord |
| Desfazer durante autosave, trocar guilda durante importação | Última revisão correta; resposta antiga descartada |
| Estrutura com duas categorias e nomes em conflito | Cada filho na categoria correta; objetos existentes preservados |
| Permissão de categoria alterada ou categoria apagada após prévia | Interrupção sem canal solto na raiz |
| Fórum/anúncios sem Community | Não autorizado, sem substituir por texto |
| Moderação com alvo dono, operador, bot ou acima da hierarquia | Rejeição antes do efeito |
| Permissão retirada após confirmação | Item interrompido sem sanção |
| Ban/kick/timeout/warn/unwarn/unban | Uma ação; histórico/Discord audit com ator, motivo e referência; unwarn preserva registro |
| Lock/unlock com estado herdado, permitido ou negado | Restaurar só SendMessages; preservar outras flags; intervenção manual interrompe |
| Limpeza com fixada, antiga, editada, bot e anexos | Apenas IDs elegíveis revalidados; antigas separadas; sem loop |
| AutoMod: criar regra desativada e ativar após nova prévia | Nada executado enquanto desativada; ações e exceções correspondem ao resumo |
| AutoMod: limite ocupado por regra de outro criador | Rejeição sem duplicação; regra externa somente leitura |
| AutoMod: alerta público ou canal removido antes da confirmação | Configuração rejeitada; nenhuma cópia de conteúdo para canal público |
| AutoMod: editar pelo Discord depois da prévia | Conflito; alteração manual preservada |
| AutoMod: desativar pausado ou com alerta apagado | PATCH apenas enabled=false; gatilho e exceções preservados |
| Erro remoto incerto / queda entre efeito e checkpoint | Estado unknown ou execução sem conclusão; sem retry; reconciliação manual |
| TTL ainda não removeu documento vencido | Leituras aplicam prazo e não retornam histórico expirado |
| 320, 768 e 1440 px; teclado e leitor de tela | Formulários sem rolagem horizontal involuntária; labels/foco/erros claros |

Para reconciliação, guarde apenas IDs de teste e correlação, horário e resultado minimizado. Compare operações/revisões com o recurso real antes de alterar um controle busy/unknown. Há reconciliação assistida pelo proprietário, sem repetir efeitos ou dispensar a conferência humana. Nunca simule aprovação de testes reais somente porque a suíte com fixtures passou.

## Novos cenários 0.5.0

A reconciliação assistida pelo proprietário já existe na tela Backups e não repete a operação. A frase acima sobre ausência da ferramenta descreve a versão anterior. Ainda é necessária conferência humana no Discord.

| Cenário adicional | Resultado esperado |
| --- | --- |
| Delegação por cargo e revogação no meio do lote | Só seções autorizadas; próximo efeito recusado; nenhum privilégio nativo concedido |
| Duas instâncias e reinício com queued/running | Uma disputa vence queued; running com lease perdida vira unknown sem repetir |
| Falha de Audit após salvar configuração | Nova versão existe com outbox; flusher grava uma vez e retira a pendência |
| Anti-raid Observe/Execução, evento antigo e cargo sensível | Observe sem efeito; atraso descartado; cargo sensível nunca automático |
| Verificação de outro usuário, expirada, repetida e quarentena manual | Recusa desafios inválidos; não remove concessão de terceiro |
| Convite interno/permitido/inválido/externo | Só externo confirmado pode ser apagado, conforme política |
| IA sem provedor, resposta inválida, aspas/ironia e instrução maliciosa | Sem sanção; resposta validada ou degradada; sem conteúdo em logs |
| Perfil AutoMod, mudança manual e restauração de revisão | Ações de perfil corretas; conflito preservado; nova prévia para restaurar |
| Imagem inválida/SVG/metadata/guilda alheia/expirada | Recusa ou reprocessamento; escopo e TTL preservados |
| Publicação v1/V2 e alteração manual no Discord | Sem mistura; edição/restauração exige fingerprint; V2 não volta a v1 |
| Agenda diária/semanal, DST, atraso e cancelamento após despacho | Hora local preservada; hora inexistente/ocorrência perdida pulada; cancelado não executa |
| Benefício booster e concessão manual existente | Condição guilda+booster explícita; remove só concessão Kage |
| Restore com cargo ausente, homônimo e lote parcial | Sem abertura por omissão; existentes preservados; resultados por item |
| Rollback com conteúdo, concessões e alteração manual | Objeto preservado, sem exclusão automática |
| Consentimento revogado, exportação e exclusão de conta | Tema opcional removido; dados minimizados; sessões/trabalhos próprios revogados |

## Construtor 0.6.0

- Percorrer Estrutura → Cargos → Mensagens → Segurança, salvar/sair/voltar e verificar versões do rascunho.
- Publicar v1/V2 de texto/imagens em canal novo e reutilizado; induzir falha na criação e confirmar que não publica em outro canal.
- Retirar acesso de mensagens/segurança entre prévia e item; conferir interrupção e recibos anteriores.
- Conferir EmbedLinks/AttachFiles e assets vencidos/de outra conta sem criar estrutura por engano.
- Incluir política e várias regras nativas, conferir configurações completas/frase, limites e resultado parcial.
- Alternar projeto e Segurança completa preservando rascunhos distintos. Conferir conteúdo legado e cópia simplificada.
- Verificar delegação apenas de cargos e consultas de tickets/níveis/economia/atividades.
- Revisar menu móvel, Escape/retorno de foco, 320/768/1440px e ambos os temas em navegador real.

## Fechamento 0.6.2

- `npm run staging-check` valida a configuração local, o callback OAuth2 e os segredos sem imprimir valores; `--online` consulta bot, aplicativo, servidor, permissões e MongoDB em modo somente leitura.
- `npm run staging-check -- --http` confere `/health` e o novo `/ready`, que informa separadamente banco e bot.
- O painel anuncia a troca de rota em região viva e respeita `prefers-reduced-motion`; confirme com tecnologia assistiva real.

## Fechamento 0.6.3

- O anúncio de rota é deduplicado por rota: atualizar a mesma tela não repete a mensagem, e trocar entre telas negadas anuncia novamente.
- Confirme em tecnologia assistiva real o anúncio nas páginas públicas, no acesso negado e na navegação comum.
- Nenhum fluxo de negócio mudou nesta revisão; repita a pré-checagem e a suíte antes do aceite.

## Fechamento 0.6.4

- Corrigida falha de autorização em que variações de caixa do caminho contornavam o escopo delegado. Em staging, teste um usuário somente com `view` contra `/Security`, `/Settings` e `/Audit-logs` em maiúsculas e minúsculas: todas devem responder 403.
- Repita a criação e a confirmação de uma operação para garantir que planos antigos também seguem bloqueados após a atualização.
- Nenhuma migração nova; a pré-checagem e a suíte local permanecem como critério antes do aceite.

## Fechamento 0.6.5

- O login deixou de depender da complexidade do segredo: a chave do session store é derivada. Após o deploy, `/auth/login` deve responder 302 e o cookie `kage.sid` deve sair `Secure` com `NODE_ENV=production`.
- Registre `https://<origem>/auth/callback` no portal do Discord antes de entrar; divergência de callback continua bloqueando o OAuth2.
- Para IA, configure `AI_PROVIDER_STYLE=openai`, `AI_PROVIDER_MODEL`, URL, allowlist e token no ambiente; ative Message Content Intent e `ENABLE_MESSAGE_CONTENT=true`; por servidor, selecione "Somente revisão humana" e marque o provedor aprovado. Confirme que o resultado é revisão, nunca sanção.
- Para bot público, rode `npm run register:global`, marque Public Bot no portal, preencha Termos/Privacidade e acompanhe o limite de 100 servidores para verificação.
- Mantenha um monitor HTTP em `/health` a cada 5 minutos para evitar a hibernação do plano gratuito.
