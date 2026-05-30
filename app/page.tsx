"use client"

import { useMemo, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"

type GenerateResponse =
  | {
      ok: true
      packId: string
      manifestUrl: string
      deploy: { attempted: boolean; ok: boolean; message: string }
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
  const [status, setStatus] = useState<
    "idle" | "analyzing" | "documents" | "quiz" | "manifest" | "deploy" | "done" | "error"
  >("idle")
  const [result, setResult] = useState<GenerateResponse | null>(null)

  const canGenerate = useMemo(
    () => text.trim().length > 0 && (status === "idle" || status === "done" || status === "error"),
    [status, text],
  )

  async function onGenerate() {
    setResult(null)
    setStatus("analyzing")

    const timeouts: number[] = []
    timeouts.push(window.setTimeout(() => setStatus("documents"), 500))
    timeouts.push(window.setTimeout(() => setStatus("quiz"), 1000))
    timeouts.push(window.setTimeout(() => setStatus("manifest"), 1500))
    timeouts.push(window.setTimeout(() => setStatus("deploy"), 2000))

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

      setStatus("done")
      setResult(data)
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Unknown error" })
      setStatus("error")
    } finally {
      for (const t of timeouts) window.clearTimeout(t)
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>SokQA Learning Pack Factory</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        Paste a manual → generate JSON → deploy static files → scan QR to import into SokQA
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
            {status === "analyzing" && "Analyzing"}
            {status === "documents" && "Documents"}
            {status === "quiz" && "Quiz"}
            {status === "manifest" && "Manifest"}
            {status === "deploy" && "Deploy"}
            {status === "done" && "Done"}
            {status === "error" && "Error"}
          </div>
        </div>

        {result?.ok && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>Manifest URL</div>
              <div style={{ marginTop: 6, wordBreak: "break-all" }}>{result.manifestUrl}</div>
              <div style={{ marginTop: 6, color: "#555" }}>
                Deploy: {result.deploy.attempted ? (result.deploy.ok ? "OK" : "Failed") : "Skipped"} (
                {result.deploy.message})
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
              <div style={{ fontWeight: 600 }}>Scan to import into SokQA</div>
              <QRCodeCanvas value={result.manifestUrl} size={220} />
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
