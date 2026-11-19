# Validação da base 0.1.0

Verificação realizada em 06/11/2026, com Node.js 24.15.0.

| Verificação | Resultado |
| --- | --- |
| Sintaxe dos arquivos JavaScript | Passou (`npm run check`) |
| Testes de política e demonstração | 15 passaram (`npm test`) |
| Servidor de demonstração sem dependências externas | HTTP 200 e interface carregada |
| Salvar regra do AutoMod | Alteração persistiu no navegador |
| Trocar servidor | A configuração alterada não afetou o outro servidor |
| Editor de embeds | Prévia exibiu o título, descrição e destino informados |
| Confirmação de publicação | Simulação confirmada e registrada nas atividades |
| Filtro do histórico | Selecionar Simulados exibiu somente a operação de demonstração |
| Layout de computador | Inspeção visual no navegador |
| Layout de celular | Inspeção a 390 × 844; navegação abre e fecha |
| Dependências externas | Instalação bloqueada pela conexão de rede do ambiente |
| MongoDB, OAuth2 e eventos reais do Discord | Não executados; exigem dependências e credenciais próprias |
| Publicação remota da demonstração | Bloqueada pela conexão ao servidor de código; nenhuma publicação foi confirmada |

A implementação de backend está presente no código-fonte, mas não foi validada em integração. Use um servidor Discord de desenvolvimento para essa etapa. A IA, as apelações, os backups e o rollback automático continuam fora desta base; consulte o README para o escopo completo.

---
Registro acima é histórico da base original. Para a continuação 0.4.0, consulte docs/verification.md e docs/traceability.md.
