import JSZip from "jszip"
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { generateLearningPack, validateLearningPack } from "./learning-pack"
import type { LearningPackConfig } from "./learning-pack-config"
import { buildLearningPackZipBytes, writeLearningPackOutput } from "./learning-pack-zip"
import { loadLearningPackConfig, resolveFrom, validateLearningPackConfig } from "./learning-pack-config"

function splitNonEmptyLines(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
}

function buildConfig(overrides: Partial<LearningPackConfig> = {}): LearningPackConfig {
  const baseReference: LearningPackConfig["reference"] = { enabled: false, path: "", mode: "none" }
  return {
    id: "test-pack",
    title: "Test Pack",
    description: "Generated learning pack",
    theme: "customer service",
    language: "en",
    documentCount: 1,
    quizCount: 1,
    questionsPerQuiz: 5,
    outputDir: "output/test-pack",
    reference: baseReference,
    ...overrides,
  }
}

async function readZipFileNames(pack: ReturnType<typeof generateLearningPack>) {
  const zipBytes = await buildLearningPackZipBytes(pack)
  const zip = await JSZip.loadAsync(zipBytes)
  return Object.keys(zip.files).sort()
}

describe("learning pack", () => {
  it("loads config", async () => {
    const config = await loadLearningPackConfig("configs/no-reference-topic.json")
    expect(config.id).toBe("no-reference-topic-pack")
    expect(config.reference.mode).toBe("none")
  })

  it("generates documentCount documents with zero-padded file names and unique ids", () => {
    const pack = generateLearningPack(
      buildConfig({
        id: "multi-doc-pack",
        documentCount: 3,
        quizCount: 0,
      }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.documents).toHaveLength(3)
    expect(pack.documents.map((document) => document.id)).toEqual([
      "multi-doc-pack_doc_01",
      "multi-doc-pack_doc_02",
      "multi-doc-pack_doc_03",
    ])
    expect(pack.metadata.documents).toEqual(["doc_01.json", "doc_02.json", "doc_03.json"])
  })

  it("generates quizCount quizzes and applies questionsPerQuiz to each quiz", () => {
    const pack = generateLearningPack(
      buildConfig({
        id: "multi-quiz-pack",
        documentCount: 1,
        quizCount: 2,
        questionsPerQuiz: 5,
      }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.quizzes).toHaveLength(2)
    expect(pack.metadata.quizzes).toEqual(["quiz_01.json", "quiz_02.json"])
    expect(pack.quizzes.map((quiz) => quiz.id)).toEqual(["multi-quiz-pack_quiz_01", "multi-quiz-pack_quiz_02"])
    expect(pack.quizzes.every((quiz) => quiz.questions.length === 5)).toBe(true)
  })

  it("keeps metadata, exported files, and zip contents aligned for multiple outputs", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const pack = generateLearningPack(
      buildConfig({
        id: "aligned-pack",
        documentCount: 3,
        quizCount: 2,
        questionsPerQuiz: 5,
        outputDir,
      }),
    )

    try {
      expect(pack.validation.passed).toBe(true)
      expect(pack.metadata.documents).toEqual(["doc_01.json", "doc_02.json", "doc_03.json"])
      expect(pack.metadata.quizzes).toEqual(["quiz_01.json", "quiz_02.json"])

      const exportResult = await writeLearningPackOutput(pack, outputDir)
      const files = (await readdir(exportResult.packDirectory)).sort()
      expect(files).toEqual([
        "doc_01.json",
        "doc_02.json",
        "doc_03.json",
        "learning-pack.zip",
        "metadata.json",
        "quiz_01.json",
        "quiz_02.json",
      ])
      expect(exportResult.files).toEqual([
        "metadata.json",
        "doc_01.json",
        "doc_02.json",
        "doc_03.json",
        "quiz_01.json",
        "quiz_02.json",
        "learning-pack.zip",
      ])
      expect(await readZipFileNames(pack)).toEqual([
        "doc_01.json",
        "doc_02.json",
        "doc_03.json",
        "metadata.json",
        "quiz_01.json",
        "quiz_02.json",
      ])
      await expect(stat(path.join(exportResult.packDirectory, "learning-pack.zip"))).resolves.toBeDefined()
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("fails when quiz choices are not length 4", () => {
    const pack = generateLearningPack(buildConfig({ id: "invalid-choices-pack" }))
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].choices = ["A", "B", "C"] as unknown as [string, string, string, string]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("quiz choices must contain exactly 4 items"))).toBe(true)
  })

  it("fails when answerIndex is out of range", () => {
    const pack = generateLearningPack(buildConfig({ id: "invalid-answer-pack" }))
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].answerIndex = 4 as 0

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("quiz answerIndex must be between 0 and 3"))).toBe(true)
  })

  it("fails when metadata file references do not match generated files", () => {
    const pack = generateLearningPack(buildConfig({ id: "invalid-metadata-pack" }))
    const invalidPack = structuredClone(pack)

    invalidPack.metadata.documents = ["doc_99.json"]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("metadata.documents does not match generated files"))).toBe(true)
  })

  it("validates and generates in source_only mode without adding non-reference strings", async () => {
    const config = await loadLearningPackConfig("configs/customer-service-source-only.json")
    const referenceText = await readFile(resolveFrom(process.cwd(), config.reference.path), "utf8")
    const referenceLines = splitNonEmptyLines(referenceText)
    const pack = generateLearningPack(
      {
        ...config,
        documentCount: 2,
        quizCount: 2,
        questionsPerQuiz: 4,
      },
      referenceText,
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.source).toEqual({
      hasReference: true,
      mode: "source_only",
      path: config.reference.path,
    })
    expect(pack.documents).toHaveLength(2)
    expect(pack.quizzes).toHaveLength(2)

    for (const document of pack.documents) {
      for (const item of document.documents) {
        expect(referenceLines).toContain(item.text)
        expect(referenceLines).toContain(item.tts.text)
      }
    }

    for (const quiz of pack.quizzes) {
      expect(quiz.questions).toHaveLength(4)
      for (const question of quiz.questions) {
        expect(referenceLines).toContain(question.question)
        expect(referenceLines).toContain(question.explanation)
        expect(referenceLines).toContain(question.tts.questionText)
        expect(referenceLines).toContain(question.tts.choicesText)
        expect(referenceLines).toContain(question.tts.answerText)
        expect(referenceLines).toContain(question.tts.explanationText)
        for (const choice of question.choices) {
          expect(referenceLines).toContain(choice)
        }
      }
    }
  })

  it("validates and generates in source_plus mode with multiple outputs", async () => {
    const config = await loadLearningPackConfig("configs/customer-service-source-plus.json")
    const referenceText = await readFile(resolveFrom(process.cwd(), config.reference.path), "utf8")
    const pack = generateLearningPack(
      {
        ...config,
        documentCount: 2,
        quizCount: 2,
        questionsPerQuiz: 3,
      },
      referenceText,
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.source.mode).toBe("source_plus")
    expect(pack.documents).toHaveLength(2)
    expect(pack.quizzes).toHaveLength(2)
    expect(pack.quizzes.every((quiz) => quiz.questions.length === 3)).toBe(true)
  })

  it("does not generate quiz files in exact_text_document mode even when quizCount is set", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const config = await loadLearningPackConfig("configs/customer-service-exact-text.json")
    const referenceText = await readFile(resolveFrom(process.cwd(), config.reference.path), "utf8")
    const pack = generateLearningPack(
      {
        ...config,
        outputDir,
        documentCount: 1,
        quizCount: 3,
        questionsPerQuiz: 9,
      },
      referenceText,
    )

    try {
      expect(pack.validation.passed).toBe(true)
      expect(pack.quizzes).toHaveLength(0)
      expect(pack.metadata.quizzes).toEqual([])

      const exportResult = await writeLearningPackOutput(pack, outputDir)
      const files = (await readdir(exportResult.packDirectory)).sort()
      expect(files).toEqual(["doc_01.json", "learning-pack.zip", "metadata.json"])
      expect(await readZipFileNames(pack)).toEqual(["doc_01.json", "metadata.json"])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rejects invalid config counts", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-document-count",
          documentCount: 0,
        }),
      ),
    ).rejects.toThrow("documentCount must be >= 1")

    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-quiz-count",
          quizCount: -1,
        }),
      ),
    ).rejects.toThrow("quizCount must be >= 0")

    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-question-count",
          questionsPerQuiz: 0,
        }),
      ),
    ).rejects.toThrow("questionsPerQuiz must be >= 1")
  })

  it("throws when reference.enabled=true and reference.path is empty", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-reference-pack",
          reference: { enabled: true, path: "", mode: "source_only" },
        }),
      ),
    ).rejects.toThrow("reference.path is required when reference.enabled is true")
  })

  it("throws when reference.path does not exist", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "missing-reference-pack",
          reference: { enabled: true, path: "references/__missing__.txt", mode: "source_only" },
        }),
        path.resolve(process.cwd(), "configs/_tmp.json"),
      ),
    ).rejects.toThrow("reference.path does not exist")
  })

  it("loads the multiple-docs-quizzes example config", async () => {
    const config = await loadLearningPackConfig("configs/multiple-docs-quizzes.json")

    expect(config.id).toBe("multi-pack")
    expect(config.documentCount).toBe(3)
    expect(config.quizCount).toBe(2)
    expect(config.questionsPerQuiz).toBe(5)
  })
})
