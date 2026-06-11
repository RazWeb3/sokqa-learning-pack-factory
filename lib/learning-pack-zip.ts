import JSZip from "jszip"

import { serializeLearningPackFiles, type LearningPack } from "./learning-pack"

export async function buildLearningPackZipBlob(pack: LearningPack) {
  const zip = new JSZip()

  for (const file of serializeLearningPackFiles(pack)) {
    zip.file(file.fileName, file.content)
  }

  return zip.generateAsync({ type: "blob" })
}

export async function buildLearningPackZipBytes(pack: LearningPack) {
  const zip = new JSZip()

  for (const file of serializeLearningPackFiles(pack)) {
    zip.file(file.fileName, file.content)
  }

  return zip.generateAsync({ type: "uint8array" })
}
