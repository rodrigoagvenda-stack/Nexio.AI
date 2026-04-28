import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidade — Nexio.AI',
};

export default function PrivacidadePage() {
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
            <Link href="/cookies" className="hover:text-white/70 transition-colors">Cookies</Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Legal</p>
          <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
          <p className="text-sm text-white/40">Última atualização: 17 de março de 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-white/70">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. Introdução</h2>
            <p>
              A <strong className="text-white">Nexio.AI</strong> está comprometida com a proteção dos dados pessoais de seus Clientes e dos dados tratados por meio da Plataforma. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos informações, em conformidade com a <strong className="text-white/90">Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. Dados que Coletamos</h2>

            <h3 className="text-sm font-semibold text-white/90 mb-2 mt-4">2.1 Dados dos Clientes (Usuários da Plataforma)</h3>
            <ul className="space-y-1.5 ml-4 list-disc list-outside">
              <li>Nome completo e e-mail corporativo (cadastro e autenticação);</li>
              <li>Número de telefone e nome da empresa;</li>
              <li>Dados de pagamento (processados por gateway terceiro — não armazenamos dados de cartão);</li>
              <li>Logs de acesso: endereço IP, navegador, horário de acesso;</li>
              <li>Configurações e preferências de uso da Plataforma.</li>
            </ul>

            <h3 className="text-sm font-semibold text-white/90 mb-2 mt-5">2.2 Dados dos Leads (Tratados pelo Cliente)</h3>
            <p>
              A Nexio.AI atua como <strong className="text-white/90">operadora de dados</strong> em relação às informações de leads inseridas ou capturadas pelo Cliente. Esses dados incluem:
            </p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li>Nome, empresa, cargo e segmento do lead;</li>
              <li>Número de WhatsApp e e-mail;</li>
              <li>Histórico de conversas via WhatsApp;</li>
              <li>Anotações, tags e resumos gerados pela IA;</li>
              <li>Documentos e mídias enviados nas conversas.</li>
            </ul>
            <p className="mt-3">
              O Cliente é o <strong className="text-white/90">controlador</strong> desses dados e é responsável por possuir base legal adequada para seu tratamento, conforme a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. Como Usamos os Dados</h2>
            <p>Utilizamos os dados coletados para:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li>Prestar e melhorar os serviços da Plataforma;</li>
              <li>Autenticar usuários e gerenciar acessos;</li>
              <li>Processar pagamentos e gerenciar assinaturas;</li>
              <li>Enviar comunicações sobre atualizações, manutenções e novidades (com opção de descadastro);</li>
              <li>Garantir a segurança e prevenir fraudes;</li>
              <li>Cumprir obrigações legais e regulatórias;</li>
              <li>Treinar e aprimorar modelos de IA, exclusivamente com dados anonimizados e agregados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. Base Legal para o Tratamento</h2>
            <p>O tratamento de dados pela Nexio.AI é fundamentado nas seguintes bases legais previstas na LGPD:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li><strong className="text-white/90">Execução de contrato</strong> — para prestar os serviços contratados;</li>
              <li><strong className="text-white/90">Legítimo interesse</strong> — para melhorias na Plataforma, segurança e prevenção de fraudes;</li>
              <li><strong className="text-white/90">Cumprimento de obrigação legal</strong> — quando exigido por lei ou autoridade competente;</li>
              <li><strong className="text-white/90">Consentimento</strong> — para envio de comunicações de marketing (revogável a qualquer momento).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. Compartilhamento de Dados</h2>
            <p>A Nexio.AI pode compartilhar dados com:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li><strong className="text-white/90">Supabase</strong> — infraestrutura de banco de dados e autenticação (servidor no Brasil);</li>
              <li><strong className="text-white/90">Provedores de pagamento</strong> — para processamento seguro de cobranças;</li>
              <li><strong className="text-white/90">UAZapi / Meta</strong> — para integração com o WhatsApp Business;</li>
              <li><strong className="text-white/90">Autoridades competentes</strong> — quando exigido por ordem judicial ou legal.</li>
            </ul>
            <p className="mt-3">
              Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins comerciais ou publicitários.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados em servidores seguros com criptografia em repouso e em trânsito (TLS). Adotamos práticas de segurança como controle de acesso baseado em funções (RLS), autenticação de dois fatores para contas administrativas e monitoramento contínuo de segurança.
            </p>
            <p className="mt-3">
              Em caso de incidente de segurança que afete dados pessoais, notificaremos os Clientes afetados e a Autoridade Nacional de Proteção de Dados (ANPD) dentro do prazo legalmente estabelecido.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. Retenção de Dados</h2>
            <p>Mantemos os dados pelo tempo necessário para:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li>Prestação dos serviços enquanto a conta estiver ativa;</li>
              <li>Cumprimento de obrigações legais (mínimo de 5 anos para dados fiscais);</li>
              <li>Exercício de direitos em processos judiciais ou administrativos.</li>
            </ul>
            <p className="mt-3">
              Após o cancelamento da conta, os dados são mantidos por 30 dias (período de recuperação) e então eliminados permanentemente, salvo obrigação legal de retenção.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">8. Seus Direitos (LGPD — Art. 18)</h2>
            <p>Você tem os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul className="mt-3 space-y-1.5 ml-4 list-disc list-outside">
              <li><strong className="text-white/90">Acesso</strong> — Solicitar confirmação e acesso aos dados que tratamos sobre você;</li>
              <li><strong className="text-white/90">Correção</strong> — Solicitar a correção de dados incompletos, inexatos ou desatualizados;</li>
              <li><strong className="text-white/90">Exclusão</strong> — Solicitar a eliminação dos dados tratados com base no consentimento;</li>
              <li><strong className="text-white/90">Portabilidade</strong> — Solicitar a exportação dos seus dados em formato estruturado;</li>
              <li><strong className="text-white/90">Revogação do consentimento</strong> — Revogar consentimentos dados anteriormente;</li>
              <li><strong className="text-white/90">Oposição</strong> — Opor-se ao tratamento realizado com base em legítimo interesse.</li>
            </ul>
            <p className="mt-3">
              Para exercer qualquer um desses direitos, entre em contato pelo e-mail <strong className="text-white/90">contato@nexioai.online</strong>. Responderemos em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">9. Transferência Internacional</h2>
            <p>
              Alguns serviços terceiros utilizados pela Nexio.AI podem processar dados fora do Brasil. Nesses casos, garantimos que os transferência ocorra para países com grau de proteção adequado ou mediante garantias contratuais alinhadas com a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">10. Cookies</h2>
            <p>
              Utilizamos cookies para melhorar sua experiência. Para detalhes, consulte nossa <Link href="/cookies" className="text-green-400 hover:text-green-300 underline">Política de Cookies</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">11. Encarregado de Dados (DPO)</h2>
            <p>
              O responsável pelo tratamento de dados pessoais na Nexio.AI pode ser contatado por:
            </p>
            <ul className="mt-3 space-y-1 ml-4">
              <li>E-mail: <strong className="text-white/90">contato@nexioai.online</strong></li>
              <li>WhatsApp: <strong className="text-white/90">(77) 98865-0528</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">12. Alterações nesta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Notificaremos sobre alterações relevantes com antecedência mínima de 15 dias. O uso continuado da Plataforma após as alterações implica aceitação da nova Política.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/30">
          <Link href="/termos" className="hover:text-white/60 transition-colors">Termos de Uso</Link>
          <Link href="/cookies" className="hover:text-white/60 transition-colors">Política de Cookies</Link>
          <Link href="/login" className="hover:text-white/60 transition-colors">Voltar ao login</Link>
        </div>
      </main>
    </div>
  );
}
