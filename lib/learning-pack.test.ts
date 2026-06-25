import JSZip from "jszip"
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { generateLearningPack, validateLearningPack } from "./learning-pack"
import type { LearningPackConfig } from "./learning-pack-config"
import { buildLearningPackZipBytes, buildQualityReport, writeLearningPackOutput } from "./learning-pack-zip"
import { loadLearningPackConfig, resolveFrom, validateLearningPackConfig } from "./learning-pack-config"
import { loadReferenceContext, loadReferenceFile } from "./reference-loader"

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

async function loadReferenceText(config: LearningPackConfig) {
  const referenceContext = await loadReferenceContext(config)
  return referenceContext.text
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

      const exportResult = await writeLearningPackOutput(pack, outputDir, { theme: "customer service" })
      const files = (await readdir(exportResult.packDirectory)).sort()
      expect(files).toEqual([
        "doc_01.json",
        "doc_02.json",
        "doc_03.json",
        "learning-pack.zip",
        "metadata.json",
        "quality-report.json",
        "quiz_01.json",
        "quiz_02.json",
      ])
      expect(exportResult.files).toEqual([
        "metadata.json",
        "quality-report.json",
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
      const reportText = await readFile(path.join(exportResult.packDirectory, "quality-report.json"), "utf8")
      const report = JSON.parse(reportText) as ReturnType<typeof buildQualityReport>
      expect(report).toEqual({
        score: expect.any(Number),
        duplicateQuestionRate: expect.any(Number),
        duplicateDocumentRate: expect.any(Number),
        genericDistractors: expect.any(Number),
        genericExplanations: expect.any(Number),
        warnings: expect.any(Array),
      })
      expect(report.score).toBeGreaterThanOrEqual(0)
      expect(report.score).toBeLessThanOrEqual(100)
      expect(await readZipFileNames(pack)).not.toContain("quality-report.json")
      await expect(stat(path.join(exportResult.packDirectory, "learning-pack.zip"))).resolves.toBeDefined()
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("builds a quality score in the 0 to 100 range", () => {
    const pack = generateLearningPack(
      buildConfig({
        id: "score-pack",
        documentCount: 2,
        quizCount: 2,
        questionsPerQuiz: 5,
      }),
    )

    const report = buildQualityReport(pack, { theme: "customer service" })

    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
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
    const referenceText = await loadReferenceText(config)
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
    expect(pack.metadata.references).toEqual(["customer-service-manual.txt"])
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
        expect(question.tts.choiceTexts).toHaveLength(4)
        for (const choiceText of question.tts.choiceTexts) {
          expect(referenceLines).toContain(choiceText)
        }
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
    const referenceText = await loadReferenceText(config)
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
    expect(pack.metadata.references).toEqual(["customer-service-manual.txt"])
    expect(pack.documents).toHaveLength(2)
    expect(pack.quizzes).toHaveLength(2)
    expect(pack.quizzes.every((quiz) => quiz.questions.length === 3)).toBe(true)
  })

  it("does not generate quiz files in exact_text_document mode even when quizCount is set", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const config = await loadLearningPackConfig("configs/customer-service-exact-text.json")
    const referenceText = await loadReferenceText(config)
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

      const exportResult = await writeLearningPackOutput(pack, outputDir, { theme: config.theme })
      const files = (await readdir(exportResult.packDirectory)).sort()
      expect(files).toEqual(["doc_01.json", "learning-pack.zip", "metadata.json", "quality-report.json"])
      expect(await readZipFileNames(pack)).toEqual(["doc_01.json", "metadata.json"])
      expect(await readZipFileNames(pack)).not.toContain("quality-report.json")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("loads txt references", async () => {
    const text = await loadReferenceFile("references/customer-service-manual.txt")

    expect(text).toContain("Smile and greet the customer clearly.")
  })

  it("loads markdown references", async () => {
    const text = await loadReferenceFile("references/faq.md")

    expect(text).toContain("# FAQ")
    expect(text).toContain("How should staff respond to refund requests?")
  })

  it("loads pdf references", async () => {
    const text = await loadReferenceFile("references/policy.pdf")

    expect(text).toContain("Refund policy: Verify customer identity before approval.")
    expect(text).toContain("Escalate exceptions to the store manager.")
  })

  it("combines multiple references in order and records them in metadata", async () => {
    const config = await loadLearningPackConfig("configs/multiple-references.json")
    const referenceText = await loadReferenceText(config)
    const pack = generateLearningPack(config, referenceText)

    expect(referenceText).toContain("Smile and greet the customer clearly.")
    expect(referenceText).toContain("# FAQ")
    expect(referenceText).toContain("Refund policy: Verify customer identity before approval.")
    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.source).toEqual({
      hasReference: true,
      mode: "source_plus",
      path: "references/customer-service-manual.txt",
    })
    expect(pack.metadata.references).toEqual(["customer-service-manual.txt", "faq.md", "policy.pdf"])
  })

  it("keeps metadata references in exported multiple-reference zip output", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const config = await loadLearningPackConfig("configs/multiple-references.json")
    const referenceText = await loadReferenceText(config)
    const pack = generateLearningPack(
      {
        ...config,
        outputDir,
      },
      referenceText,
    )

    try {
      const exportResult = await writeLearningPackOutput(pack, outputDir)
      const metadataText = await readFile(path.join(exportResult.packDirectory, "metadata.json"), "utf8")
      const metadata = JSON.parse(metadataText) as typeof pack.metadata

      expect(metadata.references).toEqual(["customer-service-manual.txt", "faq.md", "policy.pdf"])
      expect(await readZipFileNames(pack)).toEqual(["doc_01.json", "doc_02.json", "doc_03.json", "metadata.json", "quiz_01.json", "quiz_02.json"])
      await expect(stat(path.join(exportResult.packDirectory, "learning-pack.zip"))).resolves.toBeDefined()
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

  it("throws when reference.enabled=true and both reference.path and reference.paths are empty", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-reference-pack",
          reference: { enabled: true, path: "", paths: [], mode: "source_only" },
        }),
      ),
    ).rejects.toThrow("reference.paths must not be empty when provided")
  })

  it("throws when reference file does not exist", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "missing-reference-pack",
          reference: { enabled: true, path: "references/__missing__.txt", mode: "source_only" },
        }),
        path.resolve(process.cwd(), "configs/_tmp.json"),
      ),
    ).rejects.toThrow("reference file does not exist")
  })

  it("throws when reference.paths is empty", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "empty-reference-paths-pack",
          reference: { enabled: true, paths: [], mode: "source_only" },
        }),
      ),
    ).rejects.toThrow("reference.paths must not be empty when provided")
  })

  it("throws when an unsupported reference format is configured", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "unsupported-reference-pack",
          reference: { enabled: true, paths: ["references/unsupported.docx"], mode: "source_only" },
        }),
      ),
    ).rejects.toThrow("Unsupported reference format")
  })

  it("loads the multiple-docs-quizzes example config", async () => {
    const config = await loadLearningPackConfig("configs/multiple-docs-quizzes.json")

    expect(config.id).toBe("multi-pack")
    expect(config.documentCount).toBe(3)
    expect(config.quizCount).toBe(2)
    expect(config.questionsPerQuiz).toBe(5)
  })

  it("loads the multiple-references example config", async () => {
    const config = await loadLearningPackConfig("configs/multiple-references.json")

    expect(config.id).toBe("multi-reference-pack")
    expect(config.reference.paths).toEqual([
      "references/customer-service-manual.txt",
      "references/faq.md",
      "references/policy.pdf",
    ])
  })

  it("rejects invalid targetUser", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-profile-user",
          targetUser: "invalid" as LearningPackConfig["targetUser"],
        }),
      ),
    ).rejects.toThrow("targetUser must be one of")
  })

  it("rejects invalid difficulty", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-profile-diff",
          difficulty: "extreme" as LearningPackConfig["difficulty"],
        }),
      ),
    ).rejects.toThrow("difficulty must be one of")
  })

  it("rejects invalid audioOptimization", async () => {
    await expect(
      validateLearningPackConfig(
        buildConfig({
          id: "bad-audio",
          audioOptimization: "yes" as unknown as boolean,
        }),
      ),
    ).rejects.toThrow("audioOptimization must be a boolean")
  })

  it("generates a beginner audio profile pack", async () => {
    const config = await loadLearningPackConfig("configs/beginner-audio.json")
    const pack = generateLearningPack(config)

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile).toEqual({
      targetUser: "beginner",
      difficulty: "easy",
      learningStyle: "audio",
      outputMode: "study",
      tone: "friendly",
      detailLevel: "short",
      exampleLevel: "few",
      audioOptimization: true,
      distractorSource: "fixed",
      quizStyle: "concept-check",
      explanationDepth: "standard",
      practicalExamples: false,
      sentenceLength: "medium",
    })
    expect(pack.documents).toHaveLength(1)
    expect(pack.quizzes).toHaveLength(1)
    // Beginner audio: question should use the friendly template
    expect(pack.quizzes[0].questions[0].question).toContain("customer service")
    // choiceTexts must exist and have 4 items without numbers
    for (const question of pack.quizzes[0].questions) {
      expect(question.tts.choiceTexts).toHaveLength(4)
      for (const choiceText of question.tts.choiceTexts) {
        expect(choiceText).not.toMatch(/(\d+\s*番|option\s*\d+|choice\s*\d+|no\.?\s*\d+)/i)
      }
    }
  })

  it("generates an employee training profile pack", async () => {
    const config = await loadLearningPackConfig("configs/employee-training.json")
    const pack = generateLearningPack(config)

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.targetUser).toBe("employee")
    expect(pack.metadata.profile.outputMode).toBe("training")
    expect(pack.metadata.profile.tone).toBe("professional")
    expect(pack.metadata.profile.exampleLevel).toBe("many")
  })

  it("generates an exam preparation profile pack", async () => {
    const config = await loadLearningPackConfig("configs/exam-preparation.json")
    const pack = generateLearningPack(config)

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.targetUser).toBe("student")
    expect(pack.metadata.profile.difficulty).toBe("hard")
    expect(pack.metadata.profile.outputMode).toBe("exam")
    expect(pack.metadata.profile.detailLevel).toBe("detailed")
    // Exam mode: questions should use numbered format
    expect(pack.quizzes[0].questions[0].question).toMatch(/Question \d+ of \d+/)
  })

  it("generates an academic reading profile pack", async () => {
    const config = await loadLearningPackConfig("configs/academic-reading.json")
    const pack = generateLearningPack(config)

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.targetUser).toBe("student")
    expect(pack.metadata.profile.learningStyle).toBe("reading")
    expect(pack.metadata.profile.tone).toBe("academic")
    expect(pack.metadata.profile.detailLevel).toBe("detailed")
    expect(pack.metadata.profile.exampleLevel).toBe("many")
  })

  it("applies default profile when no profile settings are provided", () => {
    const pack = generateLearningPack(buildConfig({ id: "default-profile-pack" }))

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile).toEqual({
      targetUser: "general",
      difficulty: "normal",
      learningStyle: "balanced",
      outputMode: "study",
      tone: "friendly",
      detailLevel: "normal",
      exampleLevel: "few",
      audioOptimization: false,
      distractorSource: "fixed",
      quizStyle: "concept-check",
      explanationDepth: "standard",
      practicalExamples: false,
      sentenceLength: "medium",
    })
  })

  it("detects choice numbers in choiceTexts as validation failure", () => {
    const pack = generateLearningPack(buildConfig({ id: "choice-number-check" }))
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].tts.choiceTexts = [
      "1番 Reliable",
      "2番 Responsible",
      "3番 Reasonable",
      "4番 Respectable",
    ] as unknown as [string, string, string, string]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("choiceTexts must not contain choice numbers"))).toBe(true)
  })

  // ----- v0.7 Generation Quality Controls -----

  it("uses theme-derived distractors when distractorSource is theme", () => {
    const pack = generateLearningPack(
      buildConfig({ id: "distractor-theme-pack", distractorSource: "theme" }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.distractorSource).toBe("theme")
    // The fixed customer-service distractors must NOT appear anymore.
    const fixedDistractors = ["Ignore customer context", "Skip confirmation steps", "Use unclear language"]
    for (const question of pack.quizzes[0].questions) {
      for (const fixed of fixedDistractors) {
        expect(question.choices).not.toContain(fixed)
      }
      // Theme-derived distractors reference the theme.
      expect(question.choices.slice(1).some((choice) => choice.toLowerCase().includes("customer service"))).toBe(true)
    }
  })

  it("uses reference-derived distractors when distractorSource is reference", () => {
    const referenceText = [
      "Smile and greet the customer clearly.",
      "Repeat the total amount and confirm before payment.",
      "Stay calm and listen to the customer.",
      "Apologize politely and offer the next step clearly.",
    ].join("\n")
    const referenceLines = splitNonEmptyLines(referenceText)
    const pack = generateLearningPack(
      buildConfig({
        id: "distractor-reference-pack",
        distractorSource: "reference",
        reference: { enabled: true, path: "references/customer-service-manual.txt", mode: "source_plus" },
      }),
      referenceText,
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.distractorSource).toBe("reference")
    // At least one distractor across the quiz must be drawn verbatim from the reference.
    const allDistractors = pack.quizzes[0].questions.flatMap((question) => question.choices.slice(1))
    expect(allDistractors.some((choice) => referenceLines.includes(choice))).toBe(true)
  })

  it("flavors the quiz stem with application style when quizStyle is application", () => {
    const pack = generateLearningPack(
      buildConfig({ id: "quiz-application-pack", quizStyle: "application" }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.quizStyle).toBe("application")
    for (const question of pack.quizzes[0].questions) {
      expect(question.question.toLowerCase()).toContain("apply")
    }
  })

  it("flavors the quiz stem with a case-study prompt when quizStyle is case-study", () => {
    const pack = generateLearningPack(
      buildConfig({ id: "quiz-case-study-pack", quizStyle: "case-study" }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.quizStyle).toBe("case-study")
    for (const question of pack.quizzes[0].questions) {
      expect(question.question.toLowerCase()).toContain("case study")
    }
  })

  it("writes a multi-sentence explanation when explanationDepth is detailed", () => {
    const pack = generateLearningPack(
      buildConfig({ id: "explanation-detailed-pack", explanationDepth: "detailed" }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.explanationDepth).toBe("detailed")
    for (const question of pack.quizzes[0].questions) {
      // Detailed explanations explain why the other options fail, so they are long.
      expect(question.explanation.split(/[.。]/).filter(Boolean).length).toBeGreaterThan(1)
    }
  })

  it("forbids placeholder examples and emits concrete ones when practicalExamples is true", () => {
    const pack = generateLearningPack(
      buildConfig({
        id: "practical-examples-pack",
        practicalExamples: true,
        exampleLevel: "many",
      }),
    )

    expect(pack.validation.passed).toBe(true)
    expect(pack.metadata.profile.practicalExamples).toBe(true)
    const documentTexts = pack.documents[0].documents.map((item) => item.text)
    // The forbidden placeholder line must not appear.
    expect(documentTexts.some((text) => text.includes("Apply customer service to a practical scenario."))).toBe(false)
    // A concrete example referencing the theme must appear instead.
    expect(documentTexts.some((text) => /Example \d+:/.test(text) && text.toLowerCase().includes("customer service"))).toBe(true)
  })

  it("shortens sentences when sentenceLength is short even without audio style", () => {
    const longPack = generateLearningPack(
      buildConfig({ id: "sentence-long-pack", sentenceLength: "long", audioOptimization: false, learningStyle: "reading" }),
    )
    const shortPack = generateLearningPack(
      buildConfig({ id: "sentence-short-pack", sentenceLength: "short", audioOptimization: false, learningStyle: "reading" }),
    )

    expect(shortPack.validation.passed).toBe(true)
    expect(shortPack.metadata.profile.sentenceLength).toBe("short")
    const longIntro = longPack.documents[0].documents[0].text
    const shortIntro = shortPack.documents[0].documents[0].text
    // Short mode clips the intro to the first clause, so it must be no longer than the long version.
    expect(shortIntro.length).toBeLessThanOrEqual(longIntro.length)
  })
})
