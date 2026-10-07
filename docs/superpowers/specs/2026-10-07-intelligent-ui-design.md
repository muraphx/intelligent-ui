# Intelligent UI Design

## Objective

Build a local, open-source generative UI lab where a model emits a flat JSON UI spec, every element is validated against a typed catalog, and user actions produce replacement specs in the same surface. The app must remain fully demonstrable without API credentials.

## Architecture

The React client owns four small modules: a strict Zod catalog, a tolerant incremental JSON extractor, a renderer that can only resolve catalog entries, and an action controller that feeds component events to a provider. Providers share one interface. The offline provider is deterministic; the remote provider calls a minimal Node proxy that exposes an SSE response while keeping API keys off the client.

The wire format is flat: `{ root, elements }`. Element references are IDs, not nested JSX. Validation keeps valid elements, drops invalid ones with structured errors, checks child references, and refuses an invalid root. Rendering never evaluates model code or injects HTML.

## User experience

The page resembles a focused developer workbench rather than a component gallery. A compact rail selects one of three deterministic demos. The main column shows the prompt, a live generative surface, a safety/status strip, and an event trail. The responsive layout collapses to one column on small screens.

The three demos are: a market pulse with metrics and a chart; a calculator whose submit action replaces the surface with a result; and a profile form whose submit action produces a new profile card. The catalog also includes Button and MiniGame so remote models can select them safely.

## Data flow

1. A demo or prompt produces text chunks containing a JSON spec.
2. `StreamingSpecParser` buffers chunks, ignores prose/fences, extracts balanced JSON, and validates the candidate.
3. The renderer receives only a validated spec and separately displays validation errors.
4. Components dispatch typed `UIAction` values.
5. `GenerativeUIController` sends the action and current spec to the selected provider.
6. The provider returns a new streamed spec and the same surface is replaced after validation.

## Safety and errors

All props schemas are strict. Unknown components and unknown props are dropped. Broken references are removed and reported. An invalid root produces no renderable spec. Errors are visible in the UI without crashing the page. Markdown is rendered as plain React text blocks, not raw HTML.

## Testing and proof

Vitest covers fragmented JSON with prose/fences, catalog rejection of unknown types and props, and an end-to-end controller action resulting in a replacement spec. A production build verifies TypeScript/Vite integration. Playwright drives the running offline app, exercises an interaction, and saves a real PNG in `docs/`.

## Visual system

The interface uses semantic CSS custom properties for all visual values, a light/dark theme, strong typographic hierarchy, restrained borders, and one teal accent. Motion is limited to opacity and transform and is disabled for reduced-motion users. Interactive controls expose hover, active, focus-visible, and disabled states.
