import JSZip from "jszip"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { generateLearningPack, validateLearningPack } from "./learning-pack"
import { buildLearningPackZipBytes, writeLearningPackOutput } from "./learning-pack-zip"

const sampleText = `【例】コンビニ接客の基本
- お客様に明るくあいさつする
- いらっしゃいませ、ありがとうございます、少々お待ちください、申し訳ございません を丁寧に使う
- レジで金額を復唱し、確認してから会計する
- 困ったら先輩にすぐ相談する
`

describe("learning pack", () => {
  it("runs smoke flow from generate to validate to zip", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "sokqa-pack-"))
    const pack = generateLearningPack({
      text: sampleText,
      packId: "customer-service-pack",
      title: "Customer Service Training",
    })

    try {
      expect(pack.documents).toHaveLength(1)
      expect(pack.quizzes).toHaveLength(1)
      expect(pack.validation.passed).toBe(true)

      const exportResult = await writeLearningPackOutput(pack, outputRoot)
      const zipBytes = await buildLearningPackZipBytes(pack)
      const zip = await JSZip.loadAsync(zipBytes)

      expect(Object.keys(zip.files).sort()).toEqual(["doc_01.json", "metadata.json", "quiz_01.json"])
      await expect(stat(path.join(exportResult.packDirectory, "learning-pack.zip"))).resolves.toBeDefined()
      await expect(readFile(path.join(exportResult.packDirectory, "metadata.json"), "utf8")).resolves.toContain(
        '"id": "customer-service-pack"',
      )
    } finally {
      await rm(outputRoot, { recursive: true, force: true })
    }
  })

  it("fails when quiz choices are not length 4", () => {
    const pack = generateLearningPack({ text: sampleText })
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].choices = ["A", "B", "C"] as unknown as [string, string, string, string]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("quiz choices must contain exactly 4 items"))).toBe(true)
  })

  it("fails when answerIndex is out of range", () => {
    const pack = generateLearningPack({ text: sampleText })
    const invalidPack = structuredClone(pack)

    invalidPack.quizzes[0].questions[0].answerIndex = 4 as 0

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("quiz answerIndex must be between 0 and 3"))).toBe(true)
  })

  it("fails when metadata file references do not match generated files", () => {
    const pack = generateLearningPack({ text: sampleText })
    const invalidPack = structuredClone(pack)

    invalidPack.metadata.documents = ["doc_99.json"]

    const validation = validateLearningPack(invalidPack)

    expect(validation.passed).toBe(false)
    expect(validation.errors.some((error) => error.includes("metadata.documents does not match generated files"))).toBe(true)
  })
})
