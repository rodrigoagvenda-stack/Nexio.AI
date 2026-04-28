import Link from 'next/link';

export const metadata = {
  title: 'Política de Cookies — Nexio.AI',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Header */}
      <header className="border-b border-white/10 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/login">
            <img
              src="https://qbhxmgzogjqokjqvzunp.supabase.co/storage/v1/object/public/branding/nexio-branca.png"
              alt="Nexio.AI"
              style={{ height: '24px', width: 'auto' }}
            />
          </Link>
          <div className="flex gap-4 text-xs text-white/40">
            <Link href="/termos" className="hover:text-white/70 transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-white/70 transition-colors">Privacidade</Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Legal</p>
          <h1 className="text-3xl font-bold text-white mb-2">Política de Cookies</h1>
          <p className="text-sm text-white/40">Última atualização: 17 de março de 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-white/70">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. O que são Cookies?</h2>
            <p>
              Cookies são pequenos arquivos de texto armazenados no seu navegador ou dispositivo quando você acessa um site. Eles permitem que a Plataforma reconheça seu dispositivo, mantenha sua sessão ativa e memorize suas preferências para melhorar sua experiência de uso.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. Tipos de Cookies que Utilizamos</h2>

            <div className="mt-4 space-y-6">
              <div className="border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-500/20 text-green-400">Essenciais</span>
                  <h3 className="text-sm font-semibold text-white">Cookies de Sessão e Autenticação</h3>
                </div>
                <p className="text-xs text-white/60 mb-3">Necessários para o funcionamento da Plataforma. Não podem ser desativados.</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="font-mono text-green-400">sb-*-auth-token</span>
                    <span className="text-white/50">Supabase</span>
                    <span className="text-white/50">Mantém sua sessão autenticada</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="font-mono text-green-400">sb-*-auth-token-code-verifier</span>
                    <span className="text-white/50">Supabase</span>
                    <span className="text-white/50">Segurança no fluxo de autenticação OAuth</span>
                  </div>
                </div>
              </div>

              <div className="border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-400">Funcionais</span>
                  <h3 className="text-sm font-semibold text-white">Cookies de Preferências</h3>
                </div>
                <p className="text-xs text-white/60 mb-3">Armazenam suas preferências para personalizar a experiência.</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="font-mono text-green-400">theme</span>
                    <span className="text-white/50">Nexio.AI</span>
                    <span className="text-white/50">Preferência de tema (claro/escuro)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="font-mono text-green-400">sidebar-collapsed</span>
                    <span className="text-white/50">Nexio.AI</span>
                    <span className="text-white/50">Estado do menu lateral (expandido/recolhido)</span>
                  </div>
                </div>
              </div>

              <div className="border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-yellow-500/20 text-yellow-400">Analíticos</span>
                  <h3 className="text-sm font-semibold text-white">Cookies de Desempenho</h3>
                </div>
                <p className="text-xs text-white/60 mb-3">Coletamos dados agregados e anônimos para entender como a Plataforma é utilizada e identificar melhorias.</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="font-mono text-green-400">_vercel-*</span>
                    <span className="text-white/50">Vercel</span>
                    <span className="text-white/50">Monitoramento de performance da aplicação</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. Cookies de Terceiros</h2>
            <p>Alguns cookies são definidos por serviços de terceiros que utilizamos:</p>
            <ul className="mt-3 space-y-2 ml-4 list-disc list-outside">
              <li>
                <strong className="text-white/90">Supabase</strong> — Plataforma de banco de dados e autenticação. Gerencia tokens de sessão para manter o login seguro. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">Política de Privacidade</a>
              </li>
              <li>
                <strong className="text-white/90">Vercel</strong> — Infraestrutura de hospedagem da aplicação. Pode armazenar cookies de edge e performance. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">Política de Privacidade</a>
              </li>
            </ul>
            <p className="mt-3">
              Não utilizamos cookies de rastreamento publicitário ou redes de anúncios de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. Duração dos Cookies</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left px-4 py-2.5 text-white/60 font-medium">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-white/60 font-medium">Duração</th>
                    <th className="text-left px-4 py-2.5 text-white/60 font-medium">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-2.5 text-white/70">Sessão</td>
                    <td className="px-4 py-2.5 text-white/50">Até fechar o navegador</td>
                    <td className="px-4 py-2.5 text-white/50">Expiram quando você encerra o navegador</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-white/70">Autenticação</td>
                    <td className="px-4 py-2.5 text-white/50">7 dias</td>
                    <td className="px-4 py-2.5 text-white/50">Mantém o login ativo sem precisar re-autenticar</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-white/70">Preferências</td>
                    <td className="px-4 py-2.5 text-white/50">1 ano</td>
                    <td className="px-4 py-2.5 text-white/50">Lembram suas configurações de interface</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. Como Gerenciar Cookies</h2>
            <p>
              Você pode controlar e gerenciar cookies nas configurações do seu navegador. Note que desativar cookies essenciais pode impedir o funcionamento correto da Plataforma, incluindo o login.
            </p>

            <div className="mt-4 space-y-2">
              {[
                { name: 'Google Chrome', url: 'https://support.google.com/chrome/answer/95647' },
                { name: 'Mozilla Firefox', url: 'https://support.mozilla.org/pt-BR/kb/gerencie-configuracoes-de-armazenamento-local-de-s' },
                { name: 'Microsoft Edge', url: 'https://support.microsoft.com/pt-br/microsoft-edge/excluir-cookies-no-microsoft-edge' },
                { name: 'Safari', url: 'https://support.apple.com/pt-br/guide/safari/sfri11471/mac' },
              ].map((browser) => (
                <div key={browser.name} className="flex items-center gap-2 text-xs">
                  <span className="text-white/50 w-32">{browser.name}</span>
                  <a href={browser.url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                    Gerenciar cookies →
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. Atualizações desta Política</h2>
            <p>
              Esta Política de Cookies pode ser atualizada para refletir mudanças nos cookies que utilizamos ou por exigências legais. Recomendamos que você a revise periodicamente. A data da última atualização está indicada no topo desta página.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. Contato</h2>
            <p>
              Para dúvidas sobre nossa Política de Cookies ou sobre o uso de dados pessoais, entre em contato:
            </p>
            <ul className="mt-3 space-y-1 ml-4">
              <li>E-mail: <strong className="text-white/90">contato@nexioai.online</strong></li>
              <li>WhatsApp: <strong className="text-white/90">(77) 98865-0528</strong></li>
            </ul>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/30">
          <Link href="/termos" className="hover:text-white/60 transition-colors">Termos de Uso</Link>
          <Link href="/privacidade" className="hover:text-white/60 transition-colors">Política de Privacidade</Link>
          <Link href="/login" className="hover:text-white/60 transition-colors">Voltar ao login</Link>
        </div>
      </main>
    </div>
  );
}
