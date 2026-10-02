import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { renderAuthEmail } from './template'
import { ALL_SCENARIOS } from './scenarios'

const outDir = join(__dirname, 'output')
mkdirSync(outDir, { recursive: true })

for (const s of ALL_SCENARIOS) {
  const html = renderAuthEmail(s)
  writeFileSync(join(outDir, `${s.key}.html`), html, 'utf-8')
}

const manifest = ALL_SCENARIOS.map((s) => `${s.key}.html  ->  "${s.label}"  |  assunto: ${s.subject}`).join('\n')
writeFileSync(join(outDir, '_manifest.txt'), manifest, 'utf-8')

console.log(`Gerados ${ALL_SCENARIOS.length} templates em ${outDir}`)
