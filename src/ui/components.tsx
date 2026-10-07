import { useId, useMemo, useState, type FormEvent } from 'react';
import type { Props } from './catalog';
import type { UIAction } from '../generation/provider';
import { completion, computeResult, createLiveEmitter, formatResult, parseNumberField, validateLiveFields, type LiveHandler, type Operation } from './live';

export type ActionHandler = (action: UIAction) => void;
export type { LiveEvent, LiveHandler, LivePayload } from './live';
type Interactive = { elementId: string; onAction: ActionHandler; disabled: boolean; onLive?: LiveHandler };

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
  const [operation, setOperation] = useState<Operation>(props.operation ?? 'add');
  // Calcula a cada tecla: sem ida ao provider, sem espera. O envio continua existindo para quando
  // a pessoa quer que a RESPOSTA mude — a conta em si é local e instantânea.
  const live = computeResult(parseNumberField(a).value, parseNumberField(b).value, operation);
  const emit = useMemo(() => createLiveEmitter(props.onLive), [props.onLive]);
  const announce = (nextA: string, nextB: string, nextOperation: Operation) => {
    const result = computeResult(parseNumberField(nextA).value, parseNumberField(nextB).value, nextOperation);
    emit({ elementId: props.elementId, name: 'live:calculate', payload: { a: nextA, b: nextB, operation: nextOperation, result: result.value === null ? '' : String(result.value) } });
  };
  function submit(event: FormEvent) { event.preventDefault(); props.onAction({ elementId: props.elementId, name: props.action, payload: { a: Number(a), b: Number(b), operation } }); }
  return <form className="interactive-card" onSubmit={submit}><h3>{props.title}</h3><p>{props.description}</p><fieldset disabled={props.disabled}><div className="calculator-fields"><label>Primeiro valor<input required type="number" step="any" min="-1000000000000" max="1000000000000" value={a} onChange={e => { setA(e.target.value); announce(e.target.value, b, operation); }} /></label><label>Operação<select value={operation} onChange={e => { const next = e.target.value as Operation; setOperation(next); announce(a, b, next); }}><option value="add">+ Somar</option><option value="subtract">− Subtrair</option><option value="multiply">× Multiplicar</option><option value="divide">÷ Dividir</option></select></label><label>Segundo valor<input required type="number" step="any" min="-1000000000000" max="1000000000000" value={b} onChange={e => { setB(e.target.value); announce(a, e.target.value, operation); }} /></label></div>
    <div className="live-readout" role="status" aria-live="polite"><span className="live-chip">tempo real</span><strong>{live.value === null ? '—' : formatResult(live.value)}</strong><small>{live.error ?? 'recalculado a cada tecla'}</small></div>
    <button className="button primary" type="submit">Enviar resultado ao provider <span aria-hidden="true">↗</span></button></fieldset></form>;
}
export function Form(props: Props<'Form'> & Interactive) {
  const [values, setValues] = useState<Record<string, string>>({});
  // Validação e prévia acompanham a digitação; o envio continua sendo o pedido ao provider.
  const states = validateLiveFields(props.fields, values);
  const percent = completion(states);
  const emit = useMemo(() => createLiveEmitter(props.onLive), [props.onLive]);
  const filled = states.filter(state => state.filled);
  const missing = states.filter(state => state.error);
  function update(name: string, value: string, fieldLabel: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    emit({ elementId: props.elementId, name: 'live:form', payload: { campo: fieldLabel, valor: value.slice(0, 120), preenchimento: `${completion(validateLiveFields(props.fields, next))}%` } });
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); props.onAction({ elementId: props.elementId, name: props.action, payload: Object.fromEntries(props.fields.map(f => [f.name, String(data.get(f.name) ?? '').trim()])) }); }
  return <form className="interactive-card" onSubmit={submit}><h3>{props.title}</h3><p>{props.description}</p>
    <div className="live-meter" role="status" aria-live="polite"><span className="live-chip">tempo real</span><div className="live-meter-track"><i style={{ width: `${percent}%` }} /></div><b>{percent}%</b><small>{missing.length ? `${missing.length} campo(s) faltando` : 'pronto para enviar'}</small></div>
    <fieldset disabled={props.disabled}>{props.fields.map(field => { const state = states.find(item => item.name === field.name)!; return <label key={field.name} className={state.error ? 'has-error' : ''}>{field.label}{!field.required && <span className="optional"> opcional</span>}<input name={field.name} placeholder={field.placeholder} required={field.required} maxLength={160} value={values[field.name] ?? ''} onChange={e => update(field.name, e.target.value, field.label)} />{state.error && <span className="field-hint" role="alert">{state.error}</span>}</label>; })}<button className="button primary" type="submit">{props.submitLabel} <span aria-hidden="true">↗</span></button></fieldset>
    {filled.length >= 1 && <aside className="live-preview" aria-label="Prévia ao vivo"><span className="live-chip">prévia ao vivo</span>{filled.map(state => <div key={state.name}><small>{state.label}</small><strong>{state.value}</strong></div>)}</aside>}</form>;
}
export function Button(props: Props<'Button'> & Interactive) {
  return <button type="button" disabled={props.disabled} className={`button ${props.variant ?? 'primary'}`} onClick={() => props.onAction({ elementId: props.elementId, name: props.action, payload: {} })}>{props.label}</button>;
}
export function MiniGame(props: Props<'MiniGame'> & Interactive) {
  const [hovered, setHovered] = useState<string | null>(null);
  return <section className="interactive-card"><h3>{props.title}</h3><p>{props.question}</p><div className="game-options">{props.options.map((choice, i) => <button key={i} type="button" className={`button secondary ${hovered === choice ? 'previewing' : ''}`} aria-pressed={hovered === choice} disabled={props.disabled} onFocus={() => setHovered(choice)} onMouseEnter={() => setHovered(choice)} onMouseLeave={() => setHovered(null)} onClick={() => props.onAction({ elementId: props.elementId, name: props.action, payload: { choice } })}>{choice}</button>)}</div><p className="live-note" role="status" aria-live="polite"><span className="live-chip">tempo real</span>{hovered ? `prévia da escolha: ${hovered}` : 'passe o mouse para pré-visualizar'}</p></section>;
}
export function ProfileCard(props: Props<'ProfileCard'>) {
  return <article className="profile-card"><span className="profile-avatar" aria-hidden="true">{props.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('')}</span><span className="eyebrow">OLÁ, EU SOU</span><h2>{props.name}</h2><p className="profile-role">{props.role}</p>{props.bio && <p>{props.bio}</p>}<span className="profile-tag">✓ {props.tag}</span></article>;
}
