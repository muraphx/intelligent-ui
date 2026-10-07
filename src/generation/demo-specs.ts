import type { UIElement, UISpec } from '../ui/catalog';
import type { DemoId, GenerationRequest } from './provider';

export const demos: { id: DemoId; title: string; description: string; prompt: string; tag: string }[] = [
  { id: 'analytics', title: 'Análise de receita', description: 'Dados que contam uma história', prompt: 'Como foi a receita no primeiro semestre? Mostre os principais números e a evolução mês a mês.', tag: 'Gráfico + métricas' },
  { id: 'calculator', title: 'Calculadora', description: 'Uma resposta que faz as contas', prompt: 'Crie uma calculadora interativa. Quero mudar os valores e receber o resultado aqui mesmo.', tag: 'Cálculo + ação' },
  { id: 'profile', title: 'Cartão de perfil', description: 'Do formulário à próxima interface', prompt: 'Me ajude a criar um cartão de apresentação a partir do meu nome, função e uma breve descrição.', tag: 'Formulário + cartão' },
];
const markdown = (content: string): UIElement => ({ type: 'Markdown', props: { content }, children: [] });
const stack = (children: string[], direction: 'vertical' | 'horizontal' = 'vertical'): UIElement => ({ type: 'Stack', props: { direction }, children });
const button = (label: string, action: string): UIElement => ({ type: 'Button', props: { label, action, variant: 'secondary' }, children: [] });
const metric = (label: string, value: string, detail: string, trend?: string): UIElement => ({ type: 'MetricCard', props: { label, value, detail, ...(trend ? { trend, tone: 'positive' as const } : {}) }, children: [] });
const calculator = { type: 'Calculator', props: { title: 'Vamos fazer as contas', description: 'Escolha a operação e envie. A resposta volta como uma nova interface.', initialA: 120, initialB: 8, operation: 'multiply', action: 'calculate' }, children: [] } satisfies UIElement;
const profileForm: UIElement = { type: 'Form', props: { title: 'Um pouco sobre você', description: 'Preencha os campos para compor seu cartão de apresentação.', fields: [{ name: 'name', label: 'Nome', placeholder: 'Ex.: Ana Oliveira', required: true }, { name: 'role', label: 'O que você faz?', placeholder: 'Ex.: Product designer', required: true }, { name: 'bio', label: 'Uma breve descrição', placeholder: 'O que você gosta de criar?' }], submitLabel: 'Criar meu cartão', action: 'create_profile' }, children: [] };

export function createDemoSpec(request: GenerationRequest): UISpec {
  const a = request.action;
  if (request.demo === 'calculator') {
    const elements: UISpec['elements'] = { root: stack(['intro', 'calculator']), intro: markdown('## De pergunta a ferramenta\nUma calculadora criada para esta conversa. Experimente: cada cálculo gera uma nova resposta.'), calculator };
    if (a?.name === 'calculate') {
      elements.root.children = ['intro', 'result', 'calculator'];
      elements.result = metric('RESULTADO DO CÁLCULO', Number(a.payload.result).toLocaleString('pt-BR', { maximumFractionDigits: 10 }), `${a.payload.a} ${ { add: '+', subtract: '−', multiply: '×', divide: '÷' }[a.payload.operation as 'add']} ${a.payload.b}`);
      elements.calculator = { type: 'Calculator', props: { ...calculator.props, initialA: Number(a.payload.a), initialB: Number(a.payload.b), operation: a.payload.operation as 'add' }, children: [] };
    }
    return { root: 'root', elements };
  }
  if (request.demo === 'profile') {
    if (a?.name === 'create_profile') return { root: 'root', elements: {
      root: stack(['intro', 'profile', 'edit']), intro: markdown('## Prazer em conhecer você.\nSeu formulário virou um cartão. Uma ação, uma nova interface.'),
      profile: { type: 'ProfileCard', props: { name: String(a.payload.name), role: String(a.payload.role), bio: String(a.payload.bio ?? ''), tag: 'Criado nesta conversa' }, children: [] }, edit: button('Criar outro cartão', 'reset_profile'),
    } };
    return { root: 'root', elements: { root: stack(['intro', 'profile-form']), intro: markdown('## Sua próxima apresentação começa aqui\nConte um pouco sobre você e veja a interface se transformar.'), 'profile-form': profileForm } };
  }
  const elements: UISpec['elements'] = {
    root: stack(['intro', 'metrics', 'revenue-chart', 'insight', 'quiz-button']),
    intro: markdown('## Um semestre em crescimento.\nA receita cresceu de forma consistente. Junho fechou com o melhor resultado do período.'),
    metrics: stack(['revenue', 'average', 'growth'], 'horizontal'),
    revenue: metric('RECEITA TOTAL', 'R$ 236.500', 'Janeiro a junho · dados de exemplo', '+18,6%'),
    average: metric('MÉDIA MENSAL', 'R$ 39.417', 'Ao longo dos 6 meses'),
    growth: metric('CRESCIMENTO NO PERÍODO', '+50,6%', 'Junho em relação a janeiro', 'Tendência positiva'),
    'revenue-chart': { type: 'Chart', props: { title: 'Receita ao longo do tempo', subtitle: 'Primeiro semestre · valores em R$', unit: 'R$', points: [{ label: 'Jan', value: 32000 }, { label: 'Fev', value: 35500 }, { label: 'Mar', value: 38200 }, { label: 'Abr', value: 39800 }, { label: 'Mai', value: 42800 }, { label: 'Jun', value: 48200 }] }, children: [] },
    insight: markdown('**O que os números dizem**\nO segundo trimestre concentrou 55,3% da receita do semestre. Junho ficou 22,3% acima da média mensal.'),
    'quiz-button': button('Testar meu entendimento ↗', 'show_quiz'),
  };
  if (a?.name === 'show_quiz' || a?.name === 'answer_quiz') {
    elements.root.children = ['intro', 'metrics', 'revenue-chart', 'quiz', ...(a.name === 'answer_quiz' ? ['feedback'] : [])];
    elements.quiz = { type: 'MiniGame', props: { title: 'Uma pergunta rápida', question: 'Qual mês teve a maior receita?', options: ['Abr', 'Mai', 'Jun'], action: 'answer_quiz' }, children: [] };
    if (a.name === 'answer_quiz') elements.feedback = markdown(a.payload.choice === 'Jun' ? 'Acertou! Junho teve a maior receita: R$ 48.200.' : 'Quase! Veja a última coluna: junho teve a maior receita, com R$ 48.200. Tente novamente.');
  }
  return { root: 'root', elements };
}
