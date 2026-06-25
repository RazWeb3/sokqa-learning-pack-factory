import { readFile } from "node:fs/promises"
import path from "node:path"

import { generateLearningPack } from "../lib/learning-pack"
import { loadLearningPackConfig } from "../lib/learning-pack-config"
import { writeLearningPackOutput } from "../lib/learning-pack-zip"
import { loadReferenceContext, loadReferenceFile } from "../lib/reference-loader"

type CliOptions = {
  configFile?: string
  inputFile?: string
  text?: string
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {}
  const positional: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]

    switch (argument) {
      case "--":
        break
      case "--config":
        options.configFile = value
        index += 1
        break
      case "--input":
        options.inputFile = value
        index += 1
        break
      case "--text":
        options.text = value
        index += 1
        break
      default:
        if (argument.startsWith("-")) {
          throw new Error(`Unknown argument: ${argument}`)
        }
        positional.push(argument)
    }
  }

  if (!options.configFile && positional.length > 0 && positional[0].toLowerCase().endsWith(".json")) {
    options.configFile = positional[0]
    positional.splice(0, 1)
  }
  if (!options.configFile && !options.inputFile && !options.text && positional.length > 0) {
    const first = positional[0]
    if (first.toLowerCase().endsWith(".txt") || first.toLowerCase().endsWith(".md") || first.toLowerCase().endsWith(".pdf")) {
      options.inputFile = first
    } else {
      options.text = positional.join(" ")
    }
  }

  return options
}

async function loadTextFromFile(filePath: string) {
  return readFile(path.resolve(process.cwd(), filePath), "utf8")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.configFile) {
    const config = await loadLearningPackConfig(options.configFile)
    const referenceContext = await loadReferenceContext(config)
    const referenceText = referenceContext.text || undefined

    const pack = generateLearningPack(config, referenceText)
    if (!pack.validation.passed) {
      throw new Error(`Validation failed: ${pack.validation.errors.join("; ")}`)
    }

    const result = await writeLearningPackOutput(pack, config.outputDir, { theme: config.theme })
    console.log(`Generated: ${pack.metadata.title}`)
    console.log(`Pack ID: ${pack.metadata.id}`)
    console.log(`Output: ${result.packDirectory}`)
    console.log(`Files: ${result.files.join(", ")}`)
    return
  }

  const sourceText = options.inputFile
    ? await loadReferenceFile(options.inputFile)
    : options.text?.trim()
      ? options.text
      : await loadTextFromFile("examples/customer-service.txt")

  const stamp = Date.now()
  const adHocId = `pack-${stamp}`
  const pack = generateLearningPack(
    {
      id: adHocId,
      title: "Ad-hoc Learning Pack",
      description: "Generated learning pack",
      theme: "custom topic",
      language: "en",
      documentCount: 1,
      quizCount: 1,
      questionsPerQuiz: 5,
      outputDir: `output/${adHocId}`,
      reference: { enabled: true, path: "CLI", mode: "source_plus" },
    },
    sourceText,
  )

  if (!pack.validation.passed) {
    throw new Error(`Validation failed: ${pack.validation.errors.join("; ")}`)
  }

  const result = await writeLearningPackOutput(pack, `output/${pack.metadata.id}`, { theme: "custom topic" })

  console.log(`Generated: ${pack.metadata.title}`)
  console.log(`Pack ID: ${pack.metadata.id}`)
  console.log(`Output: ${result.packDirectory}`)
  console.log(`Files: ${result.files.join(", ")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
