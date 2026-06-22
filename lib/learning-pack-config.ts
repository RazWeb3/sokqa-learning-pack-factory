import { access, readFile } from "node:fs/promises"
import path from "node:path"

export type ReferenceMode = "none" | "source_only" | "source_plus" | "exact_text_document"
export const SUPPORTED_REFERENCE_EXTENSIONS = [".txt", ".md", ".pdf"] as const

export type TargetUser = "beginner" | "student" | "employee" | "manager" | "general"
export type Difficulty = "easy" | "normal" | "hard"
export type LearningStyle = "audio" | "reading" | "quiz" | "balanced"
export type OutputMode = "study" | "training" | "exam"
export type Tone = "friendly" | "professional" | "academic"
export type DetailLevel = "short" | "normal" | "detailed"
export type ExampleLevel = "none" | "few" | "many"

// v0.7 Generation Quality Controls
export type DistractorSource = "fixed" | "theme" | "reference"
export type QuizStyle = "concept-check" | "application" | "case-study"
export type ExplanationDepth = "short" | "standard" | "detailed"
export type SentenceLength = "short" | "medium" | "long"

export type GenerationProfile = {
  targetUser?: TargetUser
  difficulty?: Difficulty
  learningStyle?: LearningStyle
  outputMode?: OutputMode
  tone?: Tone
  detailLevel?: DetailLevel
  exampleLevel?: ExampleLevel
  audioOptimization?: boolean
  // v0.7 Generation Quality Controls
  distractorSource?: DistractorSource
  quizStyle?: QuizStyle
  explanationDepth?: ExplanationDepth
  practicalExamples?: boolean
  sentenceLength?: SentenceLength
}

export type LearningPackConfig = {
  id: string
  title: string
  description?: string
  theme: string
  language: string
  documentCount: number
  quizCount: number
  questionsPerQuiz: number
  outputDir: string
  reference: {
    enabled: boolean
    path?: string
    paths?: string[]
    mode: ReferenceMode
  }
} & GenerationProfile

export const DEFAULT_PROFILE: Required<GenerationProfile> = {
  targetUser: "general",
  difficulty: "normal",
  learningStyle: "balanced",
  outputMode: "study",
  tone: "friendly",
  detailLevel: "normal",
  exampleLevel: "few",
  audioOptimization: false,
  // v0.7 Generation Quality Controls
  distractorSource: "fixed",
  quizStyle: "concept-check",
  explanationDepth: "standard",
  practicalExamples: false,
  sentenceLength: "medium",
}

export const PROFILE_VALUES = {
  targetUser: ["beginner", "student", "employee", "manager", "general"] as const,
  difficulty: ["easy", "normal", "hard"] as const,
  learningStyle: ["audio", "reading", "quiz", "balanced"] as const,
  outputMode: ["study", "training", "exam"] as const,
  tone: ["friendly", "professional", "academic"] as const,
  detailLevel: ["short", "normal", "detailed"] as const,
  exampleLevel: ["none", "few", "many"] as const,
  // v0.7 Generation Quality Controls
  distractorSource: ["fixed", "theme", "reference"] as const,
  quizStyle: ["concept-check", "application", "case-study"] as const,
  explanationDepth: ["short", "standard", "detailed"] as const,
  practicalExamples: [false, true] as const,
  sentenceLength: ["short", "medium", "long"] as const,
} as const

export function resolveProfile(config: GenerationProfile): Required<GenerationProfile> {
  return {
    targetUser: config.targetUser ?? DEFAULT_PROFILE.targetUser,
    difficulty: config.difficulty ?? DEFAULT_PROFILE.difficulty,
    learningStyle: config.learningStyle ?? DEFAULT_PROFILE.learningStyle,
    outputMode: config.outputMode ?? DEFAULT_PROFILE.outputMode,
    tone: config.tone ?? DEFAULT_PROFILE.tone,
    detailLevel: config.detailLevel ?? DEFAULT_PROFILE.detailLevel,
    exampleLevel: config.exampleLevel ?? DEFAULT_PROFILE.exampleLevel,
    audioOptimization: config.audioOptimization ?? DEFAULT_PROFILE.audioOptimization,
    // v0.7 Generation Quality Controls
    distractorSource: config.distractorSource ?? DEFAULT_PROFILE.distractorSource,
    quizStyle: config.quizStyle ?? DEFAULT_PROFILE.quizStyle,
    explanationDepth: config.explanationDepth ?? DEFAULT_PROFILE.explanationDepth,
    practicalExamples: config.practicalExamples ?? DEFAULT_PROFILE.practicalExamples,
    sentenceLength: config.sentenceLength ?? DEFAULT_PROFILE.sentenceLength,
  }
}

function isPlainText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIntegerInRange(value: unknown, name: string, min: number) {
  assert(Number.isInteger(value), `${name} must be an integer`)
  assert((value as number) >= min, `${name} must be >= ${min}`)
}

function assertOneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]) {
  assert(typeof value === "string" && (allowed as readonly string[]).includes(value), `${name} must be one of ${allowed.join("/")}`)
}

export function resolveFrom(baseDir: string, maybeRelativePath: string) {
  return path.isAbsolute(maybeRelativePath) ? maybeRelativePath : path.resolve(baseDir, maybeRelativePath)
}

function isSupportedReferencePath(referencePath: string) {
  return SUPPORTED_REFERENCE_EXTENSIONS.includes(path.extname(referencePath).toLowerCase() as (typeof SUPPORTED_REFERENCE_EXTENSIONS)[number])
}

export function normalizeReferencePaths(reference: LearningPackConfig["reference"]) {
  const normalizedPaths: string[] = []

  if (typeof reference.path === "string" && reference.path.trim()) {
    normalizedPaths.push(reference.path.trim())
  }
  if (Array.isArray(reference.paths)) {
    for (const value of reference.paths) {
      if (typeof value === "string" && value.trim()) {
        normalizedPaths.push(value.trim())
      }
    }
  }

  return normalizedPaths
}

export function getPrimaryReferencePath(reference: LearningPackConfig["reference"]) {
  return normalizeReferencePaths(reference)[0] ?? ""
}

export async function validateLearningPackConfig(config: LearningPackConfig, configFilePath?: string) {
  assert(isPlainText(config.id), "id is required")
  assert(isPlainText(config.title), "title is required")
  assert(isPlainText(config.theme), "theme is required")
  assert(isPlainText(config.language), "language is required")
  assertIntegerInRange(config.documentCount, "documentCount", 1)
  assertIntegerInRange(config.quizCount, "quizCount", 0)
  assertIntegerInRange(config.questionsPerQuiz, "questionsPerQuiz", 1)
  assert(isPlainText(config.outputDir), "outputDir is required")

  assert(typeof config.reference?.enabled === "boolean", "reference.enabled is required")
  assert(
    typeof config.reference?.path === "string" || typeof config.reference?.path === "undefined",
    "reference.path must be a string when provided",
  )
  assert(
    Array.isArray(config.reference?.paths) || typeof config.reference?.paths === "undefined",
    "reference.paths must be an array when provided",
  )
  if (Array.isArray(config.reference?.paths)) {
    assert(config.reference.paths.length > 0, "reference.paths must not be empty when provided")
    for (const value of config.reference.paths) {
      assert(typeof value === "string", "reference.paths must contain only strings")
    }
  }
  assert(isPlainText(config.reference?.mode), "reference.mode is required")

  const isValidMode =
    config.reference.mode === "none" ||
    config.reference.mode === "source_only" ||
    config.reference.mode === "source_plus" ||
    config.reference.mode === "exact_text_document"
  assert(isValidMode, "reference.mode must be one of none/source_only/source_plus/exact_text_document")

  // Generation profile validation
  if (config.targetUser !== undefined) {
    assertOneOf(config.targetUser, "targetUser", PROFILE_VALUES.targetUser)
  }
  if (config.difficulty !== undefined) {
    assertOneOf(config.difficulty, "difficulty", PROFILE_VALUES.difficulty)
  }
  if (config.learningStyle !== undefined) {
    assertOneOf(config.learningStyle, "learningStyle", PROFILE_VALUES.learningStyle)
  }
  if (config.outputMode !== undefined) {
    assertOneOf(config.outputMode, "outputMode", PROFILE_VALUES.outputMode)
  }
  if (config.tone !== undefined) {
    assertOneOf(config.tone, "tone", PROFILE_VALUES.tone)
  }
  if (config.detailLevel !== undefined) {
    assertOneOf(config.detailLevel, "detailLevel", PROFILE_VALUES.detailLevel)
  }
  if (config.exampleLevel !== undefined) {
    assertOneOf(config.exampleLevel, "exampleLevel", PROFILE_VALUES.exampleLevel)
  }
  if (config.audioOptimization !== undefined) {
    assert(typeof config.audioOptimization === "boolean", "audioOptimization must be a boolean")
  }

  // v0.7 Generation Quality Controls validation
  if (config.distractorSource !== undefined) {
    assertOneOf(config.distractorSource, "distractorSource", PROFILE_VALUES.distractorSource)
  }
  if (config.quizStyle !== undefined) {
    assertOneOf(config.quizStyle, "quizStyle", PROFILE_VALUES.quizStyle)
  }
  if (config.explanationDepth !== undefined) {
    assertOneOf(config.explanationDepth, "explanationDepth", PROFILE_VALUES.explanationDepth)
  }
  if (config.practicalExamples !== undefined) {
    assert(typeof config.practicalExamples === "boolean", "practicalExamples must be a boolean")
  }
  if (config.sentenceLength !== undefined) {
    assertOneOf(config.sentenceLength, "sentenceLength", PROFILE_VALUES.sentenceLength)
  }

  const referencePaths = normalizeReferencePaths(config.reference)
  const hasReference = config.reference.enabled && referencePaths.length > 0

  if (config.reference.enabled) {
    assert(referencePaths.length > 0, "reference.path or reference.paths is required when reference.enabled is true")
    assert(
      config.reference.mode !== "none",
      "reference.mode must be source_only/source_plus/exact_text_document when reference.enabled is true",
    )

    for (const referencePath of referencePaths) {
      assert(isSupportedReferencePath(referencePath), `Unsupported reference format: ${referencePath}`)
      const referenceAbsPath = resolveFrom(process.cwd(), referencePath)
      await access(referenceAbsPath).catch(() => {
        throw new Error(`reference file does not exist: ${referencePath}`)
      })
    }
  } else {
    assert(config.reference.mode === "none", "reference.mode must be none when reference.enabled is false")
  }

  return {
    hasReference,
    referencePaths,
  }
}

export async function loadLearningPackConfig(configPath: string): Promise<LearningPackConfig> {
  const absPath = path.resolve(process.cwd(), configPath)
  const raw = await readFile(absPath, "utf8")
  const parsed = JSON.parse(raw) as unknown
  assert(parsed && typeof parsed === "object", "config must be an object")

  const config = parsed as LearningPackConfig
  if (!config.reference) {
    ;(config as LearningPackConfig).reference = { enabled: false, path: "", mode: "none" }
  }

  await validateLearningPackConfig(config, absPath)
  return config
}
