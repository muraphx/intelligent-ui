import { z } from 'zod';

/**
 * Design system como dado, no mesmo espírito da spec de interface: um contrato fechado, validado
 * com Zod, aplicado como custom properties. Nada aqui conhece o CSS da aplicação — o mapa de
 * variáveis é a única ponte, então um sistema novo nunca precisa editar componente.
 */

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use uma cor hex, como #087f70.');

export const designSystemIds = ['papel', 'terminal', 'brutal', 'clinico', 'noturno'] as const;
export type DesignSystemId = (typeof designSystemIds)[number];

export const DesignSystemSchema = z.strictObject({
  name: z.string().min(1).max(40),
  mode: z.enum(['light', 'dark']),
  font: z.enum(['sans', 'serif', 'mono']),
  /** Raio base em px. 0 é um sistema duro; acima de 24 descaracteriza o componente. */
  radius: z.number().int().min(0).max(28),
  /** soft = sombra difusa, flat = só borda, hard = bloco deslocado (mundo neobrutalista). */
  depth: z.enum(['soft', 'flat', 'hard']),
  colors: z.strictObject({
    bg: hex, surface: hex, subtle: hex, sidebar: hex,
    text: hex, muted: hex, line: hex,
    accent: hex, accentHover: hex, accentSoft: hex, accentInk: hex,
    chart: hex, danger: hex, dangerBg: hex,
  }),
});
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

const fontStacks: Record<DesignSystem['font'], string> = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Cascadia Code", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

export const presets: Record<DesignSystemId, DesignSystem> = {
  papel: {
    name: 'Papel', mode: 'light', font: 'serif', radius: 14, depth: 'soft',
    colors: {
      bg: '#faf7f1', surface: '#fffdf8', subtle: '#f4efe5', sidebar: '#f1ebdd',
      text: '#1e1c18', muted: '#6b6560', line: '#e4dccc',
      accent: '#b4522c', accentHover: '#8f3f1f', accentSoft: '#f6e5dc', accentInk: '#7c3418',
      chart: '#d9875f', danger: '#9b3434', dangerBg: '#fbeceb',
    },
  },
  terminal: {
    name: 'Terminal', mode: 'dark', font: 'mono', radius: 6, depth: 'flat',
    colors: {
      bg: '#0b0f0c', surface: '#101713', subtle: '#0e1512', sidebar: '#0c120f',
      text: '#d8efe1', muted: '#8aa697', line: '#22302a',
      accent: '#58e08c', accentHover: '#7df0a8', accentSoft: '#12281c', accentInk: '#9df3c1',
      chart: '#2f9c62', danger: '#ff9a86', dangerBg: '#2a1512',
    },
  },
  brutal: {
    name: 'Brutal', mode: 'light', font: 'sans', radius: 0, depth: 'hard',
    colors: {
      bg: '#f2f0ec', surface: '#ffffff', subtle: '#eae7e1', sidebar: '#e6e2da',
      text: '#0f0f0f', muted: '#55524c', line: '#0f0f0f',
      accent: '#ffd400', accentHover: '#ffe14d', accentSoft: '#fff3b8', accentInk: '#6b5600',
      chart: '#4a6cff', danger: '#e5352b', dangerBg: '#ffe0dd',
    },
  },
  clinico: {
    name: 'Clínico', mode: 'light', font: 'sans', radius: 10, depth: 'soft',
    colors: {
      bg: '#f6f8fb', surface: '#ffffff', subtle: '#f0f4f9', sidebar: '#f2f6fa',
      text: '#1c2635', muted: '#5c6b80', line: '#dde5ee',
      accent: '#1d6cf0', accentHover: '#1554c4', accentSoft: '#e3ecfe', accentInk: '#14459b',
      chart: '#6fa1f5', danger: '#c0392b', dangerBg: '#fdecea',
    },
  },
  noturno: {
    name: 'Noturno', mode: 'dark', font: 'sans', radius: 16, depth: 'soft',
    colors: {
      bg: '#131322', surface: '#1b1b2e', subtle: '#20203a', sidebar: '#17172a',
      text: '#e9e9f5', muted: '#a3a3c2', line: '#2e2e4d',
      accent: '#a78bfa', accentHover: '#c4b5fd', accentSoft: '#262142', accentInk: '#cbb9ff',
      chart: '#7c6ce0', danger: '#ff9b9b', dangerBg: '#33202b',
    },
  },
};

export function isDesignSystemId(value: unknown): value is DesignSystemId {
  return typeof value === 'string' && (designSystemIds as readonly string[]).includes(value);
}

/** Aceita só o id de um preset. Um sistema externo nunca entra por aqui — só por JSON validado. */
export function preset(id: DesignSystemId): DesignSystem {
  return structuredClone(presets[id]);
}

export function resolveDesignSystem(value: unknown): { system: DesignSystem | null; error?: string } {
  if (value === undefined || value === null) return { system: null };
  if (isDesignSystemId(value)) return { system: preset(value) };
  if (typeof value === 'string') return { system: null, error: `Preset desconhecido: "${value}". Use um destes — ${designSystemIds.join(', ')} — ou um objeto completo de tokens.` };
  const parsed = DesignSystemSchema.safeParse(value);
  if (parsed.success) return { system: parsed.data };
  return { system: null, error: parsed.error.issues.map(i => `${i.path.join('.') || 'sistema'}: ${i.message}`).join('; ') };
}

function withAlpha(hexColor: string, alpha: number): string {
  const raw = hexColor.slice(1);
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hexColor: string): number {
  const raw = hexColor.slice(1);
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Texto sobre uma cor cheia (botão primário, selo, alerta). O `accentInk` de cada preset é a cor de
 * destaque *sobre o fundo*; em botão cheio ela daria contraste baixo — por isso o texto sobre o
 * accent é calculado, não escolhido a dedo. Escolhe entre preto e branco o de maior contraste.
 */
export function readableOn(hexColor: string): string {
  const luminance = relativeLuminance(hexColor);
  const againstBlack = (luminance + 0.05) / 0.05;
  const againstWhite = 1.05 / (luminance + 0.05);
  return againstBlack >= againstWhite ? '#101014' : '#ffffff';
}

/** Razão de contraste WCAG entre duas cores hex (1 a 21) — a prova numérica do craft floor. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function shadow(ds: DesignSystem): string {
  if (ds.depth === 'flat') return 'none';
  // O bloco deslocado é caro e barulhento: só o mundo que o declara (Brutal) o recebe.
  if (ds.depth === 'hard') return `4px 4px 0 ${ds.colors.text}`;
  return `0 12px 32px -16px ${withAlpha(ds.colors.text, 0.28)}`;
}

/** Única ponte entre o sistema e o CSS: nenhum componente importa isto. */
export function designSystemVars(ds: DesignSystem): Record<string, string> {
  const c = ds.colors;
  return {
    '--bg': c.bg, '--surface': c.surface, '--subtle': c.subtle, '--sidebar': c.sidebar,
    '--text': c.text, '--muted': c.muted, '--quiet': c.muted, '--line': c.line,
    '--accent': c.accent, '--accent-hover': c.accentHover, '--accent-soft': c.accentSoft, '--accent-ink': c.accentInk,
    '--chart': c.chart, '--danger': c.danger, '--danger-bg': c.dangerBg,
    /* Tokens que o shadcn espera: o `@theme inline` do Tailwind aponta para estes nomes, então a
       base de componentes herda a identidade do sistema sem paleta duplicada. */
    '--hover': c.subtle,
    '--accent-on': readableOn(c.accent),
    '--ring': c.accent,
    '--input': c.line,
    '--chart-2': c.accent,
    '--chart-3': withAlpha(c.chart, 0.45),
    '--font-sans-stack': fontStacks.sans,
    '--font-mono-stack': fontStacks.mono,
    /* Os utilitários do Tailwind leem `--color-*`. Emitir o valor LITERAL aqui (e não uma cadeia de
       var()) é o que faz cada escopo resolver os seus tokens: a superfície gerada veste o sistema
       que a resposta declarou, sem vazar para a casca da aplicação. */
    '--color-background': c.bg,
    '--color-foreground': c.text,
    '--color-card': c.surface,
    '--color-card-foreground': c.text,
    '--color-popover': c.surface,
    '--color-popover-foreground': c.text,
    '--color-primary': c.accent,
    '--color-primary-foreground': readableOn(c.accent),
    '--color-secondary': c.subtle,
    '--color-secondary-foreground': c.text,
    '--color-muted': c.subtle,
    '--color-muted-foreground': c.muted,
    '--color-accent': c.subtle,
    '--color-accent-foreground': c.text,
    '--color-destructive': c.danger,
    '--color-destructive-foreground': readableOn(c.danger),
    '--color-border': c.line,
    '--color-input': c.line,
    '--color-ring': c.accent,
    '--color-chart-1': c.chart,
    '--color-chart-2': c.accent,
    '--color-chart-3': withAlpha(c.chart, 0.45),
    '--radius-sm': `${Math.max(ds.radius - 4, 0)}px`,
    '--radius-md': `${Math.max(ds.radius - 2, 0)}px`,
    '--radius-lg': `${ds.radius}px`,
    '--radius-xl': `${ds.radius + 4}px`,
    '--font-sans': fontStacks.sans,
    '--font-mono': fontStacks.mono,
    '--radius': `${ds.radius}px`,
    '--shadow': shadow(ds),
    '--surface-shadow': ds.depth === 'soft' ? 'none' : shadow(ds),
    '--border-width': ds.depth === 'hard' ? '2px' : '1px',
    '--font-family': fontStacks[ds.font],
    '--font-display': fontStacks[ds.font],
    '--selection': withAlpha(c.accent, 0.24),
  };
}

export function applyDesignSystem(ds: DesignSystem, el: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(designSystemVars(ds))) el.style.setProperty(key, value);
  el.dataset.theme = ds.mode;
  el.dataset.depth = ds.depth;
  el.dataset.font = ds.font;
  el.dataset.designSystem = ds.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  el.style.colorScheme = ds.mode;
}

export function clearDesignSystem(el: HTMLElement = document.documentElement): void {
  for (const key of Object.keys(designSystemVars(presets.clinico))) el.style.removeProperty(key);
  delete el.dataset.depth;
  delete el.dataset.font;
  delete el.dataset.designSystem;
}

export function designSystemToJson(ds: DesignSystem): string {
  return JSON.stringify(ds, null, 2);
}

export function parseDesignSystemJson(text: string): { system: DesignSystem | null; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { system: null, error: `JSON inválido: ${error instanceof Error ? error.message : 'falha ao ler'}` };
  }
  return resolveDesignSystem(raw);
}
