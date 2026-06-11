import type { ReactNode } from "react"

export const metadata = {
  title: "Learning Pack Generator OSS",
  description: "Generate reusable learning packs as JSON files and downloadable ZIP packages.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}

