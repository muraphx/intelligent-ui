# Direção da interface

Um laboratório em português, com navegação lateral para três cenários, conversa no centro e trilha de geração à direita. Verde petróleo indica ações e estados; superfícies claras e bordas discretas mantêm o foco na resposta. O modo escuro usa os mesmos tokens semânticos.

O estado inicial gera análise de receita com dados fictícios. Calculadora e formulário substituem a superfície após o retorno do provider. O usuário pode inspecionar JSON, cancelar streaming, repetir uma falha, trocar provider e mudar o tema. A demo identifica explicitamente respostas determinísticas e a API exige configuração no servidor.

Todos os controles têm rótulos, estados de foco e desabilitado. Gráficos incluem descrição e tabela. Em telas pequenas, as demos viram uma navegação horizontal, os cards empilham e o inspetor sai do fluxo. As transições respeitam `prefers-reduced-motion`.

O parser só publica snapshots JSON completos e validados; enquanto recebe tokens, a interface anterior permanece visível e desabilitada para novas ações. Erros aparecem na própria conversa. A interface não interpreta HTML, scripts, CSS ou expressões do modelo.
