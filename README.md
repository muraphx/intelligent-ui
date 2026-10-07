# Intelligent UI

Um laboratório aberto de **UI generativa**: o provider escolhe componentes, emite JSON, a aplicação valida o contrato com Zod e renderiza React. A interface **reage na hora** ao que a pessoa digita, a interação volta ao provider como uma etapa e a resposta seguinte substitui a interface — **trazendo o design system que ela mesma escolheu**. O ciclo inteiro também é publicado como biblioteca, para outros projetos usarem com os próprios componentes.

Implementação independente para experimentar esse ciclo. Não é código, produto oficial nem reprodução fiel dos mecanismos internos do ChatGPT.

## Rodar em três comandos

Requisitos: Node.js 22.12+ e npm, com acesso ao registry para a instalação inicial.

```sh
npm install
npm test
npm run dev
```

Abra **http://127.0.0.1:5173**. Não precisa de `.env`, conta, chave nem backend para as demos. Depois da instalação, o modo demo não faz chamadas externas; fontes, ícones, gráficos e respostas são locais. Para a distribuição estática: `npm run build` e `npm run preview` (porta 4173).

**Estado de verificação desta entrega (verificado pelo orchestrator, não auto-relato):** a
instalação que o implementador tentou dentro do sandbox do Codex falhou com `EACCES`
(`registry.npmjs.org`) e está preservada em [`docs/`](docs/) como registro do ambiente bloqueado.
Fora do sandbox, a entrega foi medida de ponta a ponta:

- `npm install` → exit 0, 72 pacotes, `package-lock.json` gerado;
- `npx vitest run` → **64 testes passando em 9 arquivos** (contrato, validação, streaming, canal de ação, providers, design system, reatividade e superfície da biblioteca);
- `npm run build` → `tsc --noEmit` limpo + `vite build`, 121 módulos, 343,42 kB (104,53 kB gzip);
- `npm run build:lib` → pacote ESM em `dist/lib/index.js` (41,39 kB / 13,20 kB gzip) com tipos em `dist/lib/lib/index.d.ts`;
- `npm run screenshot` → `PASS: 3 demos, calculator result 96, profile card, mini-game, mobile overflow, browser console`, quatro prints reais em `docs/screenshot-*.png`;
- `node scripts/capture-themes.mjs` → `PASS: 5 sistemas capturados, 3 superfícies capturadas, console limpo` — e a própria captura confirmou que a resposta declara o sistema: receita → Papel, calculadora → Terminal, cartão → Brutal;
- `node scripts/capture-live.mjs` → `PASS: reativo sem envio. Calculadora: 250 × 4 = 1.000 (a cada tecla). Formulário: medidor 0% -> 100% com prévia ao vivo. Eventos em tempo real: 10. Console limpo.`;
- `node examples/minimal/capture.mjs` → `PASS: exemplo do consumidor renderizou, a ação trocou a interface e o console está limpo.`

Dentro do sandbox a verificação continua sendo sua responsabilidade rodar.

## Experimente sem chave

| Demo | O que acontece | Como comprovar a interação |
| --- | --- | --- |
| Análise de receita | Texto, três métricas e gráfico do semestre com dados fictícios | Clique em “Testar meu entendimento”, responda ao mini-jogo e receba feedback em uma nova spec |
| Calculadora | Dois valores e quatro operações | Digite 12 e 8, selecione multiplicação e clique em “Calcular resultado”: um novo MetricCard mostra 96 |
| Cartão de perfil | Formulário com nome, função e descrição | Envie o formulário: ele é substituído por um ProfileCard; “Criar outro cartão” reinicia o fluxo |

Na demo, o texto do composer é exibido e enviado ao provider, mas **a resposta é a composição determinística do cenário selecionado**. Não há um modelo rodando localmente. Para geração livre a partir do texto, use o provider remoto. O histórico de atividade mostra a ação, a resposta e a revisão. A aba “Spec JSON” revela exatamente os dados validados.

## Reativo em tempo real

A superfície não espera o provider para responder ao que foi digitado. A conta vive em funções puras
(`src/ui/live.ts`) e o componente as chama a cada tecla:

- **Calculadora** recalcula a cada tecla e explica o erro sem quebrar (dividir por zero, campo vazio,
  valor fora do limite). O envio ao provider continua existindo — agora só quando a pessoa quer que a
  **resposta** mude.
- **Formulário** valida campo a campo enquanto se digita, mostra o medidor de preenchimento e compõe
  uma **prévia ao vivo** do que está sendo escrito.
- **Mini-jogo** pré-visualiza a escolha no foco/hover antes do clique.
- **Gráfico** anima as barras quando os dados chegam diferentes.

Cada interação local também emite um evento (`onLive`) com throttle de 180 ms — o primeiro sai na
hora e o último valor sempre é entregue. No app, isso alimenta o contador *Eventos em tempo real* no
painel de bastidores.

## Design system como contrato

Três decisões (`mode`, `font`, `radius`), uma de profundidade (`depth`) e 14 cores em hex, tudo
validado com Zod e aplicado como custom properties — `src/ui` nunca importa CSS.

- **5 presets**: Papel, Terminal, Brutal, Clínico, Noturno.
- **Tokens próprios**: o editor do app valida o JSON colado contra o mesmo contrato e guarda no
  navegador.
- **A resposta escolhe**: a spec pode trazer `"designSystem": "terminal"` ou o objeto completo, e a
  superfície se reestiliza sozinha. As demos fazem isso (papel / terminal / brutal).

## Usar em outro projeto

O ciclo inteiro sai pelo entry público `src/lib/index.ts` e vira pacote com `npm run build:lib`
(ESM + tipos, React/Zod/DOM como *peer dependencies*). Há um consumidor mínimo em
[`examples/minimal`](examples/minimal) — componentes próprios, provider próprio e tokens próprios, em
~20 linhas de glue. Guia completo em [`docs/LIBRARY.md`](docs/LIBRARY.md).

```sh
npm run example        # o consumidor externo rodando
npm run example:shot   # print real em docs/screenshot-example*.png
```

## Spec plana e catálogo

```json
{
  "root": "root",
  "elements": {
    "root": { "type": "Stack", "props": {}, "children": ["intro", "next"] },
    "intro": { "type": "Markdown", "props": { "content": "## Olá!\nUma interface como dado." }, "children": [] },
    "next": { "type": "Button", "props": { "label": "Continuar", "action": "continue" }, "children": [] }
  }
}
```

Todos os elementos têm `type`, `props` e `children`. Filhos são referências por ID; somente `Stack` aceita filhos. Esse formato segue a forma plana `{root, elements}` documentada pelo [json-render](https://json-render.dev/docs/schemas). O renderer deste projeto é próprio; não depende de `@json-render/react` e não afirma compatibilidade com todos os recursos dessa biblioteca.

| Tipo | Props principais | Interação |
| --- | --- | --- |
| Stack | `direction?: vertical | horizontal` | Agrupa IDs filhos |
| Markdown | `content` | Texto, títulos e negrito; HTML permanece texto escapado |
| MetricCard | `label`, `value`, `detail?`, `trend?`, `tone?` | Exibe valor |
| Chart | `title`, `subtitle?`, `unit?`, `points: [{label,value}]` | Gráfico SVG e tabela acessível |
| Button | `label`, `action`, `variant?` | Envia evento com payload vazio |
| Calculator | `title`, `description?`, `initialA?`, `initialB?`, `operation?`, `action` | Envia valores, operação e resultado calculado pela aplicação |
| Form | `title`, `description?`, `fields: [{name,label,placeholder?,required?}]`, `submitLabel`, `action` | Envia os campos preenchidos |
| MiniGame | `title`, `question`, `options`, `action` | Envia a opção escolhida |
| ProfileCard | `name`, `role`, `bio?`, `tag?` | Exibe o cartão criado |

Os contratos completos estão em [`src/ui/catalog.ts`](src/ui/catalog.ts). Todos os schemas são estritos. Tipos, props ou IDs inválidos são descartados e geram erros visíveis, sem derrubar irmãos válidos. Referências ausentes, duplicadas, ciclos e profundidade excessiva são removidos. A raiz inválida rejeita a spec inteira. Máximo de 200 elementos e profundidade 24; strings, campos e pontos também são limitados.

## Streaming e canal de ação

```text
pedido → provider → fragmentos → parser → Zod → React
                      ↑                         ↓
                      └── ui_action_result ← interação
```

`StreamingSpecParser` mantém estado de strings, escapes e chaves entre chunks. Tolera prosa e cercas de código fora do JSON e ignora objetos de preâmbulo que não contêm uma spec. Uma spec completa é validada antes de chegar à tela. Não tenta adivinhar nem fechar strings/objetos incompletos: durante a recepção há progresso e a superfície anterior permanece visível. JSON malformado, truncado ou acima do limite gera erro. Vários snapshots completos podem chegar na mesma resposta.

A demo usa `AsyncIterable<string>` no próprio navegador; o provider remoto recebe **SSE via fetch POST**. O decoder SSE trata UTF-8 dividido entre bytes, CRLF, múltiplas linhas `data`, comentários, limites de tamanho e interrupções. Não utiliza `EventSource` porque a solicitação precisa de corpo JSON.

Exemplo de retorno da calculadora:

```json
{
  "type": "ui_action_result",
  "action": {
    "elementId": "calculator",
    "name": "calculate",
    "payload": { "a": 12, "b": 8, "operation": "multiply", "result": 96 }
  }
}
```

O controlador verifica se a ação pertence ao elemento atual, valida o payload e calcula apenas operações fixas definidas no código. A implementação não executa expressões do modelo. O provider recebe o pedido original, a spec anterior como mensagem `assistant` e o evento como uma nova mensagem `user` com `ui_action_result`. Esse é um **resultado de etapa no protocolo da aplicação**, não uma chamada nativa de tool com ID inventado. O modelo recebe o catálogo gerado dos schemas e deve produzir uma spec completa de substituição.

Falhas preservam a superfície anterior. “Tentar novamente” repete a última solicitação. Cancelamento aborta o stream; respostas antigas não sobrescrevem solicitações mais novas. Os componentes interativos ficam desabilitados durante a geração.

## Usar um modelo real

Copie `.env.example` para `.env`, escolha `UI_PROVIDER` e configure **seu modelo e sua chave**. Não há nome de modelo presumido: use um disponível na sua conta.

```dotenv
UI_PROVIDER=openai
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sua-chave
OPENAI_MODEL=seu-modelo
```

Ou use o adaptador Anthropic:

```dotenv
UI_PROVIDER=anthropic
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sua-chave
ANTHROPIC_MODEL=seu-modelo
```

Com `npm run dev` ativo, abra outro terminal e execute `npm run proxy`. No seletor da conversa, escolha “API via proxy local”. O proxy escuta em **127.0.0.1:3001**. `GET /api/health` informa provider/configuração sem revelar a chave. Reinicie o proxy após alterar `.env`.

O adaptador OpenAI-compatible acrescenta `/chat/completions` à base e lê `choices[].delta.content`, conforme a [referência de Chat Completions](https://developers.openai.com/api/reference/resources/chat). O adaptador Anthropic acrescenta `/v1/messages`, envia `max_tokens` e lê `content_block_delta/text_delta`, conforme a [documentação de streaming da Anthropic](https://platform.claude.com/docs/en/build-with-claude/streaming). Um endpoint compatível precisa oferecer esse protocolo SSE. URLs HTTPS são aceitas; HTTP é permitido em loopback. Não é um proxy aberto com endpoint controlado pelo browser.

As chaves ficam no processo Node e nunca usam prefixo `VITE_`. `.env*` está no `.gitignore`, com exceção do exemplo. O proxy é para desenvolvimento local: aceita origens locais das portas 5173/4173, limita tamanho/prazo, oculta mensagens sensíveis do upstream e cancela pedidos quando o cliente desconecta. Não inclui autenticação para hospedagem pública.

## Relação com padrões abertos

Esta implementação é original e usa os padrões abaixo como referências conceituais; não copia seus renderers nem implementa seus protocolos completos.

| Referência | Mapeamento conceitual neste projeto | Diferença |
| --- | --- | --- |
| json-render | Raiz e elementos por ID, catálogo tipado | Não implementa bindings, condições, patches nem todas as convenções da biblioteca |
| Open-JSON-UI | UI declarativa como dados, componentes conhecidos e ações | Não importa nem exporta o schema Open-JSON-UI; a adaptação exigiria traduzir a árvore e os contratos |
| A2UI v0.8 | `elements` aproxima-se dos componentes em `surfaceUpdate`; `props` carrega os valores que poderiam estar em `dataModelUpdate`; uma spec validada equivale conceitualmente ao início via `beginRendering` | Aqui há snapshots completos sobre SSE, sem envelopes A2UI, bindings nem múltiplas surfaces |

Open-JSON-UI é descrito pelo material do CopilotKit como padronização aberta do schema declarativo interno da OpenAI. Essa descrição é atribuída à fonte; este projeto não verifica nem afirma reproduzir uma implementação interna da OpenAI. Veja o [guia comparativo do CopilotKit](https://www.copilotkit.ai/docs/AG-UI-and-A2UI-Explained.pdf) e seu [repositório de exemplos](https://github.com/CopilotKit/generative-ui). A antiga URL de documentação de Open-JSON-UI atualmente redireciona para A2UI.

O mapeamento dos envelopes exigidos pelo brief corresponde especificamente ao **A2UI v0.8**. A referência atual também documenta v0.9 com `createSurface`, `updateComponents` e `updateDataModel`; esses nomes não devem ser confundidos com v0.8. Consulte a [referência primária de mensagens A2UI](https://a2ui.org/reference/messages/).

## Estrutura e verificações

```text
src/ui/          catálogo Zod, validação, parser, componentes, renderer
src/generation/  contratos, ações, controlador, demos, SSE, provider remoto
src/styles/      tokens, temas e layout responsivo
server/          proxy HTTP mínimo e adaptadores de API
scripts/         captura reproduzível e verificações nativas
docs/            plano, design e logs reais
```

```sh
npm test
npm run build
```

Os testes Vitest cobrem parser parcial e limites, rejeição de tipos/props, ciclos, escape de HTML, cálculo/formulário/mini-jogo, cancelamento, erros, SSE em fragmentos UTF-8 e adaptadores/rotas HTTP locais. Não dependem de chave nem fazem chamadas a provedores externos.

Para capturar a aplicação após instalar e fazer o build:

```sh
npx playwright install chromium
npm run screenshot
```

O script abre o build real em Chromium, exercita as três demos, verifica erros de console e grava `docs/screenshot-intelligent-ui.png`, `docs/screenshot-calculator.png`, `docs/screenshot-profile.png` e `docs/screenshot-mobile.png`. A captura está pendente nesta entrega por falta das dependências; nenhum mockup ou PNG fabricado foi usado. Quando existir, o print principal pode ser visualizado em [docs/screenshot-intelligent-ui.png](docs/screenshot-intelligent-ui.png).

Limitações: sem persistência entre recargas; Markdown reduzido; sem adaptadores completos A2UI/Open-JSON-UI; sem API real verificada nesta sessão; instalação, build, suíte Vitest e captura pendentes devido ao bloqueio de rede. O projeto não foi commitado nem publicado, conforme solicitado.

## Licença

[MIT](LICENSE).
