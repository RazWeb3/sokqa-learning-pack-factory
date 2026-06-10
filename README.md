# SokQA Learning Pack Factory

Paste a manual or document, and automatically generate a SokQA-ready
learning pack (document / quiz / manifest) in minutes.

## Problem
At convenience stores, restaurants, hotels, and retail shops, training
materials are still created by hand. Building materials for foreign staff
in particular took 4–8 hours per pack.

## Solution
Paste in a manual, and a 4-step workflow (Analyze → Document → Quiz →
Manifest) automatically generates a learning pack that can be imported
into SokQA via a QR code. It uses no custom schema — the output conforms
directly to SokQA's existing formats.

## How It Works (conceptual 4 steps / skill definitions)
These are not separate agents running as independent processes inside the
app. They are design guides (`.trae/skills`) that define the following roles:
- Define (spec): the specification for what to build and what not to build
- Build (orchestrator): generate the learning pack reliably from the manual
- Deliver (nextjs-api): write out the generated files and serve them via URL
- Verify (validator): check that the output is importable into SokQA

## Tech Stack
- Next.js (App Router) + TypeScript
- Vercel (static hosting)
- LLM API (OpenAI-compatible)
- Built with TRAE SOLO

## Getting Started (local)
1. `npm install`
2. Set the following in `.env.local`:
   - `OPENAI_API_KEY` (required — generation uses an LLM)
   - `NEXT_PUBLIC_BASE_URL` (the URL embedded in the manifest; must point to
     a production domain reachable at import time, e.g.
     `https://pe-gules.vercel.app`)
3. Run `npm run dev` and open http://localhost:3000
4. Paste a manual and click Generate
5. Deploy the generated `public/generated-pack/<id>/` with `vercel --prod`
6. Import into SokQA via the displayed QR code

## Output
- `manifest.json`
- `doc_01.json` (document)
- `quiz_01.json` (5-question quiz)

## Status & Roadmap
Core functionality (generate → deliver → QR import) is implemented.
Current output is fixed to one document and a 5-question quiz.
Planned next steps: expanding the number of documents and quizzes, and
improving generation quality.

## Hackathon
TRAE SOLO Hackathon @ Japan / Productivity Enhancement Track
