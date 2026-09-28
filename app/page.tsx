import { redirect } from 'next/navigation';

// A landing pública mudou pra zaapply.com.br (repositório separado, site-zaapply). Esse domínio
// (app.zaapply.com.br) é só o produto: raiz manda pro dashboard, que já redireciona pro /login sozinho
// quando não tem sessão (ver (dashboard)/layout.tsx). Antes duplicava a landing inteira aqui, com link
// de assinar plano quebrado e conteúdo desatualizado (28/09/2026).
export default function Home() {
  redirect('/dashboard');
}
