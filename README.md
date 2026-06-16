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

## Basic Usage

```bash
npm install
npm run generate -- --config configs/no-reference-topic.json
```

Generated pack:

```text
output/<pack-id>/
  metadata.json
  doc_01.json
  quiz_01.json
  learning-pack.zip
```

## Config-based Generation

Config-driven generation (recommended):

```bash
npm run generate -- --config configs/no-reference-topic.json
```

By editing the config JSON, you can change:
- id
- title
- description
- theme
- language
- documentCount
- quizCount
- questionsPerQuiz
- outputDir
- reference.enabled
- reference.path
- reference.mode

## Reference Modes

### none

No reference material. Generate from `theme / title / description`.

### source_only

Generate based only on the reference material.

Safety note:

```text
source_only is a “no extra knowledge” policy, but if LLM-based generation is used it is not a perfect verbatim guarantee.
If you need “exact text only” JSON conversion, use exact_text_document.
```

### source_plus

Generate centered on the reference material, plus supplemental explanations/examples for learners.

### exact_text_document

Convert the reference text into document JSON using only the original text.

- Quiz is not generated
- quizCount is treated as 0
- No extra sentences: no summary, no paraphrase, no additions

## Reference File Usage

With reference:

```json
{
  "reference": {
    "enabled": true,
    "path": "references/customer-service-manual.txt",
    "mode": "source_only"
  }
}
```

Without reference:

```json
{
  "reference": {
    "enabled": false,
    "path": "",
    "mode": "none"
  }
}
```

## Example Configs

```text
configs/no-reference-topic.json
  Generate from theme without reference

configs/customer-service-source-only.json
  Generate strictly from reference

configs/customer-service-source-plus.json
  Generate from reference with supplements

configs/customer-service-exact-text.json
  Convert reference text into document only (no quiz)
```

## Generate

```bash
npm run generate -- --config configs/no-reference-topic.json
npm run generate -- --config configs/customer-service-source-only.json
npm run generate -- --config configs/customer-service-source-plus.json
npm run generate -- --config configs/customer-service-exact-text.json
```

Ad-hoc input (non-config):

```bash
npm run generate -- --input examples/customer-service.txt
npm run generate -- --text "Customer service basics..."
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
