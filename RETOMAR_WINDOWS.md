# Retomar o Kage no Windows

Continuação 0.6.5 da base 0.6.4, incluindo a correção definitiva do login do painel, a IA compatível com OpenAI e o registro de comandos globais para bot público. Extraia Kage_v0.6.5.zip em uma pasta nova, por exemplo Documentos\Kage-v0.6.5. Abra a subpasta kage. Preserve e compare suas edições locais antes de substituir arquivos. O .env real fica separado e não acompanha o ZIP.

## PowerShell

Use Node.js 22.13+ da série 22, ou Node.js 24+. Abra o terminal na pasta kage:

```powershell
node --version
npm ci
npm run doctor
npm run staging-check
npm run verify-release
npm run validate
npm run build
npm run migrate -- --dry-run
npm run demo
npm run register
npm run register:global
```

Abra http://127.0.0.1:3040. Ctrl+C encerra a demonstração. Os scripts não exigem Bash. Se npm.ps1 for bloqueado pela política local, use npm.cmd nos mesmos comandos, sem mudar a política global.

## Staging

Copie .env.example para .env somente no computador que executará o serviço. Configure os valores localmente, sem enviar segredos ao chat. Confira PUBLIC_ORIGIN/callback, MongoDB e a guilda em DISCORD_GUILD_ID. Rode npm run staging-check; use --online para consultar Discord/MongoDB e --http com npm start ativo. Somente depois de conferir o banco, aplique npm run migrate. npm run register atualiza comandos da guilda configurada; npm run register:global publica os comandos para todos os servidores (propagação de até uma hora). npm start inicia bot, fila, agenda e painel.

ENABLE_GUILD_MEMBERS habilita entradas, benefícios e grupos; ENABLE_REACTIONS habilita reação; ENABLE_MESSAGE_CONTENT habilita leitura de conteúdo para proteções/XP; ENABLE_MESSAGE_EVENTS recebe metadados sem habilitar conteúdo; ENABLE_NATIVE_AUTOMOD_EVENTS recebe eventos nativos. Intents privilegiadas também exigem configuração/aprovação no portal.

Não use Administrator no Kage como atalho. O cargo do bot precisa ficar acima dos cargos/alvos administrados. Cada ação também confere a permissão atual do operador.

## Conferência na retomada

Execute docs/staging-checklist.md: reinício da fila, revogação de acesso, Gateway, DM fechada, horários, cancelamento, restauração por lote e alterações manuais. queued não significa aplicada. Após queda durante efeito, unknown exige conferência no Discord e reconciliação pelo proprietário, sem retry cego.

Verifique 320/768/1440px, temas, teclado e leitor de tela. A validação local passou no Windows em 18/11/2026 (Node 24.15.0, 190 testes, build e migração dry-run). A chave do session store é derivada automaticamente, então o login não depende mais de o segredo ter caracteres especiais. O layout foi revisado nos dois temas e o axe não encontrou violações; leitor de tela real e integrações reais continuam pendentes. Veja docs/windows-verification.md.

Construtor de servidores reúne estrutura, cargos, mensagens e segurança. Segurança e Editor de embeds completos continuam separados; mensagens do projeto aceitam somente texto/imagens v1/V2. A política só muda quando incluída e confirmada explicitamente.

Leia docs/handoff.json, docs/delivery.md, docs/server-builder.md e a matriz antes de alterar. Não reconstrua a partir da versão 0.1.0. Após editar, rode npm run release-manifest, npm run build e npm run verify-release.

O PDF original de 85 páginas acompanha o pacote. Use somente Kage como nome comercial; preserve créditos e placeholders.
