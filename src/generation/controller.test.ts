import { describe, expect, it } from 'vitest';
import { GenerativeUIController } from './controller';
import { DemoProvider } from './demo-provider';
import type { GenerationRequest, UIProvider } from './provider';

describe('action → provider step → replacement spec', () => {
  it('sends calculated values and current spec to provider, then replaces the surface', async () => {
    const requests: GenerationRequest[] = [];
    const demo = new DemoProvider(0);
    const provider: UIProvider = { stream(request, signal) { requests.push(request); return demo.stream(request, signal); } };
    const controller = new GenerativeUIController(provider);
    await controller.generate('calculator');
    const previous = controller.state.spec;
    await controller.dispatch({ elementId: 'calculator', name: 'calculate', payload: { a: 12, b: 8, operation: 'multiply' } });
    expect(requests.at(-1)?.spec).toEqual(previous);
    expect(requests.at(-1)?.action?.payload.result).toBe(96);
    expect(controller.state.spec?.elements.result.props).toMatchObject({ value: '96' });
    expect(controller.state.spec).not.toBe(previous);
    expect(controller.state.status).toBe('ready');
  });
  it('submits a profile form and receives a new card', async () => {
    const controller = new GenerativeUIController(new DemoProvider(0));
    await controller.generate('profile');
    await controller.dispatch({ elementId: 'profile-form', name: 'create_profile', payload: { name: 'Ana', role: 'Designer', bio: 'Interfaces acessíveis.' } });
    expect(controller.state.spec?.elements.profile.props).toMatchObject({ name: 'Ana', role: 'Designer' });
  });
  it('keeps last good surface and reports invalid arithmetic or forged events', async () => {
    const controller = new GenerativeUIController(new DemoProvider(0));
    await controller.generate('calculator');
    const previous = controller.state.spec;
    await controller.dispatch({ elementId: 'calculator', name: 'calculate', payload: { a: 1, b: 0, operation: 'divide' } });
    expect(controller.state.spec).toBe(previous);
    expect(controller.state.errors[0].message).toMatch(/zero/i);
    await controller.dispatch({ elementId: 'invented', name: 'anything', payload: {} });
    expect(controller.state.spec).toBe(previous);
    expect(controller.state.status).toBe('error');
  });
  it('handles button and mini-game round trips', async () => {
    const controller = new GenerativeUIController(new DemoProvider(0));
    await controller.generate('analytics');
    await controller.dispatch({ elementId: 'quiz-button', name: 'show_quiz', payload: {} });
    expect(controller.state.spec?.elements.quiz.type).toBe('MiniGame');
    await controller.dispatch({ elementId: 'quiz', name: 'answer_quiz', payload: { choice: 'Jun' } });
    expect(controller.state.spec?.elements.feedback.props).toMatchObject({ content: 'Acertou! Junho teve a maior receita: R$ 48.200.' });
  });
  it('reports provider failures without erasing the last validated spec', async () => {
    const demo = new DemoProvider(0);
    const provider: UIProvider = { async *stream(request) { if (request.action) throw new Error('Sem conexão'); yield* demo.stream(request); } };
    const controller = new GenerativeUIController(provider);
    await controller.generate('analytics');
    const previous = controller.state.spec;
    await controller.dispatch({ elementId: 'quiz-button', name: 'show_quiz', payload: {} });
    expect(controller.state.spec).toBe(previous);
    expect(controller.state.errors[0].message).toBe('Sem conexão');
  });
  it('cancels a pending stream and ignores stale chunks', async () => {
    const controller = new GenerativeUIController(new DemoProvider(5));
    const pending = controller.generate('analytics');
    controller.cancel();
    await pending;
    expect(controller.state.status).toBe('idle');
    expect(controller.state.spec).toBeNull();
  });
});
