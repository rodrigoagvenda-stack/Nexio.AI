import type { Metadata } from "next"
import { Inter, Montserrat, Lato } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })
// Pre-load for print documents
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _montserrat = Montserrat({ subsets: ["latin"], weight: ["400","600","700","800"], variable: "--font-montserrat" })
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _lato = Lato({ subsets: ["latin"], weight: ["300","400","700"], variable: "--font-lato" })

export const metadata: Metadata = {
  title: "Sistema de Gestão para Igrejas",
  description: "Sistema completo de gestão para igrejas - Membros, Finanças, Escalas e mais",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
