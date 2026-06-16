import JSZip from "jszip"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { serializeLearningPackFiles, type LearningPack } from "./learning-pack"

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

export async function writeLearningPackOutput(pack: LearningPack, outputDir: string) {
  const packDirectory = path.resolve(process.cwd(), outputDir)
  await mkdir(packDirectory, { recursive: true })

  for (const file of serializeLearningPackFiles(pack)) {
    await writeFile(path.join(packDirectory, file.fileName), file.content, "utf8")
  }

  const zipBytes = await buildLearningPackZipBytes(pack)
  await writeFile(path.join(packDirectory, "learning-pack.zip"), zipBytes)

  return {
    packDirectory,
    files: ["metadata.json", ...pack.metadata.documents, ...pack.metadata.quizzes, "learning-pack.zip"],
  }
}
