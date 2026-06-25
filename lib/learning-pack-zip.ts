import JSZip from "jszip"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { serializeLearningPackFiles, type LearningPack } from "./learning-pack"
import { checkDistractorQuality, checkDocumentSimilarity, checkExplanationQuality, checkQuestionSimilarity } from "./quality-check"

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

export async function writeLearningPackOutput(pack: LearningPack, outputDir: string, options?: { theme?: string }) {
  const packDirectory = path.resolve(process.cwd(), outputDir)
  await mkdir(packDirectory, { recursive: true })

  for (const file of serializeLearningPackFiles(pack)) {
    await writeFile(path.join(packDirectory, file.fileName), file.content, "utf8")
  }

  const zipBytes = await buildLearningPackZipBytes(pack)
  await writeFile(path.join(packDirectory, "learning-pack.zip"), zipBytes)

  const theme = options?.theme ?? ""
  const questions = pack.quizzes.flatMap((quiz) => quiz.questions)

  const questionDup = checkQuestionSimilarity(questions)
  const documentDup = checkDocumentSimilarity(pack.documents)
  const distractors = checkDistractorQuality(questions)
  const explanations = checkExplanationQuality(questions, theme)

  const qualityReport = {
    duplicateQuestionRate: questionDup.duplicateRate,
    duplicateDocumentRate: documentDup.duplicateRate,
    genericDistractors: distractors.genericDistractors,
    genericExplanations: explanations.genericExplanations,
    warnings: [...questionDup.warnings, ...documentDup.warnings, ...distractors.warnings, ...explanations.warnings],
  }
  await writeFile(path.join(packDirectory, "quality-report.json"), JSON.stringify(qualityReport, null, 2), "utf8")

  return {
    packDirectory,
    files: ["metadata.json", ...pack.metadata.documents, ...pack.metadata.quizzes, "learning-pack.zip", "quality-report.json"],
  }
}
