export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Pre-aquece o openai no startup — evita bloquear event loop na primeira chamada
    // do from-template (único ponto que carrega rag.ts e dispara require('openai'))
    import('openai').catch(() => {})
  }
}
