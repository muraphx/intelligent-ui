import { useId, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button as BaseButton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Props } from './catalog';
import type { UIAction } from '../generation/provider';
import { completion, computeResult, createLiveEmitter, formatResult, parseNumberField, validateLiveFields, type LiveHandler, type Operation } from './live';

export type ActionHandler = (action: UIAction) => void;
export type { LiveEvent, LiveHandler, LivePayload } from './live';
type Interactive = { elementId: string; onAction: ActionHandler; disabled: boolean; onLive?: LiveHandler };

const operations: { value: Operation; label: string }[] = [
  { value: 'add', label: '+ Somar' },
  { value: 'subtract', label: '− Subtrair' },
  { value: 'multiply', label: '× Multiplicar' },
  { value: 'divide', label: '÷ Dividir' },
];

/** Marca onde a interface reagiu sozinha, sem ida ao provider. */
function LiveChip({ label }: { label: string }) {
  return <span className="live-chip inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>;
}

export function Markdown({ content }: Props<'Markdown'>) {
  // Deliberately limited Markdown: headings, paragraphs and bold. All content stays escaped React text.
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong> : part);
  const blocks = content.split('\n').filter(Boolean);
  return <div className="space-y-2">{blocks.map((line, i) => /^#{1,3} /.test(line)
    ? <h2 key={i} className="font-sans text-lg font-semibold tracking-tight text-foreground">{inline(line.replace(/^#{1,3} /, ''))}</h2>
    : <p key={i} className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{inline(line)}</p>)}</div>;
}

export function MetricCard(props: Props<'MetricCard'>) {
  return <Card className="min-w-[168px] flex-1 gap-0 py-4">
    <CardHeader className="gap-1 px-4">
      <CardTitle className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{props.label}</CardTitle>
      <div className="metric-value font-mono text-3xl leading-none font-semibold tracking-tight tabular-nums text-card-foreground">{props.value}</div>
    </CardHeader>
    <CardContent className="px-4">
      {props.trend && <Badge variant={props.tone === 'positive' ? 'default' : 'secondary'} className="mt-2 font-mono text-[11px] tabular-nums"><ArrowUpRight className="size-3" aria-hidden="true" data-icon="inline-start" />{props.trend}</Badge>}
      {props.detail && <p className="mt-2 text-xs text-muted-foreground">{props.detail}</p>}
    </CardContent>
  </Card>;
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
  const gridlines = signed ? [-1, 0, 1] : [0, 1 / 3, 2 / 3, 1];
  return <Card className="chart-card w-full gap-0 py-5">
    <CardHeader className="flex-row items-start justify-between gap-3 px-5">
      <div>
        <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">{props.title}</CardTitle>
        {props.subtitle && <CardDescription className="mt-1 text-xs">{props.subtitle}</CardDescription>}
      </div>
      <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase"><i className="size-2 rounded-full bg-chart-1" aria-hidden="true" /> Receita</span>
    </CardHeader>
    <CardContent className="px-5">
      <svg viewBox="0 0 730 265" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full overflow-visible">
        <title id={`${id}-title`}>{props.title}</title>
        <desc id={`${id}-desc`}>{props.points.map(p => `${p.label}: ${format(p.value)}`).join('; ')}</desc>
        {gridlines.map(fraction => <g key={fraction}>
          <line className="chart-grid" x1="55" x2="718" y1={baseline - fraction * height} y2={baseline - fraction * height} stroke="currentColor" strokeWidth="1" />
          <text className="chart-tick" x="42" y={baseline - fraction * height + 4} textAnchor="end" fill="currentColor">{tick(max * fraction)}</text>
        </g>)}
        {props.points.map((point, i) => {
          const barHeight = Math.abs(point.value) / max * height;
          const x = 60 + i * width + width * .2;
          return <g key={i}>
            <rect className={cn('chart-bar', i === props.points.length - 1 && 'chart-bar final')} x={x} y={point.value >= 0 ? baseline - barHeight : baseline} width={width * .58} height={Math.max(barHeight, 1)} rx="5">
              <title>{point.label}: {format(point.value)}</title>
            </rect>
            <text className="chart-label" x={x + width * .29} y="249" textAnchor="middle" fill="currentColor">{point.label}</text>
          </g>;
        })}
      </svg>
    </CardContent>
    <details className="chart-table mx-5 mt-1 border-t border-border pt-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground">Ver dados em tabela</summary>
      <table className="mt-2 w-full border-collapse text-left"><thead><tr className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><th className="py-1 font-medium">Período</th><th className="py-1 font-medium">Valor</th></tr></thead>
        <tbody>{props.points.map((p, i) => <tr key={i} className="border-t border-border"><td className="py-1.5 text-card-foreground">{p.label}</td><td className="py-1.5 font-mono tabular-nums text-card-foreground">{format(p.value)}</td></tr>)}</tbody></table>
    </details>
  </Card>;
}

export function Calculator(props: Props<'Calculator'> & Interactive) {
  const firstId = useId();
  const operationId = useId();
  const secondId = useId();
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
  return <Card className="interactive-card w-full gap-0 py-5">
    <CardHeader className="gap-1 px-5">
      <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">{props.title}</CardTitle>
      {props.description && <CardDescription className="text-xs">{props.description}</CardDescription>}
    </CardHeader>
    <CardContent className="px-5">
      <form onSubmit={submit}>
        <fieldset disabled={props.disabled} className="m-0 min-w-0 border-0 p-0">
          <div className="calculator-fields grid gap-3 sm:grid-cols-[1fr_1.1fr_1fr]">
            <div className="grid gap-1.5"><Label htmlFor={firstId} className="text-xs text-muted-foreground">Primeiro valor</Label><Input id={firstId} required type="number" step="any" min={-1e12} max={1e12} value={a} onChange={event => { setA(event.target.value); announce(event.target.value, b, operation); }} className="font-mono tabular-nums" /></div>
            <div className="grid gap-1.5"><Label htmlFor={operationId} className="text-xs text-muted-foreground">Operação</Label>
              <Select value={operation} onValueChange={value => { const next = value as Operation; setOperation(next); announce(a, b, next); }}>
                <SelectTrigger id={operationId} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{operations.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor={secondId} className="text-xs text-muted-foreground">Segundo valor</Label><Input id={secondId} required type="number" step="any" min={-1e12} max={1e12} value={b} onChange={event => { setB(event.target.value); announce(a, event.target.value, operation); }} className="font-mono tabular-nums" /></div>
          </div>
          <div className="live-readout mt-4 flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5" role="status" aria-live="polite">
            <LiveChip label="tempo real" />
            <strong className="font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums text-card-foreground">{live.value === null ? '—' : formatResult(live.value)}</strong>
            <small className="text-[11px] text-muted-foreground">{live.error ?? 'recalculado a cada tecla'}</small>
          </div>
          <BaseButton type="submit" className="mt-4">Enviar resultado ao provider <ArrowUpRight data-icon="inline-end" /></BaseButton>
        </fieldset>
      </form>
    </CardContent>
  </Card>;
}

export function Form(props: Props<'Form'> & Interactive) {
  const groupId = useId();
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
  return <Card className="interactive-card w-full gap-0 py-5">
    <CardHeader className="gap-1 px-5">
      <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">{props.title}</CardTitle>
      {props.description && <CardDescription className="text-xs">{props.description}</CardDescription>}
    </CardHeader>
    <CardContent className="px-5">
      <form onSubmit={submit}>
        <div className="live-meter flex items-center gap-3" role="status" aria-live="polite">
          <LiveChip label="tempo real" />
          <Progress className="live-meter-track h-1.5 flex-1" value={percent} aria-label="Preenchimento do formulário" />
          <b className="font-mono text-xs tabular-nums text-card-foreground">{percent}%</b>
          <small className="text-[11px] text-muted-foreground">{missing.length ? `${missing.length} campo(s) faltando` : 'pronto para enviar'}</small>
        </div>
        <fieldset disabled={props.disabled} className="m-0 mt-4 min-w-0 border-0 p-0">
          <div className="grid gap-3">{props.fields.map(field => {
            const state = states.find(item => item.name === field.name)!;
            const fieldId = `${groupId}-${field.name}`;
            return <div key={field.name} className={cn('grid gap-1.5', state.error && 'has-error')}>
              <Label htmlFor={fieldId} className="text-xs text-muted-foreground">{field.label}{!field.required && <span className="optional ml-1 font-normal text-muted-foreground/70">opcional</span>}</Label>
              <Input id={fieldId} name={field.name} placeholder={field.placeholder} required={field.required} maxLength={160} value={values[field.name] ?? ''} onChange={event => update(field.name, event.target.value, field.label)} aria-invalid={state.error ? true : undefined} />
              {state.error && <span className="field-hint text-[11px] text-destructive" role="alert">{state.error}</span>}
            </div>;
          })}</div>
          <BaseButton type="submit" className="mt-4">{props.submitLabel} <ArrowUpRight data-icon="inline-end" /></BaseButton>
        </fieldset>
        {filled.length >= 1 && <aside className="live-preview mt-4 rounded-lg border border-border bg-muted/30 p-3" aria-label="Prévia ao vivo">
          <LiveChip label="prévia ao vivo" />
          <div className="mt-2 grid gap-2">{filled.map(state => <div key={state.name}><small className="block text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{state.label}</small><strong className="text-sm font-medium text-card-foreground">{state.value}</strong></div>)}</div>
        </aside>}
      </form>
    </CardContent>
  </Card>;
}

export function Button(props: Props<'Button'> & Interactive) {
  return <BaseButton type="button" variant={props.variant === 'secondary' ? 'secondary' : 'default'} disabled={props.disabled} onClick={() => props.onAction({ elementId: props.elementId, name: props.action, payload: {} })}>{props.label} <ArrowUpRight data-icon="inline-end" /></BaseButton>;
}

export function MiniGame(props: Props<'MiniGame'> & Interactive) {
  const [hovered, setHovered] = useState<string | null>(null);
  return <Card className="interactive-card w-full gap-0 py-5">
    <CardHeader className="gap-1 px-5">
      <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">{props.title}</CardTitle>
      <CardDescription className="text-xs">{props.question}</CardDescription>
    </CardHeader>
    <CardContent className="px-5">
      <div className="game-options flex flex-wrap gap-2">{props.options.map((choice, i) => <BaseButton key={i} type="button" variant={hovered === choice ? 'default' : 'outline'} aria-pressed={hovered === choice} disabled={props.disabled} onFocus={() => setHovered(choice)} onMouseEnter={() => setHovered(choice)} onMouseLeave={() => setHovered(null)} onBlur={() => setHovered(null)} onClick={() => props.onAction({ elementId: props.elementId, name: props.action, payload: { choice } })} className="previewing">{choice}</BaseButton>)}</div>
      <p className="live-note mt-3 flex items-center gap-2 text-[11px] text-muted-foreground" role="status" aria-live="polite"><LiveChip label="tempo real" />{hovered ? `prévia da escolha: ${hovered}` : 'passe o mouse para pré-visualizar'}</p>
    </CardContent>
  </Card>;
}

export function ProfileCard(props: Props<'ProfileCard'>) {
  const initials = props.name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <Card className="profile-card w-full gap-0 py-5">
    <CardContent className="flex flex-wrap items-start gap-4 px-5">
      <Avatar className="profile-avatar size-12 rounded-lg"><AvatarFallback className="rounded-lg bg-primary font-mono text-sm font-semibold text-primary-foreground">{initials}</AvatarFallback></Avatar>
      <div className="min-w-[200px] flex-1">
        <span className="eyebrow text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">olá, eu sou</span>
        <h2 className="mt-1 font-sans text-xl font-semibold tracking-tight text-card-foreground">{props.name}</h2>
        <p className="profile-role mt-0.5 text-sm text-muted-foreground">{props.role}</p>
      </div>
      {props.tag && <Badge variant="secondary" className="profile-tag gap-1"><Check className="size-3" aria-hidden="true" />{props.tag}</Badge>}
    </CardContent>
    {props.bio && <><Separator className="my-4" /><CardContent className="px-5"><p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{props.bio}</p></CardContent></>}
  </Card>;
}
