// Resumable Upload API da Meta : usada SÓ na criação/submissão de template
// (gera o "handle" que a Meta usa pra revisar o exemplo de mídia do header/
// card). Não confundir com a Media Upload API padrão (POST /{phone-number-
// id}/media, usada no ENVIO de carrossel de verdade, ver whatsapp-sender.ts)
// — são namespaces de identificador diferentes, um handle não serve de id.

const GRAPH_VERSION = 'v21.0'

async function resumableUploadStart(
  appId: string,
  token: string,
  fileName: string,
  fileLength: number,
  fileType: string
): Promise<string> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${fileLength}&file_type=${encodeURIComponent(fileType)}&access_token=${token}`
  const res = await fetch(url, { method: 'POST' })
  const json = await res.json()
  if (!res.ok || !json?.id) throw new Error(json?.error?.message ?? 'Falha ao iniciar upload na Meta')
  return json.id as string // "upload:<SESSION_ID>"
}

async function resumableUploadTransfer(sessionId: string, token: string, fileBuffer: Buffer): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${sessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: '0',
    },
    body: new Uint8Array(fileBuffer),
  })
  const json = await res.json()
  if (!res.ok || !json?.h) throw new Error(json?.error?.message ?? 'Falha ao transferir arquivo pra Meta')
  return json.h as string
}

/**
 * Baixa a mídia de uma URL pública (Supabase Storage) e devolve o handle
 * pronto pra usar em `example.header_handle` na submissão de template.
 */
export async function getMetaMediaHandle(mediaUrl: string, token: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  if (!appId) throw new Error('NEXT_PUBLIC_META_APP_ID não configurado')

  const fileRes = await fetch(mediaUrl)
  if (!fileRes.ok) throw new Error(`Falha ao baixar mídia : ${fileRes.status}`)
  const contentType = fileRes.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = Buffer.from(await fileRes.arrayBuffer())
  const fileName = mediaUrl.split('/').pop()?.split('?')[0] ?? 'upload.bin'

  const sessionId = await resumableUploadStart(appId, token, fileName, buffer.length, contentType)
  return resumableUploadTransfer(sessionId, token, buffer)
}
