# Atoms Studio Demo

An Atoms-like AI app builder for the ROOT full-stack interview task.

The demo turns one natural-language prompt into:

- a visible multi-agent timeline
- a saved version history
- a schema-driven landing page preview
- a follow-up refinement loop

## What is implemented

- Atoms-style three-panel workspace
- local-first persistence with `localStorage`
- project list and version switching
- `/api/generate` generation endpoint
- Kimi-first generation when `KIMI_API_KEY` is configured
- OpenAI fallback generation when `OPENAI_API_KEY` is configured
- deterministic mock generation fallback when no API key is present
- structured preview rendering from a generated page spec

## Tech stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Kimi/OpenAI compatible chat generation
- Zod

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
KIMI_API_KEY=your_kimi_key
KIMI_MODEL=kimi-k2.5
KIMI_BASE_URL=https://api.moonshot.cn/v1
```

Optional OpenAI fallback:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.4-mini
```

Priority order is `KIMI_API_KEY` -> `OPENAI_API_KEY` -> mock generator.

If no key is provided, the app still works using the built-in mock generator.

## Product framing

This demo intentionally narrows the problem from "generate any app" to "generate a polished single-page app preview". That keeps the delivery credible inside a 6-8 hour interview window while still preserving the Atoms feel:

- prompt in
- agents reason visibly
- app artifact comes out
- user iterates on versions

## Key tradeoffs

- Persistence is browser-local instead of server DB-backed. This keeps setup friction near zero and guarantees the demo works immediately.
- The preview is spec-driven rather than full arbitrary code generation. This makes the output more reliable and easier to refine live.
- The API route supports Kimi first, OpenAI second, and still has a mock-safe fallback so the demo never hard-fails during review.

## Suggested deployment

- Vercel for the web app
- set `KIMI_API_KEY` in project env vars

## Interview notes

Additional implementation notes and next-step ideas are in [docs/Delivery.md](./docs/Delivery.md).

## Official references used

- Atoms overview: https://help.atoms.dev/en/articles/12087744-overview
- Atoms App Viewer: https://help.atoms.dev/en/articles/12129698-app-viewer
- Atoms Cloud: https://help.atoms.dev/en/articles/13036940-atoms-cloud
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- Moonshot platform: https://platform.moonshot.ai/
