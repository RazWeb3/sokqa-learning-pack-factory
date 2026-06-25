import type { DocumentFile, QuizFile } from "./learning-pack"

type QuizQuestion = QuizFile["questions"][number]

export type SimilarityCheckResult = {
  duplicateRate: number
  warnings: string[]
}

export type DistractorQualityResult = {
  genericDistractors: number
  warnings: string[]
}

export type ExplanationQualityResult = {
  genericExplanations: number
  warnings: string[]
}

function normalizeForSimilarity(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildCharNgrams(text: string, n = 3) {
  const compact = normalizeForSimilarity(text).replace(/\s+/g, "")
  if (!compact) return new Set<string>()
  if (compact.length < n) return new Set([compact])

  const grams = new Set<string>()
  for (let index = 0; index <= compact.length - n; index += 1) {
    grams.add(compact.slice(index, index + n))
  }
  return grams
}

function diceSimilarity(a: string, b: string) {
  const aSet = buildCharNgrams(a)
  const bSet = buildCharNgrams(b)
  if (aSet.size === 0 && bSet.size === 0) return 1
  if (aSet.size === 0 || bSet.size === 0) return 0

  let intersection = 0
  for (const gram of aSet) {
    if (bSet.has(gram)) intersection += 1
  }
  return (2 * intersection) / (aSet.size + bSet.size)
}

function percent(value: number) {
  return Math.round(value * 100)
}

function questionId(question: QuizQuestion, fallbackIndex: number) {
  return question.id || `q-${fallbackIndex + 1}`
}

function normalizeChoice(choice: string) {
  return normalizeForSimilarity(choice)
}

function choicePatternKey(choices: readonly string[]) {
  return choices.map(normalizeChoice).slice().sort().join("|")
}

function extractDocumentText(document: DocumentFile) {
  return document.documents.map((item) => item.text).join("\n\n")
}

function extractSectionStructure(text: string) {
  const lines = text.split(/\r?\n/g).map((line) => line.trim())
  const headers: string[] = []

  for (const line of lines) {
    if (!line) continue
    const mdHeading = line.match(/^#{1,6}\s+(.+)$/)
    if (mdHeading) {
      headers.push(normalizeForSimilarity(mdHeading[1]))
      continue
    }
    const colon = line.match(/^(.{1,60}?)[：:]\s+/)
    if (colon) {
      headers.push(normalizeForSimilarity(colon[1]))
    }
  }

  return headers
}

function hasSameSectionStructure(aText: string, bText: string) {
  const a = extractSectionStructure(aText)
  const b = extractSectionStructure(bText)
  if (a.length === 0 || b.length === 0) return false
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export function checkQuestionSimilarity(questions: QuizQuestion[]): SimilarityCheckResult {
  const warnings: string[] = []
  if (questions.length < 2) return { duplicateRate: 0, warnings }

  const duplicateIndexes = new Set<number>()
  const choiceKeys = questions.map((q) => choicePatternKey(q.choices))

  for (let i = 0; i < questions.length; i += 1) {
    for (let j = i + 1; j < questions.length; j += 1) {
      const qSim = diceSimilarity(questions[i].question, questions[j].question)
      const eSim = diceSimilarity(questions[i].explanation, questions[j].explanation)
      const sameChoices = choiceKeys[i] === choiceKeys[j]

      if (qSim >= 0.8 || eSim >= 0.8 || sameChoices) {
        duplicateIndexes.add(i)
        duplicateIndexes.add(j)
        warnings.push(
          `duplicate-question: ${questionId(questions[i], i)} ~ ${questionId(questions[j], j)} (question=${percent(qSim)}%, explanation=${percent(eSim)}%, choices=${sameChoices})`,
        )
      }
    }
  }

  return { duplicateRate: Math.round((duplicateIndexes.size / questions.length) * 100), warnings }
}

export function checkDocumentSimilarity(documents: DocumentFile[]): SimilarityCheckResult {
  const warnings: string[] = []
  if (documents.length < 2) return { duplicateRate: 0, warnings }

  const duplicateIndexes = new Set<number>()
  const texts = documents.map((doc) => extractDocumentText(doc))
  const titles = documents.map((doc) => normalizeForSimilarity(doc.title))

  for (let i = 0; i < documents.length; i += 1) {
    for (let j = i + 1; j < documents.length; j += 1) {
      const textSim = diceSimilarity(texts[i], texts[j])
      const titleOnlyDifferent = titles[i] !== titles[j] && textSim >= 0.95
      const sameStructure = hasSameSectionStructure(texts[i], texts[j])

      if (textSim >= 0.8 || titleOnlyDifferent || sameStructure) {
        duplicateIndexes.add(i)
        duplicateIndexes.add(j)
        warnings.push(
          `duplicate-document: ${documents[i].id} ~ ${documents[j].id} (text=${percent(textSim)}%, titleOnlyDifferent=${titleOnlyDifferent}, sameStructure=${sameStructure})`,
        )
      }
    }
  }

  return { duplicateRate: Math.round((duplicateIndexes.size / documents.length) * 100), warnings }
}

const GENERIC_DISTRACTOR_PATTERNS = ["skip the basics", "apply without checking", "use unclear wording"]

export function checkDistractorQuality(questions: QuizQuestion[]): DistractorQualityResult {
  const warnings: string[] = []
  let genericQuestionCount = 0

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index]
    const distractors = question.choices.filter((_, choiceIndex) => choiceIndex !== question.answerIndex)
    const matches = distractors.filter((choice) => {
      const normalized = normalizeForSimilarity(choice)
      return GENERIC_DISTRACTOR_PATTERNS.some((pattern) => normalized.includes(pattern))
    })
    if (matches.length === 0) continue

    genericQuestionCount += 1
    for (const matched of matches) {
      warnings.push(`generic-distractor: ${questionId(question, index)} "${matched}"`)
    }
  }

  return { genericDistractors: genericQuestionCount, warnings }
}

const GENERIC_EXPLANATION_WORDS = new Set(["best", "matches", "bestmatches", "reason", "why"])

function extractThemeKeywords(theme: string) {
  const normalized = theme.normalize("NFKC").trim()
  if (!normalized) return []

  const spaceParts = normalized.split(/\s+/g).filter(Boolean)
  if (spaceParts.length >= 2) return spaceParts

  const jpParts = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]{2,}/gu)
  if (jpParts && jpParts.length > 0) return Array.from(new Set(jpParts))

  return [normalized]
}

function containsAnyKeyword(text: string, keywords: string[]) {
  const normalizedText = text.normalize("NFKC").toLowerCase()
  return keywords.some((keyword) => normalizedText.includes(keyword.normalize("NFKC").toLowerCase()))
}

function isTemplateOnlyExplanation(explanation: string, themeKeywords: string[]) {
  const base = normalizeForSimilarity(explanation)
  if (!base) return true

  let stripped = base
  for (const keyword of themeKeywords) {
    const k = normalizeForSimilarity(keyword)
    if (!k) continue
    stripped = stripped.split(k).join(" ")
  }
  stripped = stripped.replace(/\s+/g, " ").trim()
  if (!stripped) return true

  const tokens = stripped.split(/\s+/g).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every((token) => GENERIC_EXPLANATION_WORDS.has(token))
}

export function checkExplanationQuality(questions: QuizQuestion[], theme: string): ExplanationQualityResult {
  const warnings: string[] = []
  let genericCount = 0

  const themeKeywords = extractThemeKeywords(theme)

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index]
    const explanation = question.explanation || ""

    const hasTheme = themeKeywords.length === 0 ? false : containsAnyKeyword(explanation, themeKeywords)
    const templateOnly = isTemplateOnlyExplanation(explanation, themeKeywords)

    if (templateOnly || !hasTheme) {
      genericCount += 1
      warnings.push(
        `generic-explanation: ${questionId(question, index)} (templateOnly=${templateOnly}, hasThemeKeyword=${hasTheme})`,
      )
    }
  }

  return { genericExplanations: genericCount, warnings }
}
