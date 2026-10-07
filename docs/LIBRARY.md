# Usar a intelligent-ui em outro projeto

A biblioteca é o ciclo inteiro de UI generativa sem nenhuma decisão visual embutida: contrato da
interface, validação, streaming, canal de ações, providers e design system. O app deste repositório
é só um consumidor — e há um consumidor ainda menor em [`examples/minimal`](../examples/minimal).

## O que você recebe

| Peça | Para que serve |
| --- | --- |
| `validateUISpec`, `UISpecSchema`, `catalog` | O contrato: spec plana `{root, elements}`, catálogo fechado, descarte do que não pertence |
| `StreamingSpecParser` | Lê a resposta em pedaços e valida cada spec completa, sem reparar JSON parcial |
| `UIRenderer`, `createUIRenderer`, `defaultComponents` | Renderiza a spec com os SEUS componentes |
| `prepareAction` | O canal de ação: valida o evento contra a interface atual antes de devolver ao provider |
| `GenerativeUIController` | O ciclo: gerar → validar → interagir → nova spec |
| `DemoProvider`, `RemoteProvider`, `UIProvider` | Providers prontos e o contrato para escrever o seu |
| `DesignSystemSchema`, `presets`, `resolveDesignSystem`, `applyDesignSystem`, `designSystemVars` | Design system como dado validado |

## Instalar

```sh
npm install intelligent-ui react react-dom zod
```

React, ReactDOM e Zod são **peer dependencies**: você traz a sua versão (React 19+, Zod 4+).
O pacote publica um único entry ESM com os tipos ao lado:

```
dist/lib/index.js          # ESM, externals: react, react-dom, zod
dist/lib/lib/index.d.ts    # tipos
```

Para gerar localmente: `npm run build:lib`.

## Receita 1 · Renderizar com os seus componentes

```tsx
import { createUIRenderer, type UIAction } from 'intelligent-ui';

const Renderer = createUIRenderer({
  Markdown: ({ content }) => <MeuProse html={markdownToHtml(content)} />,
  MetricCard: ({ label, value }) => <MeuCard titulo={label} valor={value} />,
  Button: ({ label, action, elementId, onAction }) => (
    <MeuBotao onClick={() => onAction({ elementId, name: action, payload: {} })}>{label}</MeuBotao>
  ),
});

<Renderer spec={spec} onAction={dispatch} />
```

Três regras que valem sempre:

- **`Stack` é estrutural.** A árvore é composta pelo renderer; o mapa decide só as folhas.
- **Tipo fora do seu mapa não renderiza nada** — nada é inventado, nada quebra a árvore.
- **Você pode entregar só alguns tipos.** Os que faltarem simplesmente não aparecem.

Quer o visual pronto? Use `defaultComponents` como base e sobrescreva o que quiser.

## Receita 2 · Escrever o seu provider

O contrato é um gerador assíncrono de strings. Não importa se vem de HTTP, de uma fila ou de um
arquivo: a biblioteca valida cada pedaço que entra.

```ts
import type { UIProvider, GenerationRequest } from 'intelligent-ui';

class MeuProvider implements UIProvider {
  async *stream(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<string> {
    const response = await fetch('/minha-api/ui', {
      method: 'POST', signal,
      body: JSON.stringify({ prompt: request.prompt, action: request.action, spec: request.spec }),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  }
}
```

`request.action` chega quando o usuário interagiu: devolva a **spec completa** de substituição, não um
patch. O `RemoteProvider` deste repositório já faz isso contra o proxy em `server/index.ts`
(OpenAI-compatible ou Anthropic Messages, chave só no servidor).

## Receita 3 · Design system próprio

O contrato tem 3 decisões (`mode`, `font`, `radius`), uma de profundidade (`depth`) e 14 cores em hex.
Tudo validado com Zod — o que não bate, não aplica.

```ts
import { applyDesignSystem, designSystemVars, type DesignSystem } from 'intelligent-ui';

const meu: DesignSystem = {
  name: 'Cinema', mode: 'dark', font: 'serif', radius: 3, depth: 'soft',
  colors: { bg: '#12100e', /* ...as 13 restantes */ },
};

applyDesignSystem(meu);                          // escreve as custom properties no <html>
const vars = designSystemVars(meu);              // ou use só o mapa de variáveis
```

- `applyDesignSystem` escreve `--bg`, `--surface`, `--accent`, `--radius`, `--shadow`, `--selection`,
  `--font-family`… e marca `data-theme`, `data-depth`, `data-font`, `data-design-system`.
- Aplique numa `<div>` em vez do `<html>` para tematizar **só uma superfície**.
- O CSS de quem consome decide como usar: a biblioteca nunca importa folha de estilo.

**O detalhe que interessa:** a própria spec pode declarar o design system que quer —
`"designSystem": "terminal"` ou o objeto completo. A resposta escolhe a sua linguagem visual, e a
aplicação aplica. É o que as demos fazem: análise de receita vem em papel, calculadora em terminal,
cartão de perfil em brutal.

## Receita 4 · Escrever a spec sem modelo nenhum

A spec é JSON. Se você gera o JSON por regra de negócio — não por LLM — a biblioteca serve igual:

```ts
const spec = {
  root: 'root', designSystem: 'clinico',
  elements: {
    root: { type: 'Stack', props: { direction: 'vertical' }, children: ['texto'] },
    texto: { type: 'Markdown', props: { content: '## Sem modelo\nA interface também é dado.' }, children: [] },
  },
};
```

Para deixar o modelo ciente do catálogo, `catalogPrompt` já entrega o contrato em JSON Schema.

## Limites (de propósito)

- Só `Stack` aceita filhos; profundidade máxima 24; até 200 elementos.
- IDs precisam começar com letra; `constructor`, `prototype` e `__proto__` são recusados.
- Nenhum HTML, JavaScript, URL ou propriedade fora do catálogo passa.
- O que o modelo devolve é **texto**: nada é interpretado como código.
- O renderer é a fronteira: mesmo chamado direto, valida antes de desenhar.

## Ver o exemplo

```sh
npm run example          # http://127.0.0.1:4300
npm run example:shot     # print real em docs/screenshot-example*.png
```

`examples/minimal/main.tsx` tem 3 componentes próprios, um provider de 20 linhas e um design system
próprio — o menor consumidor possível da biblioteca.
