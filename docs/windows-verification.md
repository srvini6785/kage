# Validação Windows do Kage 0.6.5

18/11/2026 · Windows (win32) · Node.js 24.15.0 · base 0.6.4 preservada.

| Verificação | Resultado |
| --- | --- |
| npm run validate | Sintaxe, lint, contratos e 190 testes aprovados; zero falhas |
| npm run doctor | Dependências presentes, versão correta e zero problemas |
| npm run staging-check | Offline sem .env: variáveis obrigatórias ausentes reportadas sem expor valores |
| npm run traceability | 141 seções, caminhos conferidos, 79 implementadas localmente, 15 verificadas localmente, 47 parciais |
| npm run release-manifest / verify-release | Integridade conferida na fonte e em dist |
| npm run build | Aplicação Node preparada em dist no Windows |
| Migração | Dry-run aditivo de 28 coleções; não aplicada (evidência de 11/11, código inalterado) |
| HTTP demo | 7 recursos retornaram 200, incluindo o HTML 0.6.5 |
| Layout | 15 rotas em 320/768/1440px, temas escuro/claro, sem rolagem horizontal |
| Acessibilidade | Zero violações axe nas 15 rotas nos dois temas; contraste mínimo 5,74:1; teclado/Escape conferidos; anúncio de rota e movimento reduzido adicionados, com cobertura de rota pública e negada na 0.6.3 |
| Preservação | Checkpoint antes das edições, nenhum arquivo anterior removido, PDF original inalterado |

## Limites

Leitor de tela real não foi executado. OAuth2, MongoDB real, migração aplicada, provedor de IA real e revisão legal continuam pendentes de staging; o bot e o painel já foram executados na instância Render do proprietário. A 0.6.5 faz a chave do session store sempre atender à complexidade do kruptein e permite IA por provedor compatível com OpenAI, com revisão humana. Nenhum segredo real foi usado; nenhuma guilda, migração ou serviço externo foi alterado. Dependências não mudaram e npm ci não foi repetido. O audit de produção não encontrou vulnerabilidades. As variantes online/http do staging-check também dependem de credenciais e serviço ativos. A matriz não declara conformidade integral do PDF nem aprovação de produção.

Roteiro: docs/staging-checklist.md. Relatório: docs/release-checks.json e docs/windows-verification.json. Resumo: docs/verification.md.
