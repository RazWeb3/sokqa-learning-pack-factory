import { readFile } from "node:fs/promises"
import { PDFParse } from "pdf-parse"

import { normalizeReferencePaths, resolveFrom, type LearningPackConfig } from "./learning-pack-config"

export async function loadReferenceFile(referencePath: string, baseDir = process.cwd()) {
  const resolvedPath = resolveFrom(baseDir, referencePath)
  const extension = referencePath.toLowerCase().split(".").pop()

  if (extension === "txt" || extension === "md") {
    return (await readFile(resolvedPath, "utf8")).trim()
  }
  if (extension === "pdf") {
    const pdfBuffer = await readFile(resolvedPath)
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })

    try {
      const result = await parser.getText()
      return result.text.trim()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to read PDF reference: ${referencePath} (${message})`)
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  }

  throw new Error(`Unsupported reference format: ${referencePath}`)
}

export async function loadReferenceContext(config: LearningPackConfig, baseDir = process.cwd()) {
  const referencePaths = normalizeReferencePaths(config.reference)
  if (!config.reference.enabled || referencePaths.length === 0) {
    return {
      text: "",
      paths: [],
      fileNames: [],
    }
  }

  const segments: string[] = []
  for (const referencePath of referencePaths) {
    const text = (await loadReferenceFile(referencePath, baseDir)).trim()
    if (text) {
      segments.push(text)
    }
  }

  return {
    text: segments.join("\n\n"),
    paths: referencePaths,
    fileNames: referencePaths.map((referencePath) => referencePath.replace(/^.*[\\/]/, "")),
  }
}
