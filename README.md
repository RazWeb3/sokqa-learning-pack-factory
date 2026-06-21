# SokQA Learning Pack Factory

Local-first CLI tool that generates SokQA-compatible `document JSON`, `quiz JSON`, `metadata.json`, validates them, and exports `learning-pack.zip` into `output/`.

Trae Skills are included as optional workflow definitions under `.trae/skills`, but the generator itself runs through local scripts and config files.

## Core Idea

This repository is not a web service.

It is a local-first CLI workflow:

```text
User
-> Config JSON
-> Local CLI
-> Document JSON / Quiz JSON / Metadata JSON
-> Validator
-> ZIP Export
-> output/
```

Optional skill-based workflow:

```text
IDE / Agent
-> .trae/skills
-> Config / Reference Files
-> Local CLI
-> Validation
-> ZIP Export
```

## Features

- Local-first
- CLI + config driven
- Optional Trae Skills workflow
- Multiple Documents
- Multiple Quiz Packs
- Multiple Reference Sources
- TXT / Markdown / PDF support
- Generation Profile System
- Validation System
- ZIP Export
- SokQA Compatible

## Example Workflow

```text
Reference Files
(TXT / MD / PDF)
      |
      v
Learning Pack Generator
      |
      v
Document JSON
Quiz JSON
Metadata JSON
      |
      v
Validation
      |
      v
ZIP Export
```

## Example Output

```text
output/
└─ customer-service-pack/
   ├─ metadata.json
   ├─ doc_01.json
   ├─ doc_02.json
   ├─ quiz_01.json
   └─ learning-pack.zip
```

## Optional Skill Workflow

The repository includes optional workflow definitions under `.trae/skills`.
They are useful for Trae/ZCode/agent-assisted development, but the core generator can be used from the CLI with config files.

- `sokqa-pack-factory-spec`
- `llm-agents-orchestrator-sokqa`
- `sokqa-json-shape-tts-validator`
- `nextjs-sokqa-pack-api` (legacy skill name, currently used for local generation and export workflow)

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
  doc_02.json
  doc_03.json
  quiz_01.json
  quiz_02.json
  learning-pack.zip
```

`tts` fields stay in JSON for SokQA compatibility.
This OSS does not generate audio files.

## Directory Layout

```text
.trae/         Optional skill definitions for agent-assisted workflows
configs/       Generation config examples
scripts/       CLI entrypoints
lib/           Core generation, validation, reference loading, ZIP export
examples/      Sample reference text
templates/     Metadata template
output/        Generated packs (gitignored)
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
npm run generate -- --config configs/multiple-docs-quizzes.json
```

Generated pack:

```text
output/<pack-id>/
  metadata.json
  doc_01.json
  doc_02.json
  doc_03.json
  quiz_01.json
  quiz_02.json
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
- reference.paths
- reference.mode

## Generation Profile (v0.6)

Since v0.6, the config can also control **the character of the generated content** (target audience, difficulty, tone, etc.).

All profile settings are optional. When omitted, defaults are applied.

| Setting | Allowed values | Default | Effect |
|---|---|---|---|
| `targetUser` | `beginner` / `student` / `employee` / `manager` / `general` | `general` | Vocabulary, explanation depth |
| `difficulty` | `easy` / `normal` / `hard` | `normal` | Basics vs applied content |
| `learningStyle` | `audio` / `reading` / `quiz` / `balanced` | `balanced` | Short sentences vs explanations |
| `outputMode` | `study` / `training` / `exam` | `study` | Study / corporate training / exam prep |
| `tone` | `friendly` / `professional` / `academic` | `friendly` | Wording and register |
| `detailLevel` | `short` / `normal` / `detailed` | `normal` | Level of detail |
| `exampleLevel` | `none` / `few` / `many` | `few` | Number of concrete examples |
| `audioOptimization` | `true` / `false` | `false` | SokQA-friendly short sentences |

Example:

```json
{
  "targetUser": "employee",
  "difficulty": "normal",
  "learningStyle": "balanced",
  "outputMode": "training",
  "tone": "professional",
  "detailLevel": "normal",
  "exampleLevel": "many",
  "audioOptimization": false
}
```

The resolved profile is recorded in `metadata.json` under the `profile` key.

## choiceTexts Rule (Quiz TTS)

The app controls choice numbering, so the generator must not include numbers in `tts.choiceTexts`.

- `tts.choiceTexts` is a 4-item array mirroring `choices` in the same order
- Each element contains only the spoken text of the choice (no number)
- `1番`, `Option 1`, `Choice 1`, `No.1` etc. are forbidden

```json
"choices": ["Reliable", "Responsible", "Reasonable", "Respectable"],
"tts": {
  "choiceTexts": ["Reliable", "Responsible", "Reasonable", "Respectable"]
}
```

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

With multiple references:

```json
{
  "reference": {
    "enabled": true,
    "paths": [
      "references/customer-service-manual.txt",
      "references/faq.md",
      "references/policy.pdf"
    ],
    "mode": "source_plus"
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

## Supported Reference Formats

- `txt`
- `md`
- `pdf`

## Multiple Reference Files

Multiple reference files are merged in the configured order and passed into generation as one reference context.

Generated `metadata.json` records the input sources:

```json
{
  "references": ["customer-service-manual.txt", "faq.md", "policy.pdf"]
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

configs/multiple-docs-quizzes.json
  Generate 3 documents and 2 quiz packs from config

configs/multiple-references.json
  Generate from txt + md + pdf reference files

configs/beginner-audio.json
  Beginner-friendly pack optimized for audio learning (short sentences)

configs/employee-training.json
  Corporate training pack with professional tone and many examples

configs/exam-preparation.json
  Hard-difficulty exam prep pack with detailed explanations

configs/academic-reading.json
  Academic textbook-style reading pack with deep explanations
```

## Generate

```bash
npm run generate -- --config configs/no-reference-topic.json
npm run generate -- --config configs/customer-service-source-only.json
npm run generate -- --config configs/customer-service-source-plus.json
npm run generate -- --config configs/customer-service-exact-text.json
npm run generate -- --config configs/multiple-docs-quizzes.json
npm run generate -- --config configs/multiple-references.json
npm run generate -- --config configs/beginner-audio.json
npm run generate -- --config configs/employee-training.json
npm run generate -- --config configs/exam-preparation.json
npm run generate -- --config configs/academic-reading.json
```

Multiple document / quiz example:

```bash
npm run generate -- --config configs/multiple-docs-quizzes.json
```

```text
output/multi-pack/
  metadata.json
  doc_01.json
  doc_02.json
  doc_03.json
  quiz_01.json
  quiz_02.json
  learning-pack.zip
```

Ad-hoc input (non-config):

```bash
npm run generate -- --input examples/customer-service.txt
npm run generate -- --input references/policy.pdf
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

Validation covers:

- `documentCount >= 1`
- `quizCount >= 0`
- `questionsPerQuiz >= 1`
- reference file existence
- supported reference format (`txt` / `md` / `pdf`)
- `reference.paths` must not be empty
- PDF read failures
- generated document / quiz counts
- per-quiz question counts
- metadata file list consistency
- metadata reference source consistency
- ZIP file list consistency
- `exact_text_document` quiz suppression

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

```text
v0.2
- ZIP export
- README refresh
- OSS cleanup

v0.3
- Config-driven generation
- Reference modes
- Exact text document mode

v0.4 (implemented)
- Multiple documents
- Multiple quiz packs
- questionsPerQuiz-driven quiz output
- metadata / ZIP consistency checks

v0.5 (implemented)
- Multiple reference sources
- PDF reference support
- Markdown reference support
- Multiple reference files

v0.6 (implemented)
- Generation Profile System
- targetUser
- difficulty
- learningStyle
- outputMode
- tone
- detailLevel
- exampleLevel
- audioOptimization

v0.7
- Config Simplification
- Preset Profiles
- Better Prompt Templates
- Improved Generation Quality

v0.8
- Advanced Reference Handling
- PDF quality improvements
- Multiple source merging improvements
- Reference weighting
```

## License

MIT License

See LICENSE for details.

## Contributing

Issues and pull requests are welcome.

If you find bugs, validation problems, or ideas for improving learning pack generation, please open an issue.

## Release History

### v0.6.0

- Generation Profile System
- targetUser / difficulty / learningStyle / outputMode / tone / detailLevel / exampleLevel
- audioOptimization for SokQA
- choiceTexts (no-number) quiz TTS rule
- metadata.profile

### v0.5.0

- Multiple reference files
- PDF support
- Markdown support
- Multiple reference sources

### v0.4.0

- Multiple documents
- Multiple quiz packs
- questionsPerQuiz-driven quiz output

### v0.3.0

- Config-driven generation
- Reference modes
- Exact text document mode

### v0.2.0

- ZIP export
- OSS cleanup
