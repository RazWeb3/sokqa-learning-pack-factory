# Learning Pack Generator OSS

Paste a manual or document and generate reusable learning packs as JSON files
and a downloadable ZIP package.

## What It Does

- Generates structured learning content from manuals and documents
- Returns `document JSON`, `quiz JSON`, `metadata JSON`
- Validates the generated pack before export
- Builds `learning-pack.zip` in the browser with `JSZip`

## Output

- `metadata.json`
- `doc_01.json`
- `quiz_01.json`
- `learning-pack.zip`

## Workflow

```text
Generate -> Validate -> Download ZIP
```

## Skill Driven Architecture

This project uses TRAE Skills to define and control the generation workflow.
The skills are first-class repository assets under `.trae/skills`.

- `sokqa-pack-factory-spec`
- `llm-agents-orchestrator-sokqa`
- `sokqa-json-shape-tts-validator`
- `nextjs-sokqa-pack-api`

Internal workflow:

```text
Analyzer -> Pack Builder -> Validator -> Exporter
```

## Tech Stack

- Next.js (App Router) + TypeScript
- JSZip
- Vitest

## Getting Started

1. `npm install`
2. `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000)
4. Paste a manual and click `Generate`
5. Review the validation result
6. Click `Download Learning Pack`

## Local Validation

- `npm test`
- `npm run build`

## Current Scope

- Single document pack
- Single 5-question quiz pack
- Client-side ZIP generation
- `metadata.json` as the pack index

## Roadmap

- `v0.2`: ZIP export, `metadata.json`, manifest dependency removal
- `v0.3`: multiple documents, multiple quiz packs
- `v0.4`: Base64 compressed import URL export
- `v0.5`: PDF export with import URL
- `v0.6`: optional SokQA manifest export, optional CDN export
