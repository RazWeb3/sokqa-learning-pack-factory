import { describe, expect, it } from "vitest"

import type { DocumentFile, QuizFile } from "./learning-pack"
import { checkDistractorQuality, checkDocumentSimilarity, checkExplanationQuality, checkQuestionSimilarity } from "./quality-check"

function q(overrides: Partial<QuizFile["questions"][number]> = {}): QuizFile["questions"][number] {
  return {
    id: "q-1",
    question: "What is TCP used for?",
    choices: ["Reliable transport", "Rendering UI", "Storing passwords", "Printing logs"],
    answerIndex: 0,
    explanation: "TCP provides reliable, ordered delivery of data between hosts.",
    tts: {
      questionText: "What is TCP used for?",
      choiceTexts: ["Reliable transport", "Rendering UI", "Storing passwords", "Printing logs"],
      answerText: "Reliable transport",
      explanationText: "TCP provides reliable, ordered delivery of data between hosts.",
    },
    ...overrides,
  }
}

function doc(overrides: Partial<DocumentFile> = {}): DocumentFile {
  return {
    id: "doc-1",
    type: "document",
    schemaVersion: 1,
    title: "Doc 1",
    description: "",
    language: "en",
    globalTags: [],
    documents: [{ id: "doc-1-1", text: "Theme: Networking\nGoal: Basics\nKey Points: TCP vs UDP", tts: { text: "Theme: Networking" } }],
    ...overrides,
  }
}

describe("quality-check", () => {
  it("detects duplicate questions by question similarity, explanation similarity, or identical choice pattern", () => {
    const a = q({ id: "q-1", question: "Select the best option about networking basics.", explanation: "Reason: Best matches networking." })
    const b = q({ id: "q-2", question: "Select the best option about networking basics.", explanation: "Reason: Best matches networking." })
    const c = q({
      id: "q-3",
      question: "Different question text.",
      explanation: "Different explanation.",
      choices: ["A", "B", "C", "D"],
    })

    const result = checkQuestionSimilarity([
      a,
      b,
      c,
      q({ id: "q-4", question: "Alpha beta gamma delta.", explanation: "Explains something unrelated to networking.", choices: ["E", "F", "G", "H"] }),
      q({ id: "q-5", question: "Zebra xylophone quantum river.", explanation: "Completely different topic and wording.", choices: ["I", "J", "K", "L"] }),
    ])
    expect(result.duplicateRate).toBe(40)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("detects duplicate documents by high text similarity, title-only difference, or identical section structure", () => {
    const a = doc({ id: "doc-1", title: "Doc A", documents: [{ id: "d1", text: "Theme: X\nGoal: Y\nKey Points: Z", tts: { text: "Theme: X" } }] })
    const b = doc({ id: "doc-2", title: "Doc B", documents: [{ id: "d2", text: "Theme: X\nGoal: Y\nKey Points: Z", tts: { text: "Theme: X" } }] })
    const c = doc({
      id: "doc-3",
      title: "Doc C",
      documents: [{ id: "d3", text: "# Intro\nThis is different.\n## Details\nMore content.", tts: { text: "This is different." } }],
    })

    const result = checkDocumentSimilarity([
      a,
      b,
      c,
      doc({
        id: "doc-4",
        title: "Doc D",
        documents: [{ id: "d4", text: "# Another\nCompletely different structure.", tts: { text: "Another" } }],
      }),
    ])
    expect(result.duplicateRate).toBe(50)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("detects generic distractors with template phrases", () => {
    const result = checkDistractorQuality([
      q({
        id: "q-1",
        choices: ["Correct", "Skip the basics of networking", "Good", "Good"],
        answerIndex: 0,
      }),
      q({ id: "q-2" }),
    ])

    expect(result.genericDistractors).toBe(1)
    expect(result.warnings.some((w) => w.includes("generic-distractor: q-1"))).toBe(true)
  })

  it("detects generic explanations that are template-only or missing theme keywords", () => {
    const theme = "networking basics"
    const result = checkExplanationQuality(
      [
        q({ id: "q-1", explanation: "Reason: Best matches networking basics." }),
        q({ id: "q-2", explanation: "Reason: Best matches." }),
        q({ id: "q-3", explanation: "Networking basics: TCP reliability uses sequence numbers and ACKs." }),
      ],
      theme,
    )

    expect(result.genericExplanations).toBe(2)
    expect(result.warnings.some((w) => w.includes("generic-explanation: q-1"))).toBe(true)
    expect(result.warnings.some((w) => w.includes("generic-explanation: q-2"))).toBe(true)
  })
})
