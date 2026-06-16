import JSZip from "jszip"
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { generateLearningPack, validateLearningPack } from "./learning-pack"
import { buildLearningPackZipBytes, writeLearningPackOutput } from "./learning-pack-zip"
import { loadLearningPackConfig, resolveFrom, validateLearningPackConfig } from "./learning-pack-config"

function splitNonEmptyLines(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
}

describe("learning pack", () => {
  it("loads config", async () => {
    const config = await loadLearningPackConfig("configs/no-reference-topic.json")
    expect(config.id).toBe("no-reference-topic-pack")
    expect(config.reference.mode).toBe("none")
  })

  it("generates without reference and exports zip", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const config = await loadLearningPackConfig("configs/no-reference-topic.json")
    const pack = generateLearningPack(config)

    try {
      expect(pack.documents).toHaveLength(1)
      expect(pack.quizzes).toHaveLength(1)
      expect(pack.validation.passed).toBe(true)
      expect(pack.metadata.source).toEqual({ hasReference: false, mode: "none", path: "" })

      const exportResult = await writeLearningPackOutput(pack, outputDir)
      const zipBytes = await buildLearningPackZipBytes(pack)
      const zip = await JSZip.loadAsync(zipBytes)

      expect(Object.keys(zip.files).sort()).toEqual(["doc_01.json", "metadata.json", "quiz_01.json"])
      await expect(stat(path.join(exportResult.packDirectory, "learning-pack.zip"))).resolves.toBeDefined()
      await expect(readFile(path.join(exportResult.packDirectory, "metadata.json"), "utf8")).resolves.toContain(
        '"id": "no-reference-topic-pack"',
      )
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("fails when quiz choices are not length 4", () => {
    const pack = generateLearningPack({
      id: "invalid-choices-pack",
      title: "Invalid Choices Pack",
      description: "Generated learning pack",
      theme: "customer service",
      language: "en",
      documentCount: 1,
      quizCount: 1,
      questionsPerQuiz: 5,
      outputDir: "output/invalid-choices-pack",
      reference: { enabled: false, path: "", mode: "none" },
    })
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].choices = ["A", "B", "C"] as unknown as [string, string, string, string]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("quiz choices must contain exactly 4 items"))).toBe(true)
  })

  it("fails when answerIndex is out of range", () => {
    const pack = generateLearningPack({
      id: "invalid-answer-pack",
      title: "Invalid Answer Pack",
      description: "Generated learning pack",
      theme: "customer service",
      language: "en",
      documentCount: 1,
      quizCount: 1,
      questionsPerQuiz: 5,
      outputDir: "output/invalid-answer-pack",
      reference: { enabled: false, path: "", mode: "none" },
    })
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].answerIndex = 4 as 0

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("quiz answerIndex must be between 0 and 3"))).toBe(true)
  })

  it("fails when metadata file references do not match generated files", () => {
    const pack = generateLearningPack({
      id: "invalid-metadata-pack",
      title: "Invalid Metadata Pack",
      description: "Generated learning pack",
      theme: "customer service",
      language: "en",
      documentCount: 1,
      quizCount: 1,
      questionsPerQuiz: 5,
      outputDir: "output/invalid-metadata-pack",
      reference: { enabled: false, path: "", mode: "none" },
    })
    const invalidPack = structuredClone(pack)

    invalidPack.metadata.documents = ["doc_99.json"]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("metadata.documents does not match generated files"))).toBe(true)
  })

  it("validates and generates in source_only mode without adding non-reference strings", async () => {
    const configPath = "configs/customer-service-source-only.json"
    const config = await loadLearningPackConfig(configPath)
    const referenceText = await readFile(resolveFrom(process.cwd(), config.reference.path), "utf8")
    const referenceLines = splitNonEmptyLines(referenceText)
    const pack = generateLearningPack(config, referenceText)

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.source.hasReference).toBe(true)
    expect(pack.metadata.source.mode).toBe("source_only")
    expect(pack.quizzes).toHaveLength(1)

    for (const document of pack.documents) {
      for (const item of document.documents) {
        expect(referenceLines).toContain(item.text)
        expect(referenceLines).toContain(item.tts.text)
      }
    }

    for (const quiz of pack.quizzes) {
      for (const q of quiz.questions) {
        expect(referenceLines).toContain(q.question)
        expect(referenceLines).toContain(q.explanation)
        expect(referenceLines).toContain(q.tts.questionText)
        expect(referenceLines).toContain(q.tts.choicesText)
        expect(referenceLines).toContain(q.tts.answerText)
        expect(referenceLines).toContain(q.tts.explanationText)
        for (const choice of q.choices) {
          expect(referenceLines).toContain(choice)
        }
      }
    }
  })

  it("validates and generates in source_plus mode", async () => {
    const configPath = "configs/customer-service-source-plus.json"
    const config = await loadLearningPackConfig(configPath)
    const referenceText = await readFile(resolveFrom(process.cwd(), config.reference.path), "utf8")
    const pack = generateLearningPack(config, referenceText)

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.source.hasReference).toBe(true)
    expect(pack.metadata.source.mode).toBe("source_plus")
    expect(pack.documents).toHaveLength(1)
    expect(pack.quizzes).toHaveLength(1)
  })

  it("does not output quiz files in exact_text_document mode", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const configPath = "configs/customer-service-exact-text.json"
    const config = await loadLearningPackConfig(configPath)
    const referenceText = await readFile(resolveFrom(process.cwd(), config.reference.path), "utf8")
    const pack = generateLearningPack({ ...config, outputDir }, referenceText)

    try {
      expect(pack.validation.passed).toBe(true)
      expect(pack.quizzes).toHaveLength(0)
      expect(pack.metadata.quizzes).toEqual([])

      const exportResult = await writeLearningPackOutput(pack, outputDir)
      const files = (await readdir(exportResult.packDirectory)).sort()
      expect(files).toEqual(["doc_01.json", "learning-pack.zip", "metadata.json"])

      const zipBytes = await buildLearningPackZipBytes(pack)
      const zip = await JSZip.loadAsync(zipBytes)
      expect(Object.keys(zip.files).sort()).toEqual(["doc_01.json", "metadata.json"])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("throws when reference.enabled=true and reference.path is empty", async () => {
    const config = {
      id: "bad-reference-pack",
      title: "Bad Reference Pack",
      description: "bad",
      theme: "t",
      language: "en",
      documentCount: 1,
      quizCount: 1,
      questionsPerQuiz: 5,
      outputDir: "output/bad-reference-pack",
      reference: { enabled: true, path: "", mode: "source_only" as const },
    }
    await expect(validateLearningPackConfig(config)).rejects.toThrow("reference.path is required when reference.enabled is true")
  })

  it("throws when reference.path does not exist", async () => {
    const config = {
      id: "missing-reference-pack",
      title: "Missing Reference Pack",
      description: "missing",
      theme: "t",
      language: "en",
      documentCount: 1,
      quizCount: 1,
      questionsPerQuiz: 5,
      outputDir: "output/missing-reference-pack",
      reference: { enabled: true, path: "references/__missing__.txt", mode: "source_only" as const },
    }
    await expect(validateLearningPackConfig(config, path.resolve(process.cwd(), "configs/_tmp.json"))).rejects.toThrow(
      "reference.path does not exist",
    )
  })

  it("metadata documents/quizzes match actual exported files", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const config = await loadLearningPackConfig("configs/no-reference-topic.json")
    const pack = generateLearningPack({ ...config, outputDir })

    try {
      expect(pack.validation.passed).toBe(true)
      const exportResult = await writeLearningPackOutput(pack, outputDir)
      const files = (await readdir(exportResult.packDirectory)).sort()
      expect(files).toEqual(["doc_01.json", "learning-pack.zip", "metadata.json", "quiz_01.json"])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
