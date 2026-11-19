# Continuação do Kage

O objetivo é continuar o projeto existente usando Kage_Bot_Dashboard_Briefing_Mestre_v1.1_85_paginas.pdf. Leia RETOMAR_WINDOWS.md, docs/handoff.json, docs/decisions.md e docs/traceability.json antes de alterar. Não recrie a base 0.1.0 nem substitua o código atual por uma versão antiga. Preserve alterações locais.

Nome comercial único: Kage. Créditos obrigatórios: Feito por Marcos Vinicius; Apoio e direcionamento: SVR Company. Laranja #F26A21. Placeholders [LINK_SERVIDOR_SVR] e [VERIFICAR] só mudam com informação autorizada.

src/ e public/ são o código original mantido. backend/ e bot-shared/ compartilham validação/política com o bot. Toda moderação nova passa por prévia, confirmação, revalidação por efeito e histórico. Comandos são exclusivamente slash commands. Não conceda Administrator ao bot como atalho.

Verifique npm run doctor, npm run verify-release, npm run check, npm test e npm run build. Migrações são aditivas; use --dry-run antes de banco real. Testes com fixtures não comprovam efeitos Discord nem MongoDB reais. Registre o que foi testado e o que ainda falta.

Nunca coloque credenciais em logs, respostas, capturas, manifestos ou commits. .env fica local e fora do pacote. Não registre comandos em guildas reais ou publique como pronto somente porque build/testes locais passaram.

Atualize rastreabilidade, decisões, verificação e handoff ao concluir uma etapa. Módulos desativados por falta de implementação não devem ser descritos como concluídos. Distribuição final deve incluir README, instruções Windows, manifesto de integridade, código, testes e documentos; excluir node_modules, dist redundante, .git e .env.

O PDF original está em docs/Kage_Bot_Dashboard_Briefing_Mestre_v1.1_85_paginas.pdf; a extração integral está em docs/specification-source.txt. Use a fonte local para retomar sem depender de anexos da conversa. Antes de empacotar após edições, execute npm run release-manifest; build usa essa lista de arquivos.
