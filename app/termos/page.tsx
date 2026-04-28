import Link from 'next/link';

export const metadata = {
  title: 'Termos de Uso — Nexio.AI',
};

export default function TermosPage() {
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
            <Link href="/privacidade" className="hover:text-white/70 transition-colors">Privacidade</Link>
            <Link href="/cookies" className="hover:text-white/70 transition-colors">Cookies</Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Legal</p>
          <h1 className="text-3xl font-bold text-white mb-2">Termos de Uso</h1>
          <p className="text-sm text-white/40">Última atualização: 17 de março de 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-white/70">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma Nexio.AI ("Plataforma"), operada pela <strong className="text-white">Nexio.AI</strong>, você ("Usuário" ou "Cliente") concorda integralmente com estes Termos de Uso. Caso não concorde com algum dos termos aqui descritos, não utilize a Plataforma.
            </p>
            <p className="mt-3">
              Estes Termos regulam o uso de todos os serviços oferecidos pela Nexio.AI, incluindo o CRM, módulo de Atendimento via WhatsApp, Orbit (captação de leads), Orbit.AI (automação de outbound), Briefing e demais funcionalidades.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. Descrição do Serviço</h2>
            <p>
              A Nexio.AI é uma plataforma SaaS (Software as a Service) de CRM com inteligência artificial, voltada para gestão de leads, automação de vendas e atendimento via WhatsApp. Os planos disponíveis são:
            </p>
            <ul className="mt-3 space-y-2 ml-4">
              <li><strong className="text-white/90">NEXIO SALES</strong> — CRM completo com kanban, planilha, atendimento via WhatsApp com SDR por IA e dashboard de performance.</li>
              <li><strong className="text-white/90">NEXIO GROWTH</strong> — Tudo do Sales + Orbit (captação e extração de leads por localização e segmento), com 500 leads inclusos por mês.</li>
              <li><strong className="text-white/90">NEXIO ADS</strong> — Tudo do Growth + gestão de tráfego pago (Google Ads e Meta Ads).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. Cadastro e Acesso</h2>
            <p>
              O acesso à Plataforma exige cadastro com informações verdadeiras, precisas e atualizadas. O Usuário é responsável por manter a confidencialidade de suas credenciais de acesso. Qualquer atividade realizada com sua conta é de sua responsabilidade.
            </p>
            <p className="mt-3">
              A Nexio.AI reserva-se o direito de suspender ou encerrar contas que forneçam informações falsas, que violem estes Termos ou que utilizem a Plataforma de forma abusiva.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. Uso Permitido</h2>
            <p>O Usuário poderá utilizar a Plataforma para:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li>Gerenciar leads e oportunidades comerciais de sua própria empresa;</li>
              <li>Comunicar-se com leads e clientes via WhatsApp integrado;</li>
              <li>Automatizar processos de prospecção e follow-up comercial;</li>
              <li>Extrair e importar dados de empresas públicas (Google Maps) para uso comercial legítimo;</li>
              <li>Gerar relatórios, dashboards e exportar dados da própria base de leads.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. Uso Proibido</h2>
            <p>É expressamente vedado ao Usuário:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li>Utilizar a Plataforma para envio de spam, mensagens não solicitadas em massa ou práticas que violem as políticas do WhatsApp Business;</li>
              <li>Revender, sublicenciar ou comercializar o acesso à Plataforma sem autorização expressa;</li>
              <li>Realizar engenharia reversa, decompilar ou tentar acessar o código-fonte da Plataforma;</li>
              <li>Utilizar a Plataforma para atividades ilegais, fraudulentas ou que violem direitos de terceiros;</li>
              <li>Compartilhar credenciais de acesso com terceiros não autorizados;</li>
              <li>Sobrecarregar intencionalmente a infraestrutura da Plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. Pagamento e Cancelamento</h2>
            <p>
              Os planos são cobrados mensalmente conforme os valores vigentes na data de contratação. O pagamento deve ser realizado até a data de vencimento para manter o acesso ativo.
            </p>
            <p className="mt-3">
              O cancelamento pode ser solicitado a qualquer momento pelo e-mail <strong className="text-white/90">contato@nexioai.online</strong> ou pelo WhatsApp de suporte. O acesso permanece ativo até o fim do período já pago, sem reembolso proporcional.
            </p>
            <p className="mt-3">
              A Nexio.AI reserva-se o direito de reajustar os preços dos planos, com aviso prévio de 30 dias ao Cliente.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. Disponibilidade e Suporte</h2>
            <p>
              A Nexio.AI emprega esforços razoáveis para manter a Plataforma disponível 24 horas por dia, 7 dias por semana. No entanto, não garante disponibilidade ininterrupta, podendo ocorrer interrupções para manutenção, atualizações ou por motivos de força maior.
            </p>
            <p className="mt-3">
              O suporte técnico é prestado via e-mail (<strong className="text-white/90">contato@nexioai.online</strong>) e WhatsApp, em horário comercial (segunda a sexta, das 9h às 18h, horário de Brasília).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">8. Propriedade Intelectual</h2>
            <p>
              Todos os direitos de propriedade intelectual sobre a Plataforma, incluindo código-fonte, design, marca, logotipos e conteúdo, são de titularidade exclusiva da Nexio.AI. O uso da Plataforma não transfere ao Usuário nenhum direito sobre esses ativos.
            </p>
            <p className="mt-3">
              Os dados inseridos pelo Usuário (leads, conversas, configurações) permanecem de sua propriedade. A Nexio.AI não reivindica direitos sobre o conteúdo gerado pelo Cliente.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">9. Limitação de Responsabilidade</h2>
            <p>
              A Nexio.AI não se responsabiliza por:
            </p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li>Perdas comerciais, lucros cessantes ou danos indiretos decorrentes do uso ou impossibilidade de uso da Plataforma;</li>
              <li>Bloqueios ou suspensões de contas do WhatsApp Business causados pelo uso inadequado da ferramenta de automação;</li>
              <li>Decisões comerciais tomadas com base nas informações geradas pela IA;</li>
              <li>Falhas em serviços de terceiros (WhatsApp, Supabase, provedores de nuvem) que impactem a disponibilidade da Plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">10. Proteção de Dados (LGPD)</h2>
            <p>
              A Nexio.AI trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Para detalhes sobre coleta, uso e armazenamento de dados, consulte nossa <Link href="/privacidade" className="text-green-400 hover:text-green-300 underline">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">11. Alterações nos Termos</h2>
            <p>
              A Nexio.AI poderá atualizar estes Termos periodicamente. Alterações significativas serão comunicadas com antecedência de 15 dias por e-mail ou notificação dentro da Plataforma. O uso continuado após a vigência das alterações implica aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">12. Foro e Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de Vitória da Conquista, Bahia, como competente para dirimir quaisquer litígios decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">13. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos, entre em contato:
            </p>
            <ul className="mt-3 space-y-1 ml-4">
              <li>E-mail: <strong className="text-white/90">contato@nexioai.online</strong></li>
              <li>WhatsApp: <strong className="text-white/90">(77) 98865-0528</strong></li>
            </ul>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/30">
          <Link href="/privacidade" className="hover:text-white/60 transition-colors">Política de Privacidade</Link>
          <Link href="/cookies" className="hover:text-white/60 transition-colors">Política de Cookies</Link>
          <Link href="/login" className="hover:text-white/60 transition-colors">Voltar ao login</Link>
        </div>
      </main>
    </div>
  );
}
