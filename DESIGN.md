# Direção da interface

Um laboratório em português, com navegação lateral para três cenários, conversa no centro e trilha de geração à direita. Verde petróleo indica ações e estados; superfícies claras e bordas discretas mantêm o foco na resposta. O modo escuro usa os mesmos tokens semânticos.

O estado inicial gera análise de receita com dados fictícios. Calculadora e formulário substituem a superfície após o retorno do provider. O usuário pode inspecionar JSON, cancelar streaming, repetir uma falha, trocar provider e mudar o tema. A demo identifica explicitamente respostas determinísticas e a API exige configuração no servidor.

Todos os controles têm rótulos, estados de foco e desabilitado. Gráficos incluem descrição e tabela. Em telas pequenas, as demos viram uma navegação horizontal, os cards empilham e o inspetor sai do fluxo. As transições respeitam `prefers-reduced-motion`.

O parser só publica snapshots JSON completos e validados; enquanto recebe tokens, a interface anterior permanece visível e desabilitada para novas ações. Erros aparecem na própria conversa. A interface não interpreta HTML, scripts, CSS ou expressões do modelo.

## Base de componentes

A UI gerada é montada sobre a base **shadcn/ui** (Radix + Tailwind + CVA, arquivos em `src/components/ui`). O catálogo da spec continua sendo o contrato: nove componentes, props tipadas, nada de HTML livre.

## Tokens e escopo

O design system escreve os tokens do shadcn com **valor literal** no container da superfície (`--color-*`, `--radius-*`, `--font-*`). Sem isso os utilitários do Tailwind resolvem no escopo da raiz e a superfície mistura o sistema da resposta com o da casca — foi um defeito real, medido em 1.01:1 de contraste. A superfície também pinta o próprio fundo, para a resposta aninhar o seu sistema sem contaminar a aplicação.

Todo texto sobre cor cheia usa `readableOn()`, calculado por contraste WCAG. `scripts/audit-contrast.mjs` mede cada elemento com texto nos cinco sistemas e falha se algo ficar abaixo de 4.5:1 — a regra de craft é verificada por número, não por inspeção visual.

## Reatividade

A interface responde ao que foi digitado sem ida ao provider: cálculos, validação e prévias vivem em funções puras (`src/ui/live.ts`) chamadas a cada tecla. O envio ao provider é para quando a pessoa quer que a *resposta* mude. Interações locais emitem eventos com throttle de 180 ms (primeiro na hora, último sempre entregue).
