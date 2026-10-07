# BRIEF — Reproduzir o "Intelligent UI" do ChatGPT e publicar no GitHub (tem que FUNCIONAR)

Objetivo: um projeto **open-source, rodando local, verificável** que entrega o mesmo comportamento
do "Intelligent UI" do ChatGPT (lançado 07/10/2026 junto com o GPT-6): o modelo **compõe a
resposta** escolhendo entre texto, visual e **elementos interativos** — gráfico, cartão, botão,
formulário, calculadora, mini-jogo — e a interface **devolve a ação para o modelo**, que responde
com uma nova UI. Isso é o ciclo "generative UI": não é markdown bonito, é UI gerada como dado
validado e interativo.

Trabalhe em `C:/Users/muzph/projetos/intelligent-ui/`.

## Arquitetura obrigatória

1. **Catálogo de componentes com contrato tipado.** Cada componente do catálogo (ex.: `Chart`,
   `MetricCard`, `Form`, `Button`, `Calculator`, `MiniGame`, `Markdown`) é registrado com um
   schema **Zod** de props. Fora do catálogo = rejeitado.
2. **O modelo emite uma spec JSON de UI**, não HTML/JS. Implemente o formato de spec plano
   `{ root: "<id>", elements: { "<id>": { type, props, children: ["<id>", ...] } } }`
   (formato do `@json-render/react`). Documente no README o mapeamento para os padrões abertos do
   mercado: **Open-JSON-UI** (padronização aberta do schema interno de UI declarativa da própria
   OpenAI) e **A2UI** (spec declarativa do Google, JSONL com envelopes `surfaceUpdate` /
   `dataModelUpdate` / `beginRendering`). Não copie código deles — implemente e cite.
3. **Parser tolerante a streaming.** A resposta chega em pedaços: parse incremental tolerando
   token parcial, cercas de código e preâmbulo em prosa; só renderiza o que valida.
4. **Validação é a rede de segurança.** Tudo passa por Zod antes de virar React. Nada de
   `dangerouslySetInnerHTML`, nada de executar JS que veio do modelo, nada de componente
   inventado. Item inválido é descartado com erro visível (não quebra a página).
5. **Canal de ação (o que faz a coisa ser interativa).** Componentes do catálogo podem despachar
   eventos (submit de formulário, clique, cálculo) → o evento volta como resultado de tool/step
   para o modelo → o modelo responde com **nova spec** que re-renderiza no mesmo lugar.
   Prove com a calculadora (usuário digita → resultado aparece) e com um formulário que gera um
   cartão novo.
6. **Provider-agnóstico com chave do usuário.** Suporte a endpoint OpenAI-compatible e Anthropic
   via `.env` (`.env.example` no repo, `.env` no .gitignore). **E obrigatoriamente um modo demo
   offline**: sem nenhuma chave, a app roda com specs canned determinísticas para as 3 demos.
   Sem isso não dá pra provar que funciona — e é o que o README mostra.
7. **Stack enxuta e real**: Vite + React + TypeScript, Zod, SSE para streaming. Sem kit de UI
   pesado, sem Next.js, sem backend obrigatório (se precisar de proxy para a API, faça um proxy
   mínimo em Node no próprio repo).

## Provas exigidas antes de dizer "pronto"

- `npm ci && npm run build` verde e `npm test` verde (vitest) com testes reais de: (a) parser
  parcial/streaming, (b) validador rejeitando tipo e props desconhecidos, (c) o loop de ação
  (evento → nova spec). Cole a saída real no final da sua resposta.
- **Print real** da app rodando (PNG salvo em `docs/screenshot-*.png` e usado no README) — sai do
  app de verdade, não é mockup.
- `README.md` com: o problema, como rodar em 3 comandos, o modo demo, a spec e o catálogo, o
  canal de ação, comparação com Open-JSON-UI/A2UI, e o print. Licença MIT.

## Publicação no GitHub (atenção)

Publique como repositório **público na conta pessoal `muraphx`** — rode `gh auth status` e, se a
conta ativa for `murioliveira`, troque com `gh auth switch -u muraphx` **antes** de criar o repo.
Nunca crie nada sob a conta/org da Liquid (risco de IP do empregador — regra dura do dono).
Nome sugerido: `intelligent-ui` (ou `generative-ui-lab`). Commit com mensagem descritiva, push, e
confirme que a URL responde.

## ADENDO — você NÃO commita e NÃO publica

Regra de ouro da delegação: você é o **implementador**, o orquestrador é o revisor. Portanto:

- **Não** rode `git commit`, `git push`, `gh repo create`, nem crie repositório. Deixe a árvore de
  trabalho pronta (arquivos criados/modificados, não commitados).
- Rode as provas (`npm ci`, `npm test`, `npm run build`) e reporte a saída **real**, colada.
- Salve o print em `docs/screenshot-*.png` como pedido.
- No relatório final informe: caminho dos arquivos, saída real dos comandos, e **o que não
  funcionou** ou ficou de fora. Se algum passo exigir credencial que você não tem, diga — não
  contorne em silêncio.

A publicação no GitHub é minha (o orquestrador faz, na conta pessoal correta).

## Resposta final (obrigatória, em texto simples)

1. URL do repositório público + SHA do commit.
2. Saída real de `npm test` e `npm run build`.
3. Caminho do print e o que a demo offline mostra.
4. O que **não** está funcionando / ficou de fora (honesto).
5. Qualquer bloqueio (conta do GitHub, chave de API, dependência) — diga em vez de contornar em
   silêncio.
