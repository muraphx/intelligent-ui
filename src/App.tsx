import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from 'react';
import { GenerativeUIController } from './generation/controller';
import { DemoProvider } from './generation/demo-provider';
import { RemoteProvider } from './generation/remote-provider';
import { demos } from './generation/demo-specs';
import type { DemoId } from './generation/provider';
import { UIRenderer } from './ui/renderer';
import { catalog } from './ui/catalog';
import {
  applyDesignSystem, designSystemIds, designSystemToJson, designSystemVars, parseDesignSystemJson,
  preset, presets, type DesignSystem, type DesignSystemId,
} from './design/system';

const icons = ['▥', '∑', '◉'];
const STORAGE_KEY = 'intelligent-ui:design-system';

function loadStoredSystem(): DesignSystem | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseDesignSystemJson(raw).system;
  } catch {
    return null;
  }
}

export default function App() {
  const [controller] = useState(() => new GenerativeUIController(new DemoProvider()));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [demo, setDemo] = useState<DemoId>('analytics');
  const [mode, setMode] = useState('demo');
  const [prompt, setPrompt] = useState(demos[0].prompt);
  const [sentPrompt, setSentPrompt] = useState(demos[0].prompt);
  const [tab, setTab] = useState<'preview' | 'spec'>('preview');
  const [help, setHelp] = useState(false);
  const [customSystem, setCustomSystem] = useState<DesignSystem | null>(loadStoredSystem);
  const [activeId, setActiveId] = useState<DesignSystemId>('papel');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // O sistema ativo da aplicação: um custom salvo vence o preset enquanto existir.
  const activeSystem = useMemo(() => customSystem ?? preset(activeId), [customSystem, activeId]);
  // A superfície usa o sistema que a resposta pediu; sem pedido, herda o ativo.
  const surfaceSystem = state.designSystem ?? activeSystem;
  const current = demos.find(d => d.id === demo)!;
  const busy = state.status === 'streaming';

  useEffect(() => { void controller.generate('analytics', demos[0].prompt); return () => controller.cancel(); }, [controller]);
  useEffect(() => { applyDesignSystem(activeSystem); }, [activeSystem]);

  function choosePreset(id: DesignSystemId) { setCustomSystem(null); setActiveId(id); setDraftError(null); try { localStorage.removeItem(STORAGE_KEY); } catch { /* modo privado */ } }
  function openEditor() { setDraft(designSystemToJson(activeSystem)); setDraftError(null); setEditing(true); }
  function applyDraft() {
    const result = parseDesignSystemJson(draft);
    if (!result.system) { setDraftError(result.error ?? 'Sistema inválido.'); return; }
    setCustomSystem(result.system); setDraftError(null); setCopied(false);
    try { localStorage.setItem(STORAGE_KEY, designSystemToJson(result.system)); } catch { /* modo privado */ }
  }
  function copyDraft() {
    void navigator.clipboard?.writeText(designSystemToJson(activeSystem)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }
  function resetCustom() { setCustomSystem(null); setDraftError(null); setEditing(false); setDraft(''); try { localStorage.removeItem(STORAGE_KEY); } catch { /* modo privado */ } }
  function chooseDemo(id: DemoId) { const chosen = demos.find(d => d.id === id)!; setDemo(id); setPrompt(chosen.prompt); setSentPrompt(chosen.prompt); setTab('preview'); void controller.generate(id, chosen.prompt); }
  function changeMode(value: string) { setMode(value); controller.setProvider(value === 'demo' ? new DemoProvider() : new RemoteProvider()); void controller.generate(demo, prompt); }
  function submit(event: FormEvent) { event.preventDefault(); if (!prompt.trim()) return; setSentPrompt(prompt.trim()); void controller.generate(demo, prompt.trim()); }
  const surfaceStyle = designSystemVars(surfaceSystem) as CSSProperties;

  return <div className="app-shell"><a className="skip-link" href="#main">Ir para o conteúdo</a>
    <aside className="sidebar"><a className="brand" href="/" aria-label="Intelligent UI, início"><span className="brand-mark" aria-hidden="true">▦</span><span>intelligent<span className="brand-ui">ui</span><small>GENERATIVE PLAYGROUND</small></span></a>
      <div className="workspace-label"><span className="workspace-avatar">P</span>Personal workspace <span className="workspace-chevron">⌄</span></div>
      <div className="nav-section-label">WORKSPACE</div><div className="nav-item selected"><span aria-hidden="true">◈</span> Playground <span className="small-tag">BETA</span></div>
      <button className="nav-item" onClick={() => setHelp(v => !v)}><span aria-hidden="true">▦</span> Catálogo de componentes <span className="nav-count">{Object.keys(catalog).length}</span></button>

      <div className="nav-section-label ds-label">DESIGN SYSTEM</div>
      <div className="ds-presets" role="group" aria-label="Design system da aplicação">{designSystemIds.map(id => <button key={id} className={`ds-preset ${!customSystem && activeId === id ? 'active' : ''}`} aria-pressed={!customSystem && activeId === id} onClick={() => choosePreset(id)}><span className="ds-swatches" aria-hidden="true"><i style={{ background: presets[id].colors.bg }} /><i style={{ background: presets[id].colors.accent }} /><i style={{ background: presets[id].colors.text }} /></span><span className="ds-preset-name">{presets[id].name}</span><span className="ds-preset-meta">{presets[id].mode === 'dark' ? 'escuro' : 'claro'} · {presets[id].font}</span></button>)}</div>
      <div className={`ds-current ${customSystem ? 'custom' : ''}`}><span className="ds-current-dot" style={{ background: activeSystem.colors.accent }} /><span><strong>{customSystem ? customSystem.name : presets[activeId].name}</strong><small>{customSystem ? 'tokens personalizados' : `preset · raio ${customSystem ? '' : presets[activeId].radius}px`}</small></span></div>
      <div className="ds-actions"><button className="ds-action" onClick={openEditor}>Editar tokens</button>{customSystem && <button className="ds-action" onClick={resetCustom}>Voltar ao preset</button>}</div>
      {editing && <div className="ds-editor"><div className="ds-editor-head"><strong>Tokens do sistema</strong><button aria-label="Fechar editor de tokens" onClick={() => setEditing(false)}>×</button></div><p className="ds-editor-hint">JSON validado com o mesmo contrato Zod que a interface usa. <code>mode</code>, <code>font</code>, <code>radius</code> (0–28), <code>depth</code> e 14 cores em hex.</p><textarea spellCheck={false} value={draft} onChange={e => { setDraft(e.target.value); setDraftError(null); }} rows={14} aria-label="JSON do design system" />{draftError && <p className="ds-error" role="alert">{draftError}</p>}<div className="ds-editor-actions"><button className="button small" onClick={applyDraft}>Aplicar</button><button className="button small secondary" onClick={copyDraft}>{copied ? 'Copiado' : 'Copiar'}</button></div></div>}

      <div className="nav-section-label examples-label">EXPLORE AS DEMOS <span>03</span></div><nav aria-label="Demonstrações">{demos.map((d, i) => <button key={d.id} className={`demo-nav ${demo === d.id ? 'active' : ''}`} aria-current={demo === d.id ? 'page' : undefined} onClick={() => chooseDemo(d.id)}><span className="demo-icon" aria-hidden="true">{icons[i]}</span><span>{d.title}<small>{d.description}</small></span>{demo === d.id && <span className="active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-note"><span className="local-icon" aria-hidden="true">⌁</span><strong>Comece sem uma chave</strong><p>As demos rodam no seu navegador. Nenhuma conta necessária.</p><span className="local-badge"><i /> 100% local no modo demo</span></div><div className="sidebar-footer"><span className="open-source-dot" /> Open source <span>v1.1</span><span className="footer-mode">{activeSystem.mode === 'dark' ? 'tema escuro' : 'tema claro'}</span></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div><span className="breadcrumb-icon" aria-hidden="true">▧</span> Workspace <span className="breadcrumb-slash">/</span> <strong>Playground</strong></div><div className="topbar-actions"><span className="connection-status"><i /> {mode === 'demo' ? 'Demo offline' : 'Provider externo'}</span><button className="button small secondary" onClick={() => setHelp(v => !v)}>Como funciona <span aria-hidden="true">↗</span></button></div></header>
    <main id="main"><div className="page-heading"><div><h1>Respostas que viram interfaces<span>.</span></h1><p>Peça, interaja, explore. A próxima resposta pode ser uma ferramenta — e pode trazer o design system dela.</p></div><span className="lab-label">LAB / 001</span></div>
    {help && <section className="help-panel"><div><h2>Um catálogo. Infinitas composições.</h2><button aria-label="Fechar explicação" onClick={() => setHelp(false)}>×</button></div><p>O provider escolhe componentes, envia uma spec JSON e a aplicação valida cada elemento com Zod. Uma interação devolve uma etapa ao provider, que compõe a próxima interface.</p><div className="catalog-tags">{Object.keys(catalog).map(name => <code key={name}>{name}</code>)}</div><p className="muted">A spec também pode declarar um <code>designSystem</code>: um preset nomeado ou um objeto completo de tokens. A superfície inteira se reestiliza — sem tocar em CSS. Na demo, as respostas são determinísticas e usam dados fictícios.</p></section>}
    <div className="playground-layout"><section className="conversation" aria-label="Conversa e interface"><div className="conversation-header"><span className="conversation-title"><span className="spark" aria-hidden="true">✳</span> {current.title}</span><span className="scenario-badge">{current.tag}</span></div>
      <div className="conversation-body"><div className="user-message"><span className="user-avatar">VC</span><div><div className="message-author">Você <span>agora</span></div><p>{sentPrompt}</p></div></div>
      <div className="assistant-message"><span className="assistant-avatar" aria-hidden="true">✳</span><div className="assistant-content"><div className="message-author">Intelligent UI <span className="mode-label">{mode === 'demo' ? 'DEMO' : 'MODELO'}</span><span className="answer-status" role="status">{busy ? 'Compondo resposta…' : state.status === 'error' ? 'Requer atenção' : state.spec ? 'Resposta pronta' : 'Aguardando'}</span></div>
      <div className="surface-toolbar"><div className="view-switch" role="group" aria-label="Visualização"><button aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}>◫ Interface</button><button aria-pressed={tab === 'spec'} onClick={() => setTab('spec')}>{'{ }'} Spec JSON</button></div><span className="surface-version">{state.designSystem && <span className="system-choice" title="O design system veio na resposta">◈ {state.designSystem.name}</span>}{state.spec ? `${Object.keys(state.spec.elements).length} componentes` : 'Recebendo spec'}</span></div>
      {state.errors.length > 0 && <div className="error-box" role="alert"><strong>A resposta precisa de atenção</strong>{state.errors.map((e, i) => <p key={i}>{e.elementId && `${e.elementId}: `}{e.message}</p>)}<button className="button secondary small" onClick={() => void controller.retry()}>Tentar novamente</button></div>}
      <div className="generated-surface" aria-busy={busy} style={surfaceStyle} data-design-system={surfaceSystem.name} data-depth={surfaceSystem.depth}>{tab === 'spec' ? <pre className="json-view" tabIndex={0}>{state.spec ? JSON.stringify(state.spec, null, 2) : state.raw || 'Aguardando o primeiro fragmento…'}</pre> : state.spec ? <UIRenderer spec={state.spec} onAction={action => void controller.dispatch(action)} onLive={event => controller.live(event)} disabled={busy} /> : <div className="surface-empty"><span className={busy ? 'loading-symbol' : ''}>✳</span><h2>{busy ? 'Compondo sua interface' : 'Sua próxima interface aparece aqui'}</h2><p>{busy ? `${state.chunks} fragmentos recebidos. Validando a resposta…` : 'Escolha uma demo ou tente gerar novamente.'}</p></div>}</div>
      <div className="validation-strip"><span><i className={state.errors.length ? 'warning-dot' : ''} />{state.spec ? 'Validado com Zod' : 'Validação antes de renderizar'}</span><span>JSON → React <span aria-hidden="true">↗</span></span></div></div></div></div>
      <form className="composer" onSubmit={submit}><label className="sr-only" htmlFor="prompt">Seu pedido</label><textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={4000} rows={2} placeholder="O que você quer explorar?" /><div className="composer-footer"><label className="provider-select"><span aria-hidden="true">◉</span><span className="sr-only">Provider</span><select value={mode} onChange={e => changeMode(e.target.value)}><option value="demo">Demo offline</option><option value="remote">API via proxy local</option></select></label><span className="composer-hint">{mode === 'demo' ? 'Resposta de exemplo da demo selecionada' : 'Usa a configuração do seu .env'}</span>{busy ? <button type="button" className="send-button" aria-label="Cancelar geração" onClick={() => controller.cancel()}>■</button> : <button type="submit" className="send-button" disabled={!prompt.trim()} aria-label="Gerar interface">↑</button>}</div></form>
    </section>
    <aside className="inspector" aria-label="Bastidores da geração"><div className="inspector-heading"><span aria-hidden="true">⌘</span><h2>Por trás da interface</h2><span className="live-label">LIVE</span></div><p className="inspector-intro">Do pedido à próxima interação.<br />Acompanhe o ciclo acontecer.</p><ol className="pipeline"><li className="complete"><span>01</span><div><strong>Compor</strong><p>O provider escolhe a melhor<br />forma de responder.</p></div><b>✓</b></li><li className={state.chunks ? 'complete' : ''}><span>02</span><div><strong>Validar</strong><p>Cada componente passa<br />pelo contrato Zod.</p></div><b>{state.spec ? '✓' : '·'}</b></li><li className={state.spec ? 'complete' : ''}><span>03</span><div><strong>Reagir</strong><p>A interface responde na hora<br />e a ação volta ao provider.</p></div><b>{state.livePulses ? '✓' : state.spec ? '↗' : '·'}</b></li></ol>
      <div className="inspector-divider" /><div className="activity-heading"><h3>ATIVIDADE DA SESSÃO</h3><span>{state.events.length.toString().padStart(2, '0')}</span></div><ol className="event-list">{state.events.map((event, i) => <li key={i}><span className="event-dot" /><div><strong>{event.name}</strong><p>{event.detail}</p></div></li>)}</ol><div className="stream-stats"><span>Fragmentos recebidos<strong>{state.chunks}</strong></span><span>Revisão da interface<strong>{state.revision.toString().padStart(2, '0')}</strong></span><span>Eventos em tempo real<strong>{state.livePulses}</strong></span></div>
      <div className="inspector-note"><span aria-hidden="true">◇</span><p><strong>Interface e sistema como dado.</strong><br />Componentes conhecidos, props tipadas, tokens validados e ações de volta ao provider.</p></div>
    </aside></div><footer className="page-footer"><span>Feito para experimentar. Aberto para construir.</span><span>React · TypeScript · Zod <i /> {mode === 'demo' ? 'Sem chave de API' : 'Chave somente no servidor'}</span></footer></main></div>
  </div>;
}
