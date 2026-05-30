import type { ReactNode } from "react"

export const metadata = {
  title: "SokQA Pack Factory",
  description: "Generate a SokQA learning pack and show a QR code for import.",
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

