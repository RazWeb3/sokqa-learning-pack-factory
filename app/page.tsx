"use client"

import { useMemo, useState } from "react"
import { buildLearningPackZipBlob } from "@/lib/learning-pack-zip"
import type { LearningPack } from "@/lib/learning-pack"

type GenerateResponse =
  | {
      ok: true
      documents: LearningPack["documents"]
      quizzes: LearningPack["quizzes"]
      metadata: LearningPack["metadata"]
      validation: LearningPack["validation"]
    }
  | { ok: false; error: string }

const defaultText = `【例】コンビニ接客の基本
- お客様に明るくあいさつする
- いらっしゃいませ、ありがとうございます、少々お待ちください、申し訳ございません を丁寧に使う
- レジで金額を復唱し、確認してから会計する
- 困ったら先輩にすぐ相談する
`

export default function HomePage() {
  const [text, setText] = useState<string>(defaultText)
  const [status, setStatus] = useState<"idle" | "generating" | "validating" | "ready" | "downloading" | "error">("idle")
  const [result, setResult] = useState<GenerateResponse | null>(null)

  const canGenerate = useMemo(
    () => text.trim().length > 0 && (status === "idle" || status === "ready" || status === "error"),
    [status, text],
  )

  async function onGenerate() {
    setResult(null)
    setStatus("generating")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      const data = (await response.json()) as GenerateResponse
      if (!data.ok) {
        setResult(data)
        setStatus("error")
        return
      }

      setStatus("validating")
      setResult(data)
      setStatus("ready")
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Unknown error" })
      setStatus("error")
    }
  }

  async function onDownloadZip() {
    if (!result?.ok) {
      return
    }

    setStatus("downloading")

    try {
      const blob = await buildLearningPackZipBlob(result)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "learning-pack.zip"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setStatus("ready")
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "ZIP generation failed" })
      setStatus("error")
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Learning Pack Generator OSS</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        Paste a manual, generate reusable learning content, validate it, and download it as a ZIP package.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Paste training manual here</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
            }}
          />
        </label>

        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111",
            background: canGenerate ? "#111" : "#777",
            color: "#fff",
            cursor: canGenerate ? "pointer" : "not-allowed",
            width: 220,
          }}
        >
          Generate
        </button>

        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
          <div style={{ fontWeight: 600 }}>Progress</div>
          <div style={{ marginTop: 6, color: "#333" }}>
            {status === "idle" && "Idle"}
            {status === "generating" && "Generating JSON"}
            {status === "validating" && "Running validation"}
            {status === "ready" && "Generation complete"}
            {status === "downloading" && "Building ZIP"}
            {status === "error" && "Error"}
          </div>
        </div>

        {result?.ok && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>Generation Complete</div>
              <div style={{ marginTop: 6, color: "#333" }}>Documents: {result.documents.length}</div>
              <div style={{ marginTop: 4, color: "#333" }}>Quizzes: {result.quizzes.length}</div>
              <div style={{ marginTop: 4, color: result.validation.passed ? "#116611" : "#a00" }}>
                Validation: {result.validation.passed ? "Passed" : "Failed"}
              </div>
            </div>

            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>Validation Result</div>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {result.validation.checks.map((check) => (
                  <div
                    key={check.name}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: check.passed ? "#f2fbf2" : "#fff5f5",
                      color: check.passed ? "#116611" : "#a00",
                    }}
                  >
                    {check.name}: {check.message}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>ZIP Package</div>
              <div style={{ marginTop: 6, color: "#555" }}>
                Files: metadata.json, {result.metadata.documents.join(", ")}, {result.metadata.quizzes.join(", ")}
              </div>
              <button
                onClick={onDownloadZip}
                disabled={!result.validation.passed || status === "downloading"}
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: result.validation.passed && status !== "downloading" ? "#111" : "#777",
                  color: "#fff",
                  cursor: result.validation.passed && status !== "downloading" ? "pointer" : "not-allowed",
                  width: 220,
                }}
              >
                Download Learning Pack
              </button>
            </div>
          </div>
        )}

        {result?.ok === false && (
          <div style={{ padding: 12, border: "1px solid #f4cccc", borderRadius: 8, background: "#fff5f5" }}>
            <div style={{ fontWeight: 600, color: "#a00" }}>Error</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{result.error}</div>
          </div>
        )}
      </div>
    </main>
  )
}
