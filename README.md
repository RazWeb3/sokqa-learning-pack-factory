# Learning Pack Generator Powered by Trae Skills

Local-first generator that uses Trae Skills to produce `document JSON`, `quiz JSON`, `metadata.json`, validate them, and export `learning-pack.zip` into `output/`.

## Core Idea

This repository is not a web service.

It is a local tool for Trae IDE:

```text
User
-> Trae IDE
-> Skills
-> Document JSON / Quiz JSON / Metadata JSON
-> Validator
-> ZIP Export
-> output/
```

## Skill Architecture

The main assets live under `.trae/skills`.

- `sokqa-pack-factory-spec`
- `llm-agents-orchestrator-sokqa`
- `sokqa-json-shape-tts-validator`
- `nextjs-sokqa-pack-api`

Runtime flow:

```text
Specification
-> Analyzer
-> Pack Builder
-> Validator
-> Exporter
```

## Output

Generated packs are written to `output/<pack-id>/`.

```text
output/customer-service-pack/
  metadata.json
  doc_01.json
  quiz_01.json
  learning-pack.zip
```

`tts` fields stay in JSON for SokQA compatibility.
This OSS does not generate audio files.

## Directory Layout

```text
.trae/
skills/
scripts/
examples/
templates/
output/
lib/
README.md
LICENSE
```

## Setup

```bash
npm install
```

## Generate

Example run:

```bash
npm run generate:example
```

Custom input file:

```bash
npm run generate -- --input examples/customer-service.txt --id customer-service-pack --title "Customer Service Training"
```

Direct text input:

```bash
npm run generate -- --text "Customer service basics..." --id customer-service-pack
```

## Validation

Run tests:

```bash
npm test
```

Run type checks:

```bash
npm run typecheck
```

## Included Assets

- `examples/customer-service.txt`
- `templates/metadata.template.json`

## Non-Goals

- QR codes
- Manifest URL
- CDN
- Vercel deploy
- Static hosting
- Base64 URL export
- PDF export
- SaaS conversion

## Roadmap

- `v0.2`: ZIP export, README refresh, OSS cleanup
- `v0.3`: multiple documents, multiple quiz packs
- `v0.4`: template system for restaurant, hotel, retail, IT training
- `v0.5`: validation improvements, pack consistency checks
- `v0.6`: CLI improvements
