/**
 * Isolado em arquivo próprio para que o chunk de rag.ts
 * nunca carregue pdf-parse/pdfjs-dist junto.
 * Carregado apenas quando um PDF é processado.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  return data.text
}
