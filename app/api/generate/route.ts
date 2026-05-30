import { nanoid } from "nanoid"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

export const runtime = "nodejs"

const DEFAULT_BASE_URL = "https://pe-gules.vercel.app"

type AnalyzerResult = {
  training_topic: string
  target_role: string
  key_points: string[]
  service_phrases: string[]
  important_rules: string[]
  common_mistakes: string[]
}

type DocumentFile = {
  id: string
  type: "document"
  schemaVersion: 1
  title: string
  description: string
  language: "en"
  globalTags: string[]
  documents: Array<{ id: string; text: string; tts: { text: string } }>
}

type QuizFile = {
  id: string
  type: "quiz"
  schemaVersion: 1
  title: string
  description: string
  language: "en"
  globalTags: string[]
  questions: Array<{
    id: string
    question: string
    choices: [string, string, string, string]
    answerIndex: 0 | 1 | 2 | 3
    explanation: string
    tts: {
      questionText: string
      choicesText: string
      answerText: string
      explanationText: string
    }
  }>
}

type ManifestFile = {
  id: string
  type: "pack_manifest"
  schemaVersion: 1
  title: string
  globalTags: string[]
  description: string
  language: "en"
  author: "Sokqa Team"
  items: Array<{ kind: "document" | "quiz"; url: string }>
}

function ensureEndsWithComma(text: string) {
  const trimmed = text.trim()
  return trimmed.endsWith(",") ? trimmed : `${trimmed},`
}

function toJaTts(text: string) {
  const t = text.trim().replace(/[、,]+$/g, "")
  return `[ja-JP]${t}、`
}

function toEnTts(text: string) {
  const t = text.trim().replace(/[,]+$/g, "")
  return `[en-US]${t},`
}

function choicesTts(choices: [string, string, string, string]) {
  return ensureEndsWithComma(
    `[en-US]Number 1, ${choices[0]}, Number 2, ${choices[1]}, Number 3, ${choices[2]}, Number 4, ${choices[3]},`,
  )
}

function answerTts(answerNumber1to4: 1 | 2 | 3 | 4, choiceText: string) {
  return ensureEndsWithComma(`[en-US]The correct answer is Number ${answerNumber1to4}, ${choiceText},`)
}

function extractServicePhrases(text: string): string[] {
  const candidates = new Set<string>()
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (/[ぁ-んァ-ン一-龯]/.test(line) && line.length <= 24) candidates.add(line)
  }

  const defaults = [
    "お疲れ様です",
    "いらっしゃいませ",
    "ありがとうございます",
    "少々お待ちください",
    "申し訳ございません",
  ]

  const merged = [...candidates]
    .map((s) => s.replace(/[。．.！!？?]+$/g, ""))
    .filter((s) => s.length >= 2 && s.length <= 24)

  for (const d of defaults) {
    if (merged.length >= 5) break
    if (!merged.includes(d)) merged.push(d)
  }

  return merged.slice(0, 5)
}

function analyzeManualText(text: string): AnalyzerResult {
  const service_phrases = extractServicePhrases(text)

  return {
    training_topic: "Customer Service Basics",
    target_role: "Frontline staff (beginner)",
    key_points: [
      "Use polite greetings and polite requests",
      "Repeat and confirm key information",
      "Ask for help early when you are not sure",
    ],
    service_phrases,
    important_rules: ["Be polite", "Be clear", "Stay calm"],
    common_mistakes: ["Too casual speech", "Not confirming numbers", "Not asking for help"],
  }
}

function buildDocumentFile(packId: string, analyzer: AnalyzerResult): DocumentFile {
  const primaryPhrase = analyzer.service_phrases[0] ?? "お疲れ様です"

  const title = `Workplace Listening Pack: Polite Phrase Practice`
  const description =
    "A listening-first mini pack to practice a polite workplace phrase. Short explanations, phrase practice, a mini conversation, and a review."

  const documents: DocumentFile["documents"] = [
    {
      id: "doc-1",
      text: "Welcome. In this document, you will practice a polite workplace phrase. Listen first.",
      tts: { text: ensureEndsWithComma("Welcome, In this document, you will practice a polite workplace phrase, Listen first,") },
    },
    {
      id: "doc-2",
      text: "Polite phrases help you sound professional. They also build trust with coworkers and customers.",
      tts: {
        text: ensureEndsWithComma(
          "Polite phrases help you sound professional, They also build trust with coworkers and customers,",
        ),
      },
    },
    {
      id: "doc-3",
      text: `Today's phrase is ${primaryPhrase}. You will hear it often at work.`,
      tts: {
        text: ensureEndsWithComma(`Today's phrase is${toJaTts(primaryPhrase)}${toEnTts("You will hear it often at work")}`),
      },
    },
    {
      id: "doc-4",
      text: `${primaryPhrase}. This is a polite phrase used at work. It can mean a friendly hello at work.`,
      tts: {
        text: ensureEndsWithComma(`${toJaTts(primaryPhrase)}${toEnTts("This is a polite phrase used at work, It can mean a friendly hello at work")}`),
      },
    },
    {
      id: "doc-5",
      text: "Phrase practice. Listen and repeat. Say it slowly, then say it naturally.",
      tts: { text: ensureEndsWithComma("Phrase practice, Listen and repeat, Say it slowly, then say it naturally,") },
    },
    {
      id: "doc-6",
      text: `${primaryPhrase}. ${primaryPhrase}.`,
      tts: { text: ensureEndsWithComma(`${toJaTts(primaryPhrase)}${toJaTts(primaryPhrase)}`) },
    },
    {
      id: "doc-7",
      text: "Mini conversation. Morning at work. You see your coworker and greet them.",
      tts: { text: ensureEndsWithComma("Mini conversation, Morning at work, You see your coworker and greet them,") },
    },
    {
      id: "doc-8",
      text: `Coworker: ${primaryPhrase}. You: ${primaryPhrase}.`,
      tts: {
        text: ensureEndsWithComma(`Coworker,${toJaTts(primaryPhrase)}${toEnTts("You")}${toJaTts(primaryPhrase)}`),
      },
    },
    {
      id: "doc-9",
      text: "Review. What does the phrase signal? Politeness, respect, and teamwork. Listen again.",
      tts: { text: ensureEndsWithComma("Review, What does the phrase signal, Politeness, respect, and teamwork, Listen again,") },
    },
    {
      id: "doc-10",
      text: `${primaryPhrase}. Great work. You can use this phrase today.`,
      tts: { text: ensureEndsWithComma(`${toJaTts(primaryPhrase)}${toEnTts("Great work, You can use this phrase today")}`) },
    },
  ]

  return {
    id: `pack_${packId}_doc_01`,
    type: "document",
    schemaVersion: 1,
    title,
    description,
    language: "en",
    globalTags: ["workplace", "beginner", "listening"],
    documents,
  }
}

function buildQuizFile(packId: string, analyzer: AnalyzerResult): QuizFile {
  const phrases = analyzer.service_phrases.length ? analyzer.service_phrases : ["お疲れ様です"]

  const questions: QuizFile["questions"] = Array.from({ length: 5 }).map((_, idx) => {
    const jp = phrases[idx % phrases.length]
    const qid = `q-${idx + 1}`
    const question = `What does ${jp} mean in a workplace context?`
    const choices: [string, string, string, string] = [
      "Thank you",
      "Excuse me / Sorry",
      "A polite workplace greeting",
      "Good night",
    ]
    const answerIndex: 0 | 1 | 2 | 3 = 2
    const explanation =
      "In many workplaces, this phrase works as a polite greeting. It shows respect and teamwork. The best answer here is the workplace greeting choice."

    return {
      id: qid,
      question,
      choices,
      answerIndex,
      explanation,
      tts: {
        questionText: ensureEndsWithComma(`[en-US]What does${toJaTts(jp)}${toEnTts("mean in a workplace context")}`),
        choicesText: choicesTts(choices),
        answerText: answerTts(3, choices[answerIndex]),
        explanationText: ensureEndsWithComma(
          "[en-US]In many workplaces, this phrase works as a polite greeting, It shows respect and teamwork, The best answer here is the workplace greeting choice,",
        ),
      },
    }
  })

  return {
    id: `pack_${packId}_quiz_01`,
    type: "quiz",
    schemaVersion: 1,
    title: "Workplace Listening Quiz: Meaning Check",
    description: "A 5-question quiz to check your understanding of polite workplace phrases.",
    language: "en",
    globalTags: ["workplace", "beginner", "meaning-check"],
    questions,
  }
}

function buildManifestFileWithUrls(packId: string, title: string, docUrl: string, quizUrl: string): ManifestFile {
  return {
    id: `pack_${packId}_manifest`,
    type: "pack_manifest",
    schemaVersion: 1,
    title,
    globalTags: ["workplace", "beginner", "static-import"],
    description: "A SokQA manifest to import documents and a quiz as one pack.",
    language: "en",
    author: "Sokqa Team",
    items: [
      { kind: "document", url: docUrl },
      { kind: "quiz", url: quizUrl },
    ],
  }
}

function validateDocument(doc: DocumentFile) {
  if (doc.type !== "document") throw new Error("document.type must be 'document'")
  if (doc.schemaVersion !== 1) throw new Error("document.schemaVersion must be 1")
  if (doc.language !== "en") throw new Error("document.language must be 'en'")
  if (!Array.isArray(doc.documents) || doc.documents.length < 1) throw new Error("document.documents missing")
  for (const item of doc.documents) {
    if (!/^doc-\d+$/.test(item.id)) throw new Error(`document item id invalid: ${item.id}`)
    if (!item.tts?.text || !item.tts.text.trim().endsWith(",")) throw new Error(`document tts.text must end with ',' (${item.id})`)
  }
}

function validateQuiz(quiz: QuizFile) {
  if (quiz.type !== "quiz") throw new Error("quiz.type must be 'quiz'")
  if (quiz.schemaVersion !== 1) throw new Error("quiz.schemaVersion must be 1")
  if (quiz.language !== "en") throw new Error("quiz.language must be 'en'")
  if (!Array.isArray(quiz.questions) || quiz.questions.length !== 5) throw new Error("quiz.questions must be exactly 5")
  for (const q of quiz.questions) {
    if (!/^q-\d+$/.test(q.id)) throw new Error(`quiz question id invalid: ${q.id}`)
    if (!Array.isArray(q.choices) || q.choices.length !== 4) throw new Error(`quiz choices must be exactly 4 (${q.id})`)
    if (![0, 1, 2, 3].includes(q.answerIndex)) throw new Error(`quiz answerIndex out of range (${q.id})`)
    const ttsValues = [q.tts.questionText, q.tts.choicesText, q.tts.answerText, q.tts.explanationText]
    for (const v of ttsValues) {
      if (!v || !v.trim().endsWith(",")) throw new Error(`quiz tts must end with ',' (${q.id})`)
    }
  }
}

function validateManifest(manifest: ManifestFile) {
  if (manifest.type !== "pack_manifest") throw new Error("manifest.type must be 'pack_manifest'")
  if (manifest.schemaVersion !== 1) throw new Error("manifest.schemaVersion must be 1")
  if (manifest.author !== "Sokqa Team") throw new Error("manifest.author must be 'Sokqa Team'")
  if (!Array.isArray(manifest.items) || manifest.items.length < 1) throw new Error("manifest.items missing")
  for (const item of manifest.items) {
    if (item.kind !== "document" && item.kind !== "quiz") throw new Error("manifest item kind invalid")
    if (!/^https?:\/\//.test(item.url)) throw new Error("manifest item url must start with http:// or https://")
    if (/[` \t\r\n]/.test(item.url)) throw new Error("manifest item url must not contain backticks or spaces")
  }
}

async function runVercelProdDeploy(): Promise<{ ok: boolean; message: string }> {
  const token = process.env.VERCEL_TOKEN?.trim()
  const args = ["vercel", "--prod", "--yes"]
  if (token) args.push("--token", token)

  return await new Promise((resolve) => {
    const child = spawn("npx", args, { shell: false })

    let out = ""
    let err = ""
    child.stdout.on("data", (d) => {
      out += String(d)
    })
    child.stderr.on("data", (d) => {
      err += String(d)
    })
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true, message: "vercel --prod completed" })
      else resolve({ ok: false, message: (err || out || `vercel exited with code ${code}`).slice(0, 400) })
    })
  })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === "string" ? body.text : ""
  if (!text.trim()) return Response.json({ ok: false, error: "text is required" }, { status: 400 })

  const isVercel = (process.env.VERCEL ?? "").trim() === "1"
  if (isVercel) {
    return Response.json(
      {
        ok: false,
        error:
          "This endpoint writes files to public/ and is intended for local generation. Run locally, then deploy with vercel --prod.",
      },
      { status: 400 },
    )
  }

  const packId = nanoid(8)
  const analyzer = analyzeManualText(text)
  const doc01 = buildDocumentFile(packId, analyzer)
  const quiz01 = buildQuizFile(packId, analyzer)

  validateDocument(doc01)
  validateQuiz(quiz01)

  const title = `Workplace Pack (${packId})`

  const baseUrlRaw = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? req.headers.get("origin") ?? ""
  const baseUrlFallback =
    (req.headers.get("host") ? `http://${req.headers.get("host")}` : "") || DEFAULT_BASE_URL
  const baseUrl = (typeof baseUrlRaw === "string" ? baseUrlRaw.trim() : "") || baseUrlFallback

  if (!/^https?:\/\//.test(baseUrl)) {
    return Response.json(
      { ok: false, error: "BASE_URL (or NEXT_PUBLIC_BASE_URL) must be a full http(s):// domain" },
      { status: 500 },
    )
  }

  const rootUrl = `${baseUrl.replace(/\/+$/g, "")}/generated-pack/${packId}`
  const manifest = buildManifestFileWithUrls(packId, title, `${rootUrl}/doc_01.json`, `${rootUrl}/quiz_01.json`)
  validateManifest(manifest)

  const outDir = path.join(process.cwd(), "public", "generated-pack", packId)
  await mkdir(outDir, { recursive: true })

  await writeFile(path.join(outDir, "doc_01.json"), JSON.stringify(doc01, null, 2), "utf8")
  await writeFile(path.join(outDir, "quiz_01.json"), JSON.stringify(quiz01, null, 2), "utf8")
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

  const manifestUrl = `${baseUrl.replace(/\/+$/g, "")}/generated-pack/${packId}/manifest.json`

  const shouldDeploy = (process.env.AUTO_DEPLOY ?? "").trim() === "1"
  const deployResult = shouldDeploy ? await runVercelProdDeploy() : { ok: true, message: "skipped" }

  return Response.json({
    ok: true,
    packId,
    manifestUrl,
    deploy: { attempted: shouldDeploy, ok: deployResult.ok, message: deployResult.message },
  })
}
