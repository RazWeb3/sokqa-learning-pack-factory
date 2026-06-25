import JSZip from "jszip"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { serializeLearningPackFiles, type LearningPack } from "./learning-pack"
import { checkDistractorQuality, checkDocumentSimilarity, checkExplanationQuality, checkQuestionSimilarity } from "./quality-check"

export type QualityReport = {
  score: number
  duplicateQuestionRate: number
  duplicateDocumentRate: number
  genericDistractors: number
  genericExplanations: number
  warnings: string[]
}

const QUALITY_SCORE_WEIGHTS = {
  duplicateQuestionRate: 1,
  duplicateDocumentRate: 1,
  genericDistractors: 5,
  genericExplanations: 5,
} as const

function buildZip(pack: LearningPack) {
  const zip = new JSZip()

  for (const file of serializeLearningPackFiles(pack)) {
    zip.file(file.fileName, file.content)
  }

  return zip
}

export async function buildLearningPackZipBytes(pack: LearningPack) {
  return buildZip(pack).generateAsync({ type: "uint8array" })
}

function clampQualityScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function buildQualityReport(pack: LearningPack, options?: { theme?: string }): QualityReport {
  const theme = options?.theme ?? ""
  const questions = pack.quizzes.flatMap((quiz) => quiz.questions)

  const questionDup = checkQuestionSimilarity(questions)
  const documentDup = checkDocumentSimilarity(pack.documents)
  const distractors = checkDistractorQuality(questions)
  const explanations = checkExplanationQuality(questions, theme)

  const score = clampQualityScore(
    100 -
      questionDup.duplicateRate * QUALITY_SCORE_WEIGHTS.duplicateQuestionRate -
      documentDup.duplicateRate * QUALITY_SCORE_WEIGHTS.duplicateDocumentRate -
      distractors.genericDistractors * QUALITY_SCORE_WEIGHTS.genericDistractors -
      explanations.genericExplanations * QUALITY_SCORE_WEIGHTS.genericExplanations,
  )

  return {
    score,
    duplicateQuestionRate: questionDup.duplicateRate,
    duplicateDocumentRate: documentDup.duplicateRate,
    genericDistractors: distractors.genericDistractors,
    genericExplanations: explanations.genericExplanations,
    warnings: [...questionDup.warnings, ...documentDup.warnings, ...distractors.warnings, ...explanations.warnings],
  }
}

export async function writeLearningPackOutput(pack: LearningPack, outputDir: string, options?: { theme?: string }) {
  const packDirectory = path.resolve(process.cwd(), outputDir)
  await mkdir(packDirectory, { recursive: true })

  for (const file of serializeLearningPackFiles(pack)) {
    await writeFile(path.join(packDirectory, file.fileName), file.content, "utf8")
  }

  const zipBytes = await buildLearningPackZipBytes(pack)
  await writeFile(path.join(packDirectory, "learning-pack.zip"), zipBytes)

  const qualityReport = buildQualityReport(pack, options)
  await writeFile(path.join(packDirectory, "quality-report.json"), JSON.stringify(qualityReport, null, 2), "utf8")

  return {
    packDirectory,
    files: ["metadata.json", "quality-report.json", ...pack.metadata.documents, ...pack.metadata.quizzes, "learning-pack.zip"],
  }
}
