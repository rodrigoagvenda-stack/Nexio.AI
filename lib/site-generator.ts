/**
 * Motor de substituição de template de site (convenção definida pelo Bruno,
 * Grupo Venda, pra bater com a ferramenta dele sem retrabalho na hora de
 * portar): placeholders `{{CHAVE}}` e blocos repetidos
 * `<!-- REPEAT:NOME -->...<!-- /REPEAT:NOME -->`.
 *
 * Template em si: lib/site-templates/negocio-local.html (autocontido,
 * CSS embutido, cor de destaque via --accent).
 */

export interface RepeatBlocks {
  [blockName: string]: Record<string, string>[]
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function generateSiteHTML(
  template: string,
  fields: Record<string, string>,
  repeats: RepeatBlocks = {}
): string {
  let html = template

  // Blocos repetidos primeiro (podem conter placeholders simples dentro)
  html = html.replace(/<!-- REPEAT:(\w+) -->([\s\S]*?)<!-- \/REPEAT:\1 -->/g, (_match, blockName, blockTemplate) => {
    const items = repeats[blockName] ?? []
    return items
      .map((item) => {
        let block = blockTemplate as string
        for (const [key, value] of Object.entries(item)) {
          block = block.split(`{{${key}}}`).join(escapeHtml(value))
        }
        return block
      })
      .join('\n')
  })

  // Placeholders simples
  for (const [key, value] of Object.entries(fields)) {
    html = html.split(`{{${key}}}`).join(escapeHtml(value))
  }

  // Limpa qualquer placeholder que sobrou sem valor (não deixa {{X}} visível no site)
  html = html.replace(/\{\{[A-Z0-9_]+\}\}/g, '')

  return html
}

/** Deriva --accent-dark/--accent-light de uma cor base (hex), mesma ideia do
 * mecanismo do Bruno : clareia/escurece em JS em vez de cor fixa espalhada. */
export function deriveAccentPalette(hex: string): { accent: string; accentDark: string; accentLight: string } {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)

  const shade = (amount: number) => {
    const adjust = (c: number) => Math.max(0, Math.min(255, Math.round(c + amount)))
    return `#${[adjust(r), adjust(g), adjust(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }

  return { accent: `#${clean}`, accentDark: shade(-30), accentLight: shade(30) }
}
