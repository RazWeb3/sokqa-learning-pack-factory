import { access, readFile } from "node:fs/promises"
import path from "node:path"

export type ReferenceMode = "none" | "source_only" | "source_plus" | "exact_text_document"

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
    path: string
    mode: ReferenceMode
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

export function resolveFrom(baseDir: string, maybeRelativePath: string) {
  return path.isAbsolute(maybeRelativePath) ? maybeRelativePath : path.resolve(baseDir, maybeRelativePath)
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
  assert(typeof config.reference?.path === "string", "reference.path is required")
  assert(isPlainText(config.reference?.mode), "reference.mode is required")

  const isValidMode =
    config.reference.mode === "none" ||
    config.reference.mode === "source_only" ||
    config.reference.mode === "source_plus" ||
    config.reference.mode === "exact_text_document"
  assert(isValidMode, "reference.mode must be one of none/source_only/source_plus/exact_text_document")

  const referencePathTrimmed = config.reference.path.trim()
  const hasReference = config.reference.enabled && referencePathTrimmed.length > 0

  if (config.reference.enabled) {
    assert(referencePathTrimmed.length > 0, "reference.path is required when reference.enabled is true")
    assert(
      config.reference.mode !== "none",
      "reference.mode must be source_only/source_plus/exact_text_document when reference.enabled is true",
    )

    const referenceAbsPath = resolveFrom(process.cwd(), referencePathTrimmed)
    await access(referenceAbsPath).catch(() => {
      throw new Error(`reference.path does not exist: ${config.reference.path}`)
    })
  } else {
    assert(config.reference.mode === "none", "reference.mode must be none when reference.enabled is false")
  }

  return {
    hasReference,
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

