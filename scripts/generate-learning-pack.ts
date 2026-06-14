import { readFile } from "node:fs/promises"
import path from "node:path"

import { generateLearningPack } from "../lib/learning-pack"
import { writeLearningPackOutput } from "../lib/learning-pack-zip"

type CliOptions = {
  inputFile?: string
  text?: string
  packId?: string
  title?: string
  outputRoot: string
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputRoot: path.resolve(process.cwd(), "output"),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]

    switch (argument) {
      case "--input":
        options.inputFile = value
        index += 1
        break
      case "--text":
        options.text = value
        index += 1
        break
      case "--id":
        options.packId = value
        index += 1
        break
      case "--title":
        options.title = value
        index += 1
        break
      case "--output":
        options.outputRoot = path.resolve(process.cwd(), value)
        index += 1
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  return options
}

async function loadSourceText(options: CliOptions) {
  if (options.text?.trim()) {
    return options.text
  }

  if (options.inputFile) {
    return readFile(path.resolve(process.cwd(), options.inputFile), "utf8")
  }

  throw new Error("Provide either --input <file> or --text <content>")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const text = await loadSourceText(options)
  const pack = generateLearningPack({
    text,
    packId: options.packId,
    title: options.title,
  })

  if (!pack.validation.passed) {
    throw new Error(`Validation failed: ${pack.validation.errors.join("; ")}`)
  }

  const result = await writeLearningPackOutput(pack, options.outputRoot)

  console.log(`Generated: ${pack.metadata.title}`)
  console.log(`Pack ID: ${pack.metadata.id}`)
  console.log(`Output: ${result.packDirectory}`)
  console.log(`Files: ${result.files.join(", ")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
