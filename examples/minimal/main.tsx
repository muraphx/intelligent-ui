import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  applyDesignSystem, createUIRenderer, GenerativeUIController,
  type DesignSystem, type GenerationRequest, type UIAction, type UIProvider,
} from 'intelligent-ui';
import './example.css';

/**
 * Exemplo mínimo de consumo da biblioteca, em três partes:
 * 1. o projeto traz os PRÓPRIOS componentes;
 * 2. o projeto traz o PRÓPRIO provider (aqui, um gerador local — no lugar dele caberia sua API);
 * 3. o projeto traz o PRÓPRIO design system.
 * Nada disso exige tocar no código da biblioteca.
 */

// 1 · Componentes próprios. Só os tipos usados aqui; o resto simplesmente não renderiza.
const Renderer = createUIRenderer({
  Markdown: ({ content }: { content: string }) => (
    <div className="ex-prose">
      {content.split('\n').map((line, index) => line.startsWith('## ')
        ? <h2 key={index}>{line.slice(3)}</h2>
        : <p key={index}>{line}</p>)}
    </div>
  ),
  MetricCard: ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
    <div className="ex-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
  ),
  Button: ({ label, action, elementId, onAction }: { label: string; action: string; elementId: string; onAction: (a: UIAction) => void }) => (
    <button className="ex-button" onClick={() => onAction({ elementId, name: action, payload: {} })}>{label}</button>
  ),
});

// 2 · Provider próprio: qualquer coisa que emitir a spec em pedaços serve. Sem rede, sem chave.
const first = JSON.stringify({
  root: 'root', designSystem: 'noturno',
  elements: {
    root: { type: 'Stack', props: { direction: 'vertical' }, children: ['intro', 'metrics', 'next'] },
    intro: { type: 'Markdown', props: { content: '## Um provider de 20 linhas\nVocê emite a spec em pedaços; a biblioteca valida cada pedaço e substitui a interface.' }, children: [] },
    metrics: { type: 'Stack', props: { direction: 'horizontal' }, children: ['m1', 'm2'] },
    m1: { type: 'MetricCard', props: { label: 'Componentes seus', value: '3', detail: 'tipos implementados neste exemplo' }, children: [] },
    m2: { type: 'MetricCard', props: { label: 'Linhas de glue', value: '0', detail: 'nenhuma alteração na biblioteca' }, children: [] },
    next: { type: 'Button', props: { label: 'Gerar a próxima interface', action: 'next' }, children: [] },
  },
});
const second = JSON.stringify({
  root: 'root', designSystem: 'clinico',
  elements: {
    root: { type: 'Stack', props: { direction: 'vertical' }, children: ['intro', 'm1', 'again'] },
    intro: { type: 'Markdown', props: { content: '## A ação voltou ao provider\nO clique virou um pedido; a resposta trocou os tokens e os dados.' }, children: [] },
    m1: { type: 'MetricCard', props: { label: 'Revisão da interface', value: '2', detail: 'a spec inteira foi substituída' }, children: [] },
    again: { type: 'Button', props: { label: 'Voltar', action: 'back' }, children: [] },
  },
});

class InlineProvider implements UIProvider {
  async *stream(request: GenerationRequest): AsyncIterable<string> {
    const source = request.action ? (request.action.name === 'back' ? first : second) : first;
    for (let index = 0; index < source.length; index += 48) {
      await new Promise(resolve => setTimeout(resolve, 6));
      yield source.slice(index, index + 48);
    }
  }
}

// 3 · Design system próprio, passado por objeto (a biblioteca valida e aplica).
const meuSistema: DesignSystem = {
  name: 'Cinema', mode: 'dark', font: 'serif', radius: 3, depth: 'soft',
  colors: {
    bg: '#12100e', surface: '#191612', subtle: '#1e1a15', sidebar: '#15120f',
    text: '#f2ece1', muted: '#a89c88', line: '#332c23',
    accent: '#e0a34a', accentHover: '#f0b866', accentSoft: '#2a2318', accentInk: '#f4c883',
    chart: '#b98342', danger: '#e08a7a', dangerBg: '#2c1d1a',
  },
};
applyDesignSystem(meuSistema);

function Exemplo() {
  const [controller] = useState(() => new GenerativeUIController(new InlineProvider()));
  const [state, setState] = useState(controller.state);
  useEffect(() => controller.subscribe(() => setState({ ...controller.state })), [controller]);
  useEffect(() => { void controller.generate('analytics', 'monte uma interface'); }, [controller]);
  const dispatch = (action: UIAction) => { void controller.dispatch(action); };

  return <div className="ex-shell">
    <div className="ex-kicker">intelligent-ui · exemplo de consumo</div>
    <h1 className="ex-title">Use o ciclo inteiro no seu projeto</h1>
    <p className="ex-lead">Este app não importa nenhum componente interno: ele traz os próprios, o próprio provider e o próprio design system — e recebe validação, streaming, canal de ações e tokens de graça.</p>
    <div className="ex-panel"><Renderer spec={state.spec} onAction={dispatch} disabled={state.status === 'streaming'} /></div>
    <div className="ex-cycle">
      <span>status <b>{state.status}</b></span>
      <span>fragmentos <b>{state.chunks}</b></span>
      <span>revisão <b>{state.revision}</b></span>
      <span>erros <b>{state.errors.length}</b></span>
    </div>
    <ol className="ex-log">{state.events.slice(-4).map((event, index) => <li key={index}><b>{event.name}</b> — {event.detail}</li>)}</ol>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Exemplo /></StrictMode>);
