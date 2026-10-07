# Intelligent UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prove a local generative UI workbench with a strict catalog, streamed JSON parsing, interactive action loop, offline demos, and optional remote providers.

**Architecture:** A Vite React client validates flat UI specs and renders catalog components only. A deterministic browser provider powers offline demos, while a minimal Express proxy adapts OpenAI-compatible and Anthropic responses to SSE without exposing user keys.

**Tech Stack:** React, TypeScript, Vite, Zod, Vitest, Express, native fetch, Playwright CLI.

---

### Task 1: Scaffold and contracts

**Files:** `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`, `src/ui/types.ts`, `src/ui/catalog.ts`, `src/ui/validation.test.ts`

- [ ] Write a failing Vitest case that passes an invented type and an extra prop to `validateUISpec` and expects both to be discarded with visible error records.
- [ ] Run the targeted test and confirm failure because the validator module does not exist.
- [ ] Define the flat spec types and strict Zod prop schemas for Stack, Markdown, MetricCard, Chart, Form, Button, Calculator, and MiniGame.
- [ ] Implement tolerant validation that returns `{ spec, errors }`, retaining valid elements while filtering invalid child references.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Streaming parser

**Files:** `src/ui/streaming-parser.ts`, `src/ui/streaming-parser.test.ts`

- [ ] Write failing tests that split JSON inside a string/escape and wrap it in prose plus a fenced block.
- [ ] Run the targeted tests and confirm failure because `StreamingSpecParser` does not exist.
- [ ] Implement a stateful balanced-object extractor that ignores preamble and code fences and validates only complete candidates.
- [ ] Run the targeted tests and confirm they pass.

### Task 3: Action loop and providers

**Files:** `src/generation/provider.ts`, `src/generation/demo-specs.ts`, `src/generation/demo-provider.ts`, `src/generation/controller.ts`, `src/generation/controller.test.ts`, `server/index.ts`

- [ ] Write a failing test that dispatches a calculator action and expects the controller to replace the current spec with a result spec.
- [ ] Run the targeted test and confirm failure because the controller does not exist.
- [ ] Implement typed actions, deterministic demo streams, the controller, and three canned demo entry specs.
- [ ] Implement the SSE proxy with OpenAI-compatible and Anthropic request adapters selected through environment variables.
- [ ] Run the controller test and confirm it passes.

### Task 4: Renderer and workbench

**Files:** `DESIGN.md`, `src/styles/tokens.css`, `src/styles/app.css`, `src/ui/components.tsx`, `src/ui/renderer.tsx`, `src/App.tsx`, `src/main.tsx`

- [ ] Add semantic design tokens, theme overrides, responsive rules, interaction states, reduced motion, and the documented design read.
- [ ] Build accessible catalog components that dispatch typed actions and never render model HTML.
- [ ] Build the workbench shell, demo picker, streaming/status states, visible validation errors, theme control, prompt form, and event trail.
- [ ] Exercise the three demo flows manually in the browser and fix runtime issues.

### Task 5: Documentation and license

**Files:** `README.md`, `LICENSE`

- [ ] Document the problem, three-command setup, demo mode, wire spec, catalog, action channel, providers, security model, tests, and architecture.
- [ ] Compare this implementation with Open-JSON-UI and A2UI using citations to their primary documentation and clearly label the mapping as conceptual.
- [ ] Add the real screenshot reference and the MIT license.

### Task 6: Verification artifacts

**Files:** `docs/screenshot-intelligent-ui.png`

- [ ] Run `npm install`, then `npm ci`, `npm test`, and `npm run build`, retaining the real output.
- [ ] Start the local app, use Playwright CLI to snapshot and interact with the calculator and profile form, and inspect both desktop and mobile layouts.
- [ ] Save a real desktop PNG from the running app at `docs/screenshot-intelligent-ui.png`.
- [ ] Inspect the final git diff/status and report all files, exact command output, limitations, and the intentionally absent repository URL/SHA.
