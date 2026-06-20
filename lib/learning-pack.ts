import { randomUUID } from "node:crypto"
import path from "node:path"

import {
  getPrimaryReferencePath,
  normalizeReferencePaths,
  resolveProfile,
  type GenerationProfile,
  type LearningPackConfig,
  type ReferenceMode,
} from "./learning-pack-config"

export type DocumentFile = {
  id: string
  type: "document"
  schemaVersion: 1
  title: string
  description: string
  language: string
  globalTags: string[]
  documents: Array<{ id: string; text: string; tts: { text: string } }>
}

export type QuizFile = {
  id: string
  type: "quiz"
  schemaVersion: 1
  title: string
  description: string
  language: string
  globalTags: string[]
  questions: Array<{
    id: string
    question: string
    choices: [string, string, string, string]
    answerIndex: 0 | 1 | 2 | 3
    explanation: string
    tts: {
      questionText: string
      choiceTexts: [string, string, string, string]
      answerText: string
      explanationText: string
    }
  }>
}

export type MetadataFile = {
  id: string
  title: string
  description: string
  createdAt: string
  generator: "sokqa-learning-pack-factory"
  version: "0.6.0"
  language: string
  source: {
    hasReference: boolean
    mode: ReferenceMode
    path: string
  }
  profile: Required<GenerationProfile>
  references: string[]
  documents: string[]
  quizzes: string[]
}

export type ValidationCheck = {
  name: string
  passed: boolean
  message: string
}

export type ValidationResult = {
  passed: boolean
  checks: ValidationCheck[]
  errors: string[]
}

export type LearningPack = {
  documents: DocumentFile[]
  quizzes: QuizFile[]
  metadata: MetadataFile
  validation: ValidationResult
}

type PackPayload = Omit<LearningPack, "validation">

type ValidationExpectations = {
  documentCount: number
  quizCount: number
  questionsPerQuiz: number
  mode: ReferenceMode
}

// choiceTexts must never include numbers like "1番", "Option 1", "Choice 1", "No.1".
const NUMBER_READING_PATTERN = /(^|\s)(\d+\s*番|option\s*\d+|choice\s*\d+|no\.?\s*\d+)(\s|$)/i

function ensureEndsWithComma(text: string) {
  const trimmed = text.trim()
  return trimmed.endsWith(",") ? trimmed : `${trimmed},`
}

function isJapaneseLanguage(language: string) {
  return language.toLowerCase().startsWith("ja")
}

function ttsPrefix(language: string) {
  return isJapaneseLanguage(language) ? "[ja-JP]" : "[en-US]"
}

function toTts(language: string, text: string) {
  const trimmed = text.trim().replace(/[、,]+$/g, "")
  const suffix = isJapaneseLanguage(language) ? "、" : ","
  return `${ttsPrefix(language)}${trimmed}${suffix}`
}

function buildPackId() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `pack_${stamp}_${randomUUID().slice(0, 8)}`
}

function normalizePackId(packId: string) {
  const normalized = packId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!normalized) {
    throw new Error("id must contain at least one alphanumeric character")
  }

  return normalized
}

function isPlainText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function clampMin(value: number, min: number) {
  return value < min ? min : value
}

function buildDocumentFileName(index: number) {
  return `doc_${String(index + 1).padStart(2, "0")}.json`
}

function buildQuizFileName(index: number) {
  return `quiz_${String(index + 1).padStart(2, "0")}.json`
}

function splitNonEmptyLines(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
}

function splitParagraphs(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (!normalized) {
    return []
  }
  return normalized
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function chunkEvenly<T>(items: T[], chunkCount: number) {
  const safeChunkCount = clampMin(chunkCount, 1)
  const chunks: T[][] = Array.from({ length: safeChunkCount }, () => [])
  for (let index = 0; index < items.length; index += 1) {
    chunks[index % safeChunkCount].push(items[index])
  }
  return chunks
}

type ProfileAdapter = {
  isAudioOptimized: boolean
  detailLabel: string
  audienceLabel: string
  toneLabel: string
  exampleCount: number
  intro: string
  summary: (theme: string) => string
  practice: string
  explanationPrefix: string
  quizQuestionTemplate: (theme: string, index: number, total: number) => string
  choiceA: (theme: string) => string
  choiceB: string
  choiceC: string
  choiceD: string
  explanationTemplate: (theme: string) => string
}

function buildProfileAdapter(profile: Required<GenerationProfile>): ProfileAdapter {
  const isAudioOptimized = profile.audioOptimization || profile.learningStyle === "audio"

  const detailLabels: Record<string, string> = {
    short: "Key Point",
    normal: "Detail",
    detailed: "Deep Dive",
  }
  const audienceLabels: Record<string, string> = {
    beginner: "Beginner",
    student: "Student",
    employee: "Employee",
    manager: "Manager",
    general: "Learner",
  }
  const toneLabels: Record<string, string> = {
    friendly: "Friendly",
    professional: "Professional",
    academic: "Academic",
  }

  const exampleCountByLevel = { none: 0, few: 1, many: 3 } as const

  const introByTone: Record<string, string> = {
    friendly: "Let's learn together.",
    professional: "Please review the following guidance.",
    academic: "Consider the following material for study.",
  }
  const summaryByTone: Record<string, (theme: string) => string> = {
    friendly: (theme) => `Nice work! You covered ${theme}.`,
    professional: (theme) => `Summary: This training covered ${theme}.`,
    academic: (theme) => `In summary, the material addressed ${theme}.`,
  }
  const practiceByMode: Record<string, string> = {
    study: "Study Tip: Reread the key points and answer the quiz.",
    training: "On-the-job Tip: Apply these points in your next task.",
    exam: "Exam Tip: Memorize the key points and rehearse with the quiz.",
  }
  const explanationPrefixByAudience: Record<string, string> = {
    beginner: "Why: ",
    student: "Reason: ",
    employee: "Rationale: ",
    manager: "Business rationale: ",
    general: "Explanation: ",
  }

  return {
    isAudioOptimized,
    detailLabel: detailLabels[profile.detailLevel],
    audienceLabel: audienceLabels[profile.targetUser],
    toneLabel: toneLabels[profile.tone],
    exampleCount: exampleCountByLevel[profile.exampleLevel],
    intro: introByTone[profile.tone],
    summary: summaryByTone[profile.tone],
    practice: practiceByMode[profile.outputMode],
    explanationPrefix: explanationPrefixByAudience[profile.targetUser],
    quizQuestionTemplate: (theme, index, total) => {
      if (profile.outputMode === "exam") {
        return `Question ${index + 1} of ${total}: Select the best option regarding ${theme}.`
      }
      return `Which choice best aligns with the theme: ${theme}?`
    },
    choiceA: (theme) => {
      if (profile.difficulty === "hard") {
        return `Apply best practice for ${theme} in a real scenario`
      }
      if (profile.difficulty === "easy") {
        return `Focus on the basics of ${theme}`
      }
      return `Focus on ${theme}`
    },
    choiceB: "Ignore customer context",
    choiceC: "Skip confirmation steps",
    choiceD: "Use unclear language",
    explanationTemplate: (theme) => {
      const prefix = explanationPrefixByAudience[profile.targetUser]
      if (profile.detailLevel === "detailed") {
        return `${prefix}This option directly aligns with ${theme} and reflects the recommended approach covered in the document.`
      }
      if (profile.detailLevel === "short") {
        return `${prefix}Matches ${theme}.`
      }
      return `${prefix}It directly matches the theme: ${theme}.`
    },
  }
}

function shortenForAudio(text: string, isAudioOptimized: boolean) {
  if (!isAudioOptimized) {
    return text
  }
  // Audio optimization: split very long sentences at the first clause boundary.
  const firstClause = text.split(/[.。:：]/)[0]
  const candidate = firstClause.trim()
  return candidate.length >= 12 ? candidate : text
}

function buildDocumentFile(
  config: LearningPackConfig,
  docIndex: number,
  items: Array<{ text: string; ttsText: string }>,
): DocumentFile {
  const fileIndex = String(docIndex + 1).padStart(2, "0")
  return {
    id: `${config.id}_doc_${fileIndex}`,
    type: "document",
    schemaVersion: 1,
    title: config.documentCount > 1 ? `${config.title} (${fileIndex})` : config.title,
    description: config.description?.trim() || "Generated learning pack",
    language: config.language,
    globalTags: ["sokqa-learning-pack-factory"],
    documents: items.map((item, index) => ({
      id: `doc-${index + 1}`,
      text: item.text,
      tts: { text: item.ttsText },
    })),
  }
}

function buildQuizFile(config: LearningPackConfig, quizIndex: number, questions: QuizFile["questions"]): QuizFile {
  const fileIndex = String(quizIndex + 1).padStart(2, "0")
  return {
    id: `${config.id}_quiz_${fileIndex}`,
    type: "quiz",
    schemaVersion: 1,
    title: config.quizCount > 1 ? `${config.title} Quiz (${fileIndex})` : `${config.title} Quiz`,
    description: config.description?.trim() || "Generated learning pack",
    language: config.language,
    globalTags: ["sokqa-learning-pack-factory"],
    questions,
  }
}

function buildMetadataFile(
  config: LearningPackConfig,
  documents: DocumentFile[],
  quizzes: QuizFile[],
  source: MetadataFile["source"],
  references: string[],
  profile: Required<GenerationProfile>,
  createdAt = new Date().toISOString(),
): MetadataFile {
  return {
    id: config.id,
    title: config.title,
    description: config.description?.trim() || "Generated learning pack",
    createdAt,
    generator: "sokqa-learning-pack-factory",
    version: "0.6.0",
    language: config.language,
    source,
    profile,
    references,
    documents: documents.map((_, index) => buildDocumentFileName(index)),
    quizzes: quizzes.map((_, index) => buildQuizFileName(index)),
  }
}

function buildGenericDocumentItems(config: LearningPackConfig, adapter: ProfileAdapter, strict: boolean) {
  const items: Array<{ text: string; ttsText: string }> = []

  items.push({
    text: `Intro (${adapter.toneLabel}): ${adapter.intro}`,
    ttsText: strict ? `Intro (${adapter.toneLabel}): ${adapter.intro}` : ensureEndsWithComma(toTts(config.language, `Intro: ${adapter.intro}`)),
  })

  const base = [
    `Theme: ${config.theme}`,
    `Goal: ${config.title}`,
    `Key Points: ${config.description?.trim() || config.theme}`,
  ]
  for (const text of base) {
    items.push({
      text,
      ttsText: strict ? text : ensureEndsWithComma(toTts(config.language, text)),
    })
  }

  // detailLevel adds deeper explanation sections
  if (adapter.detailLabel === "Deep Dive" || adapter.detailLabel === "Detail") {
    const detailText = `${adapter.detailLabel}: This pack is designed for ${adapter.audienceLabel.toLowerCase()} learners.`
    items.push({
      text: detailText,
      ttsText: strict ? detailText : ensureEndsWithComma(toTts(config.language, detailText)),
    })
  }

  // exampleLevel adds example sections
  for (let i = 0; i < adapter.exampleCount; i += 1) {
    const text = `Example ${i + 1}: Apply ${config.theme} to a practical scenario.`
    items.push({
      text,
      ttsText: strict ? text : ensureEndsWithComma(toTts(config.language, text)),
    })
  }

  items.push({
    text: adapter.summary(config.theme),
    ttsText: strict ? adapter.summary(config.theme) : ensureEndsWithComma(toTts(config.language, adapter.summary(config.theme))),
  })
  items.push({
    text: adapter.practice,
    ttsText: strict ? adapter.practice : ensureEndsWithComma(toTts(config.language, adapter.practice)),
  })

  if (adapter.isAudioOptimized) {
    return items.map((item) => ({
      text: shortenForAudio(item.text, true),
      ttsText: shortenForAudio(item.ttsText, true),
    }))
  }

  return items
}

function buildSourceOnlyDocumentItems(lines: string[]) {
  const items = lines.map((line) => ({ text: line, ttsText: line }))
  if (items.length === 0) {
    throw new Error("reference must contain at least one non-empty line for source_only")
  }
  return items
}

function buildSourcePlusDocumentItems(config: LearningPackConfig, adapter: ProfileAdapter, lines: string[]) {
  const sourceLines = lines.slice(0, 6)
  const items: Array<{ text: string; ttsText: string }> = []

  for (const line of sourceLines) {
    items.push({ text: line, ttsText: ensureEndsWithComma(toTts(config.language, line)) })
  }

  items.push({
    text: `Summary (${adapter.toneLabel}): ${adapter.summary(config.theme)}`,
    ttsText: ensureEndsWithComma(toTts(config.language, adapter.summary(config.theme))),
  })
  items.push({
    text: adapter.practice,
    ttsText: ensureEndsWithComma(toTts(config.language, adapter.practice)),
  })

  if (adapter.isAudioOptimized) {
    return items.map((item) => ({
      text: shortenForAudio(item.text, true),
      ttsText: shortenForAudio(item.ttsText, true),
    }))
  }

  return items
}

function buildExactTextDocumentItems(paragraphs: string[]) {
  const items = paragraphs.map((p) => ({ text: p, ttsText: p }))
  if (items.length === 0) {
    throw new Error("reference must contain at least one paragraph for exact_text_document")
  }
  return items
}

function buildQuizTts(config: LearningPackConfig, question: string, choices: [string, string, string, string], answer: string, explanation: string) {
  // choiceTexts is a 4-item array mirroring choices, WITHOUT choice numbers.
  // App-side handles numbering. Never embed "1番", "Option 1", etc.
  const choiceTexts = choices.map((choice) => ensureEndsWithComma(toTts(config.language, choice))) as [string, string, string, string]
  return {
    questionText: ensureEndsWithComma(toTts(config.language, question)),
    choiceTexts,
    answerText: ensureEndsWithComma(toTts(config.language, `Answer: ${answer}.`)),
    explanationText: ensureEndsWithComma(toTts(config.language, `Explanation: ${explanation}`)),
  }
}

function buildGenericQuizQuestions(config: LearningPackConfig, adapter: ProfileAdapter, count: number): QuizFile["questions"] {
  const questions: QuizFile["questions"] = []
  for (let index = 0; index < count; index += 1) {
    const choices: [string, string, string, string] = [
      adapter.choiceA(config.theme),
      adapter.choiceB,
      adapter.choiceC,
      adapter.choiceD,
    ]
    const question = adapter.quizQuestionTemplate(config.theme, index, count)
    const explanation = adapter.explanationTemplate(config.theme)

    questions.push({
      id: `q-${index + 1}`,
      question,
      choices,
      answerIndex: 0,
      explanation,
      tts: buildQuizTts(config, question, choices, choices[0], explanation),
    })
  }
  return questions
}

function buildSourceOnlyQuizQuestions(config: LearningPackConfig, lines: string[], count: number): QuizFile["questions"] {
  if (lines.length === 0) {
    throw new Error("reference must contain at least one non-empty line for source_only quizzes")
  }
  const source = lines
  const questions: QuizFile["questions"] = []

  for (let index = 0; index < count; index += 1) {
    const a = source[index % source.length]
    const b = source[(index + 1) % source.length]
    const c = source[(index + 2) % source.length]
    const d = source[(index + 3) % source.length]
    const choices: [string, string, string, string] = [a, b, c, d]
    questions.push({
      id: `q-${index + 1}`,
      question: a,
      choices,
      answerIndex: 0,
      explanation: a,
      tts: {
        questionText: a,
        choiceTexts: [a, b, c, d] as [string, string, string, string],
        answerText: a,
        explanationText: a,
      },
    })
  }

  return questions
}

function runValidation(name: string, validator: () => void): ValidationCheck {
  try {
    validator()
    return { name, passed: true, message: "Passed" }
  } catch (error) {
    return {
      name,
      passed: false,
      message: error instanceof Error ? error.message : `${error}`,
    }
  }
}

function validateDocument(document: DocumentFile) {
  if (document.type !== "document") {
    throw new Error("document.type must be 'document'")
  }
  if (document.schemaVersion !== 1) {
    throw new Error("document.schemaVersion must be 1")
  }
  if (!isPlainText(document.language)) {
    throw new Error("document.language is required")
  }
  if (!Array.isArray(document.documents) || document.documents.length < 1) {
    throw new Error("document.documents must contain at least one item")
  }

  for (const item of document.documents) {
    if (!/^doc-\d+$/.test(item.id)) {
      throw new Error(`invalid document item id: ${item.id}`)
    }
    if (!isPlainText(item.text)) {
      throw new Error(`document text is required: ${item.id}`)
    }
    if (!isPlainText(item.tts?.text)) {
      throw new Error(`document tts.text is required: ${item.id}`)
    }
  }
}

function validateQuiz(quiz: QuizFile) {
  if (quiz.type !== "quiz") {
    throw new Error("quiz.type must be 'quiz'")
  }
  if (quiz.schemaVersion !== 1) {
    throw new Error("quiz.schemaVersion must be 1")
  }
  if (!isPlainText(quiz.language)) {
    throw new Error("quiz.language is required")
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1) {
    throw new Error("quiz.questions must contain at least 1 item")
  }

  for (const question of quiz.questions) {
    if (!/^q-\d+$/.test(question.id)) {
      throw new Error(`invalid quiz question id: ${question.id}`)
    }
    if (!isPlainText(question.question)) {
      throw new Error(`quiz question is required: ${question.id}`)
    }
    if (!Array.isArray(question.choices) || question.choices.length !== 4) {
      throw new Error(`quiz choices must contain exactly 4 items: ${question.id}`)
    }
    if (![0, 1, 2, 3].includes(question.answerIndex)) {
      throw new Error(`quiz answerIndex must be between 0 and 3: ${question.id}`)
    }
    if (!isPlainText(question.explanation)) {
      throw new Error(`quiz explanation is required: ${question.id}`)
    }
    if (!isPlainText(question.tts?.questionText)) {
      throw new Error(`quiz tts.questionText is required: ${question.id}`)
    }
    if (!Array.isArray(question.tts?.choiceTexts) || question.tts.choiceTexts.length !== 4) {
      throw new Error(`quiz tts.choiceTexts must contain exactly 4 items: ${question.id}`)
    }
    for (const choiceText of question.tts?.choiceTexts ?? []) {
      if (!isPlainText(choiceText)) {
        throw new Error(`quiz tts.choiceTexts has empty entry: ${question.id}`)
      }
      if (NUMBER_READING_PATTERN.test(choiceText)) {
        throw new Error(`quiz tts.choiceTexts must not contain choice numbers: ${question.id}`)
      }
    }
    if (!isPlainText(question.tts?.answerText)) {
      throw new Error(`quiz tts.answerText is required: ${question.id}`)
    }
    if (!isPlainText(question.tts?.explanationText)) {
      throw new Error(`quiz tts.explanationText is required: ${question.id}`)
    }
  }
}

function validateMetadata(payload: PackPayload) {
  const { documents, quizzes, metadata } = payload

  if (!isPlainText(metadata.id)) {
    throw new Error("metadata.id is required")
  }
  if (!isPlainText(metadata.title)) {
    throw new Error("metadata.title is required")
  }
  if (!isPlainText(metadata.description)) {
    throw new Error("metadata.description is required")
  }
  if (!isPlainText(metadata.createdAt) || Number.isNaN(Date.parse(metadata.createdAt))) {
    throw new Error("metadata.createdAt must be a valid ISO date")
  }
  if (metadata.generator !== "sokqa-learning-pack-factory") {
    throw new Error("metadata.generator is invalid")
  }
  if (metadata.version !== "0.6.0") {
    throw new Error("metadata.version is invalid")
  }
  if (!isPlainText(metadata.language)) {
    throw new Error("metadata.language is required")
  }
  if (typeof metadata.source?.hasReference !== "boolean") {
    throw new Error("metadata.source.hasReference is required")
  }
  if (!isPlainText(metadata.source?.mode)) {
    throw new Error("metadata.source.mode is required")
  }
  if (typeof metadata.source?.path !== "string") {
    throw new Error("metadata.source.path is required")
  }
  if (!Array.isArray(metadata.references)) {
    throw new Error("metadata.references is required")
  }
  if (!metadata.source.hasReference) {
    if (metadata.source.mode !== "none") {
      throw new Error("metadata.source.mode must be none when hasReference is false")
    }
    if (metadata.source.path.trim() !== "") {
      throw new Error("metadata.source.path must be empty when hasReference is false")
    }
    if (metadata.references.length !== 0) {
      throw new Error("metadata.references must be empty when hasReference is false")
    }
  } else if (metadata.references.length === 0) {
    throw new Error("metadata.references must contain at least one item when hasReference is true")
  }
  for (const reference of metadata.references) {
    if (!isPlainText(reference)) {
      throw new Error("metadata.references must contain only non-empty strings")
    }
  }

  if (!metadata.profile || typeof metadata.profile !== "object") {
    throw new Error("metadata.profile is required")
  }
  const profile = metadata.profile as Required<GenerationProfile>
  if (typeof profile.targetUser !== "string") throw new Error("metadata.profile.targetUser is required")
  if (typeof profile.difficulty !== "string") throw new Error("metadata.profile.difficulty is required")
  if (typeof profile.learningStyle !== "string") throw new Error("metadata.profile.learningStyle is required")
  if (typeof profile.outputMode !== "string") throw new Error("metadata.profile.outputMode is required")
  if (typeof profile.tone !== "string") throw new Error("metadata.profile.tone is required")
  if (typeof profile.detailLevel !== "string") throw new Error("metadata.profile.detailLevel is required")
  if (typeof profile.exampleLevel !== "string") throw new Error("metadata.profile.exampleLevel is required")
  if (typeof profile.audioOptimization !== "boolean") throw new Error("metadata.profile.audioOptimization is required")

  for (const document of documents) {
    if (document.language !== metadata.language) {
      throw new Error("metadata.language must match document.language")
    }
  }
  for (const quiz of quizzes) {
    if (quiz.language !== metadata.language) {
      throw new Error("metadata.language must match quiz.language")
    }
  }
  if (metadata.documents.length !== documents.length) {
    throw new Error("metadata.documents count does not match documents")
  }
  if (metadata.quizzes.length !== quizzes.length) {
    throw new Error("metadata.quizzes count does not match quizzes")
  }

  const expectedDocuments = documents.map((_, index) => buildDocumentFileName(index))
  const expectedQuizzes = quizzes.map((_, index) => buildQuizFileName(index))

  if (metadata.documents.some((fileName, index) => fileName !== expectedDocuments[index])) {
    throw new Error("metadata.documents does not match generated files")
  }
  if (metadata.quizzes.some((fileName, index) => fileName !== expectedQuizzes[index])) {
    throw new Error("metadata.quizzes does not match generated files")
  }
}

function validateGenerationCounts(payload: PackPayload, expectations: ValidationExpectations) {
  if (payload.documents.length !== expectations.documentCount) {
    throw new Error(`generated document count ${payload.documents.length} does not match documentCount ${expectations.documentCount}`)
  }
  if (payload.quizzes.length !== expectations.quizCount) {
    throw new Error(`generated quiz count ${payload.quizzes.length} does not match quizCount ${expectations.quizCount}`)
  }
  if (expectations.mode === "exact_text_document" && payload.quizzes.length !== 0) {
    throw new Error("exact_text_document must not generate quizzes")
  }

  for (const quiz of payload.quizzes) {
    if (quiz.questions.length !== expectations.questionsPerQuiz) {
      throw new Error(
        `quiz ${quiz.id} question count ${quiz.questions.length} does not match questionsPerQuiz ${expectations.questionsPerQuiz}`,
      )
    }
  }
}

function validateSerializedFiles(payload: PackPayload) {
  const serializedFileNames = serializeLearningPackFiles(payload).map((file) => file.fileName)
  const expectedFileNames = ["metadata.json", ...payload.metadata.documents, ...payload.metadata.quizzes]

  if (serializedFileNames.length !== expectedFileNames.length) {
    throw new Error("serialized file count does not match metadata")
  }
  if (serializedFileNames.some((fileName, index) => fileName !== expectedFileNames[index])) {
    throw new Error("serialized files do not match metadata")
  }
}

export function validateLearningPack(payload: PackPayload, expectations?: ValidationExpectations): ValidationResult {
  const checks = [
    runValidation("documents-json-parse", () => {
      for (const document of payload.documents) {
        JSON.parse(JSON.stringify(document))
      }
    }),
    runValidation("quizzes-json-parse", () => {
      for (const quiz of payload.quizzes) {
        JSON.parse(JSON.stringify(quiz))
      }
    }),
    runValidation("metadata-json-parse", () => {
      JSON.parse(JSON.stringify(payload.metadata))
    }),
    runValidation("document-shape", () => {
      for (const document of payload.documents) {
        validateDocument(document)
      }
    }),
    runValidation("quiz-shape", () => {
      for (const quiz of payload.quizzes) {
        validateQuiz(quiz)
      }
    }),
    runValidation("metadata-consistency", () => {
      validateMetadata(payload)
    }),
    runValidation("serialized-files-consistency", () => {
      validateSerializedFiles(payload)
    }),
  ]

  if (expectations) {
    checks.push(
      runValidation("generation-counts", () => {
        validateGenerationCounts(payload, expectations)
      }),
    )
  }

  const errors = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.message}`)
  return {
    passed: errors.length === 0,
    checks,
    errors,
  }
}

export function serializeLearningPackFiles(payload: PackPayload) {
  return [
    {
      fileName: "metadata.json",
      content: JSON.stringify(payload.metadata, null, 2),
    },
    ...payload.documents.map((document, index) => ({
      fileName: buildDocumentFileName(index),
      content: JSON.stringify(document, null, 2),
    })),
    ...payload.quizzes.map((quiz, index) => ({
      fileName: buildQuizFileName(index),
      content: JSON.stringify(quiz, null, 2),
    })),
  ]
}

export function generateLearningPack(configInput: LearningPackConfig, referenceText?: string, createdAt?: string): LearningPack {
  const config: LearningPackConfig = {
    ...configInput,
    id: normalizePackId(configInput.id || buildPackId()),
    reference: {
      enabled: configInput.reference?.enabled ?? false,
      path: configInput.reference?.path ?? "",
      paths: configInput.reference?.paths,
      mode: configInput.reference?.mode ?? "none",
    },
  }

  const profile = resolveProfile(config)
  const adapter = buildProfileAdapter(profile)

  const referencePaths = normalizeReferencePaths(config.reference)
  const hasReference = config.reference.enabled && referencePaths.length > 0
  const mode: ReferenceMode = hasReference ? config.reference.mode : "none"
  const source: MetadataFile["source"] = {
    hasReference,
    mode,
    path: hasReference ? getPrimaryReferencePath(config.reference) : "",
  }
  const references = hasReference ? referencePaths.map((referencePath) => path.basename(referencePath)) : []

  const strictReferenceText = mode === "source_only" || mode === "exact_text_document"
  const referenceValue = referenceText?.trim() || ""
  if (hasReference && !referenceValue) {
    throw new Error("reference text is required when reference is enabled")
  }

  const documentCount = clampMin(config.documentCount, 1)
  const quizCount = mode === "exact_text_document" ? 0 : clampMin(config.quizCount, 0)
  const questionsPerQuiz = clampMin(config.questionsPerQuiz, 1)

  const documents: DocumentFile[] = []
  if (mode === "exact_text_document") {
    const paragraphs = splitParagraphs(referenceValue)
    const groups = chunkEvenly(paragraphs, documentCount)
    for (let index = 0; index < groups.length; index += 1) {
      documents.push(buildDocumentFile(config, index, buildExactTextDocumentItems(groups[index])))
    }
  } else if (mode === "source_only") {
    const lines = splitNonEmptyLines(referenceValue)
    const groups = chunkEvenly(lines, documentCount)
    for (let index = 0; index < groups.length; index += 1) {
      documents.push(buildDocumentFile(config, index, buildSourceOnlyDocumentItems(groups[index])))
    }
  } else if (mode === "source_plus") {
    const lines = splitNonEmptyLines(referenceValue)
    for (let index = 0; index < documentCount; index += 1) {
      documents.push(buildDocumentFile(config, index, buildSourcePlusDocumentItems(config, adapter, lines)))
    }
  } else {
    for (let index = 0; index < documentCount; index += 1) {
      documents.push(buildDocumentFile(config, index, buildGenericDocumentItems(config, adapter, strictReferenceText)))
    }
  }

  const quizzes: QuizFile[] = []
  if (quizCount > 0) {
    if (mode === "source_only") {
      const lines = splitNonEmptyLines(referenceValue)
      for (let index = 0; index < quizCount; index += 1) {
        quizzes.push(buildQuizFile(config, index, buildSourceOnlyQuizQuestions(config, lines, questionsPerQuiz)))
      }
    } else if (mode === "source_plus") {
      for (let index = 0; index < quizCount; index += 1) quizzes.push(buildQuizFile(config, index, buildGenericQuizQuestions(config, adapter, questionsPerQuiz)))
    } else {
      for (let index = 0; index < quizCount; index += 1) quizzes.push(buildQuizFile(config, index, buildGenericQuizQuestions(config, adapter, questionsPerQuiz)))
    }
  }

  const metadata = buildMetadataFile(config, documents, quizzes, source, references, profile, createdAt)
  const validation = validateLearningPack(
    { documents, quizzes, metadata },
    { documentCount, quizCount, questionsPerQuiz, mode },
  )

  return { documents, quizzes, metadata, validation }
}
