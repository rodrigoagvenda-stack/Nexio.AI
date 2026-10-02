import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ICON_PATHS } from './icons'

// 2x pra ficar nítido em tela retina, exibido em 56x56 no e-mail.
const SIZE = 112
const OUT_DIR = join(__dirname, '..', '..', 'public', 'email-icons')

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const [key, paths] of Object.entries(ICON_PATHS)) {
    const svg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="28" r="28" fill="#E3F1EA"/>
  <g transform="translate(16,16)">${paths}</g>
</svg>`.trim()

    const png = await sharp(Buffer.from(svg)).resize(SIZE, SIZE).png().toBuffer()
    writeFileSync(join(OUT_DIR, `${key}.png`), png)
  }

  console.log(`Gerados ${Object.keys(ICON_PATHS).length} ícones em ${OUT_DIR}`)
}

main()
