import { generateLearningPack } from "@/lib/learning-pack"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === "string" ? body.text : ""
  if (!text.trim()) {
    return Response.json({ ok: false, error: "text is required" }, { status: 400 })
  }

  try {
    const pack = generateLearningPack(text)
    return Response.json({ ok: true, ...pack })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to generate learning pack",
      },
      { status: 500 },
    )
  }
}
