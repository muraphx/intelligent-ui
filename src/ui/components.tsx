import { useId, useState, type FormEvent } from 'react';
import type { Props } from './catalog';
import type { UIAction } from '../generation/provider';

export type ActionHandler = (action: UIAction) => void;
type Interactive = { elementId: string; onAction: ActionHandler; disabled: boolean };

export function Markdown({ content }: Props<'Markdown'>) {
  // Deliberately limited Markdown: headings, paragraphs and bold. All content stays escaped React text.
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
  return <div className="markdown">{content.split('\n').filter(Boolean).map((line, i) => /^#{1,3} /.test(line) ? <h2 key={i}>{inline(line.replace(/^#{1,3} /, ''))}</h2> : <p key={i}>{inline(line)}</p>)}</div>;
}
export function MetricCard(props: Props<'MetricCard'>) {
  return <article className="metric-card"><h3>{props.label}</h3><div className="metric-value">{props.value}</div>{props.trend && <span className={`metric-trend ${props.tone === 'positive' ? 'positive' : ''}`}>↗ {props.trend}</span>}<p>{props.detail}</p></article>;
}
export function Chart(props: Props<'Chart'>) {
  const id = useId();
  const max = Math.max(...props.points.map(p => Math.abs(p.value)), 1);
  const signed = props.points.some(p => p.value < 0);
  const baseline = signed ? 120 : 210;
  const height = signed ? 90 : 175;
  const width = 650 / props.points.length;
  const format = (value: number) => `${props.unit ?? ''} ${value.toLocaleString('pt-BR')}`.trim();
  const tick = (value: number) => Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(1)).toLocaleString('pt-BR')}k` : Number(value.toFixed(2)).toLocaleString('pt-BR');
  return <figure className="chart-card"><figcaption><div><h3>{props.title}</h3><p>{props.subtitle}</p></div><span className="chart-legend"><i /> Receita</span></figcaption>
    <svg viewBox="0 0 730 265" role="img" aria-labelledby={`${id}-title ${id}-desc`}><title id={`${id}-title`}>{props.title}</title><desc id={`${id}-desc`}>{props.points.map(p => `${p.label}: ${format(p.value)}`).join('; ')}</desc>
      {(signed ? [-1, 0, 1] : [0, 1 / 3, 2 / 3, 1]).map(fraction => <g key={fraction}><line className="chart-grid" x1="55" x2="718" y1={baseline - fraction * height} y2={baseline - fraction * height} /><text className="chart-tick" x="42" y={baseline - fraction * height + 4} textAnchor="end">{tick(max * fraction)}</text></g>)}
      {props.points.map((point, i) => { const h = Math.abs(point.value) / max * height; const x = 60 + i * width + width * .2; return <g key={i}><rect className={i === props.points.length - 1 ? 'chart-bar final' : 'chart-bar'} x={x} y={point.value >= 0 ? baseline - h : baseline} width={width * .58} height={Math.max(h, 1)} rx="5"><title>{point.label}: {format(point.value)}</title></rect><text className="chart-label" x={x + width * .29} y="249" textAnchor="middle">{point.label}</text></g>; })}
    </svg>
    <details className="chart-table"><summary>Ver dados em tabela</summary><table><thead><tr><th>Período</th><th>Valor</th></tr></thead><tbody>{props.points.map((p, i) => <tr key={i}><td>{p.label}</td><td>{format(p.value)}</td></tr>)}</tbody></table></details>
  </figure>;
}
export function Calculator(props: Props<'Calculator'> & Interactive) {
  const [a, setA] = useState(String(props.initialA ?? 0));
  const [b, setB] = useState(String(props.initialB ?? 0));
  const [operation, setOperation] = useState(props.operation ?? 'add');
  function submit(event: FormEvent) { event.preventDefault(); props.onAction({ elementId: props.elementId, name: props.action, payload: { a: Number(a), b: Number(b), operation } }); }
  return <form className="interactive-card" onSubmit={submit}><h3>{props.title}</h3><p>{props.description}</p><fieldset disabled={props.disabled}><div className="calculator-fields"><label>Primeiro valor<input required type="number" step="any" min="-1000000000000" max="1000000000000" value={a} onChange={e => setA(e.target.value)} /></label><label>Operação<select value={operation} onChange={e => setOperation(e.target.value as typeof operation)}><option value="add">+ Somar</option><option value="subtract">− Subtrair</option><option value="multiply">× Multiplicar</option><option value="divide">÷ Dividir</option></select></label><label>Segundo valor<input required type="number" step="any" min="-1000000000000" max="1000000000000" value={b} onChange={e => setB(e.target.value)} /></label></div><button className="button primary" type="submit">Calcular resultado <span aria-hidden="true">↗</span></button></fieldset></form>;
}
export function Form(props: Props<'Form'> & Interactive) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); props.onAction({ elementId: props.elementId, name: props.action, payload: Object.fromEntries(props.fields.map(f => [f.name, String(values.get(f.name) ?? '').trim()])) }); }
  return <form className="interactive-card" onSubmit={submit}><h3>{props.title}</h3><p>{props.description}</p><fieldset disabled={props.disabled}>{props.fields.map(field => <label key={field.name}>{field.label}{!field.required && <span className="optional"> opcional</span>}<input name={field.name} placeholder={field.placeholder} required={field.required} maxLength={160} /></label>)}<button className="button primary" type="submit">{props.submitLabel} <span aria-hidden="true">↗</span></button></fieldset></form>;
}
export function Button(props: Props<'Button'> & Interactive) {
  return <button type="button" disabled={props.disabled} className={`button ${props.variant ?? 'primary'}`} onClick={() => props.onAction({ elementId: props.elementId, name: props.action, payload: {} })}>{props.label}</button>;
}
export function MiniGame(props: Props<'MiniGame'> & Interactive) {
  return <section className="interactive-card"><h3>{props.title}</h3><p>{props.question}</p><div className="game-options">{props.options.map((choice, i) => <button key={i} type="button" className="button secondary" disabled={props.disabled} onClick={() => props.onAction({ elementId: props.elementId, name: props.action, payload: { choice } })}>{choice}</button>)}</div></section>;
}
export function ProfileCard(props: Props<'ProfileCard'>) {
  return <article className="profile-card"><span className="profile-avatar" aria-hidden="true">{props.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('')}</span><span className="eyebrow">OLÁ, EU SOU</span><h2>{props.name}</h2><p className="profile-role">{props.role}</p>{props.bio && <p>{props.bio}</p>}<span className="profile-tag">✓ {props.tag}</span></article>;
}
