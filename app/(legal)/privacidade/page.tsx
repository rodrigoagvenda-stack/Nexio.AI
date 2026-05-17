import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Zaapply — Política de Privacidade',
  description: 'Saiba como a Zaapply coleta, usa e protege seus dados pessoais.',
}

export default function PrivacidadePage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <div className="mb-10">
        <p className="text-sm text-muted-foreground mb-2">Última atualização: 01 de maio de 2025</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">Política de Privacidade</h1>
        <p className="text-muted-foreground text-base">
          Esta Política de Privacidade descreve como a <strong>Zaapply</strong> coleta, utiliza, armazena e protege
          seus dados pessoais ao usar nosso CRM com inteligência artificial disponível em{' '}
          <a href="https://zaapply.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapply.com.br
          </a>{' '}
          e{' '}
          <a href="https://crm.nexioai.online" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            crm.nexioai.online
          </a>.
          Ao utilizar nossos serviços, você concorda com os termos desta política. Caso não concorde, pedimos que não
          utilize a plataforma.
        </p>
      </div>

      <Section id="controlador" title="1. Controlador dos Dados">
        <p>
          O controlador responsável pelo tratamento dos seus dados pessoais é a <strong>Zaapply</strong>,
          empresa de tecnologia especializada em CRM com automação e inteligência artificial.
        </p>
        <InfoBox>
          <strong>Contato do Encarregado de Dados (DPO):</strong><br />
          E-mail:{' '}
          <a href="mailto:privacidade@zaapply.com.br" className="text-primary underline underline-offset-4">
            privacidade@zaapply.com.br
          </a>
          <br />
          Site:{' '}
          <a href="https://zaapply.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapply.com.br
          </a>
        </InfoBox>
      </Section>

      <Section id="dados-coletados" title="2. Dados que Coletamos">
        <p>Coletamos os seguintes tipos de dados pessoais:</p>

        <SubSection title="2.1 Dados de cadastro">
          <ul>
            <li>Nome completo</li>
            <li>Endereço de e-mail</li>
            <li>Nome da empresa</li>
            <li>Cargo/função</li>
            <li>Senha (armazenada de forma criptografada)</li>
          </ul>
        </SubSection>

        <SubSection title="2.2 Dados de leads e contatos">
          <ul>
            <li>Nome e telefone (WhatsApp) dos leads cadastrados na plataforma</li>
            <li>Mensagens trocadas via WhatsApp entre o agente de IA e os leads</li>
            <li>Áudios enviados e recebidos nas conversas (transcritos via Whisper)</li>
            <li>Imagens e documentos enviados nas conversas</li>
            <li>Estágio no funil de vendas e anotações do vendedor</li>
          </ul>
        </SubSection>

        <SubSection title="2.3 Dados de uso e navegação">
          <ul>
            <li>Endereço IP e dados de geolocalização aproximada</li>
            <li>Tipo de dispositivo, navegador e sistema operacional</li>
            <li>Páginas visitadas, tempo de sessão e interações com a interface</li>
            <li>Logs de acesso e eventos de autenticação</li>
          </ul>
        </SubSection>

        <SubSection title="2.4 Dados de pagamento">
          <p>
            Dados de pagamento são processados diretamente pela plataforma <strong>Asaas</strong>.
            A Zaapply não armazena números de cartão de crédito ou dados bancários completos. Apenas confirmações
            de pagamento e status de assinatura são registrados em nosso sistema.
          </p>
        </SubSection>
      </Section>

      <Section id="finalidades" title="3. Como Utilizamos seus Dados">
        <p>Utilizamos seus dados para as seguintes finalidades:</p>
        <Table
          headers={['Finalidade', 'Base Legal (LGPD)']}
          rows={[
            ['Criar e gerenciar sua conta na plataforma', 'Execução de contrato — Art. 7º, V'],
            ['Fornecer os recursos de CRM e automação de vendas', 'Execução de contrato — Art. 7º, V'],
            ['Operar o SDR de IA e responder leads via WhatsApp', 'Execução de contrato — Art. 7º, V'],
            ['Transcrever áudios para texto via IA (Whisper)', 'Execução de contrato — Art. 7º, V'],
            ['Enviar notificações sobre o serviço e atualizações', 'Legítimo interesse — Art. 7º, IX'],
            ['Analisar métricas de desempenho e melhorar o produto', 'Legítimo interesse — Art. 7º, IX'],
            ['Cumprir obrigações legais e regulatórias', 'Obrigação legal — Art. 7º, II'],
            ['Prevenir fraudes e garantir a segurança da plataforma', 'Legítimo interesse — Art. 7º, IX'],
          ]}
        />
      </Section>

      <Section id="compartilhamento" title="4. Compartilhamento com Terceiros">
        <p>
          A Zaapply não vende seus dados pessoais. Compartilhamos dados apenas com os seguintes parceiros técnicos,
          na medida necessária para operar o serviço:
        </p>
        <Table
          headers={['Parceiro', 'Finalidade', 'Dados compartilhados']}
          rows={[
            ['Supabase (EUA)', 'Banco de dados e autenticação', 'Todos os dados da plataforma'],
            ['OpenAI (EUA)', 'Geração de respostas de IA, transcrição de áudio e análise de imagens', 'Mensagens, áudios e imagens de conversas'],
            ['UAZapi (Brasil)', 'Envio e recebimento de mensagens WhatsApp', 'Número de telefone e conteúdo das mensagens'],
            ['Asaas (Brasil)', 'Processamento de pagamentos e cobranças', 'Dados de faturamento e assinatura'],
            ['Vercel (EUA)', 'Hospedagem e entrega da aplicação web', 'Dados de navegação e logs de acesso'],
          ]}
        />
        <p className="mt-4">
          Todos os parceiros são obrigados contratualmente a tratar os dados apenas para as finalidades especificadas
          e a adotar medidas adequadas de segurança. As transferências internacionais são realizadas com base nas
          cláusulas contratuais padrão previstas na LGPD e no GDPR.
        </p>
      </Section>

      <Section id="retencao" title="5. Retenção de Dados">
        <Table
          headers={['Tipo de dado', 'Prazo de retenção']}
          rows={[
            ['Dados de conta ativa', 'Enquanto a conta estiver ativa'],
            ['Dados de conta cancelada', '90 dias após o cancelamento, depois excluídos'],
            ['Conversas e mensagens', 'Durante a vigência do contrato + 90 dias'],
            ['Logs de acesso e segurança', '12 meses'],
            ['Dados de pagamento (registros)', '5 anos (obrigação fiscal)'],
          ]}
        />
        <p className="mt-4">
          Após os prazos acima, os dados são excluídos de forma segura ou anonimizados, impossibilitando a
          identificação do titular.
        </p>
      </Section>

      <Section id="direitos" title="6. Seus Direitos (LGPD)">
        <p>
          Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem os seguintes direitos:
        </p>
        <ul>
          <li><strong>Acesso:</strong> solicitar confirmação de que tratamos seus dados e obter uma cópia.</li>
          <li><strong>Correção:</strong> solicitar a atualização de dados incompletos, inexatos ou desatualizados.</li>
          <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou tratados em desconformidade com a lei.</li>
          <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado e interoperável.</li>
          <li><strong>Revogação do consentimento:</strong> quando o tratamento for baseado em consentimento.</li>
          <li><strong>Informação:</strong> sobre as entidades com as quais compartilhamos seus dados.</li>
          <li><strong>Oposição:</strong> ao tratamento realizado com base em legítimo interesse.</li>
          <li><strong>Reclamação à ANPD:</strong> junto à{' '}
            <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              Autoridade Nacional de Proteção de Dados
            </a>.
          </li>
        </ul>
        <p>
          Para exercer qualquer direito, entre em contato pelo e-mail{' '}
          <a href="mailto:privacidade@zaapply.com.br" className="text-primary underline underline-offset-4">
            privacidade@zaapply.com.br
          </a>.
          Responderemos em até <strong>15 dias úteis</strong>.
        </p>
      </Section>

      <Section id="cookies" title="7. Cookies e Tecnologias de Rastreamento">
        <p>Utilizamos os seguintes tipos de cookies:</p>
        <Table
          headers={['Tipo', 'Finalidade', 'Duração']}
          rows={[
            ['Essenciais', 'Autenticação e segurança da sessão', 'Sessão / 30 dias'],
            ['Funcionais', 'Preferências de interface (tema, idioma)', '1 ano'],
            ['Analíticos', 'Métricas de uso para melhoria do produto (dados anonimizados)', '12 meses'],
          ]}
        />
        <p className="mt-4">
          Não utilizamos cookies de publicidade ou rastreamento de terceiros para fins de marketing.
          Você pode configurar seu navegador para recusar cookies, mas isso pode limitar algumas funcionalidades
          da plataforma.
        </p>
      </Section>

      <Section id="seguranca" title="8. Segurança dos Dados">
        <p>Adotamos as seguintes medidas técnicas e organizacionais para proteger seus dados:</p>
        <ul>
          <li>Criptografia em trânsito (TLS 1.3) e em repouso (AES-256)</li>
          <li>Autenticação com suporte a login social (OAuth 2.0 com Google)</li>
          <li>Row-Level Security (RLS) no banco de dados — cada empresa acessa apenas seus próprios dados</li>
          <li>Controle de acesso baseado em funções (RBAC) com papéis de usuário e admin</li>
          <li>Logs de auditoria para todas as operações sensíveis</li>
          <li>Infraestrutura hospedada em provedores com certificação SOC 2 e ISO 27001</li>
        </ul>
        <p>
          Em caso de incidente de segurança que coloque em risco seus dados, notificaremos você e a ANPD
          no prazo previsto na LGPD.
        </p>
      </Section>

      <Section id="menores" title="9. Menores de Idade">
        <p>
          A plataforma Zaapply é destinada exclusivamente a empresas e profissionais. Não coletamos dados de
          crianças ou adolescentes menores de 18 anos. Caso identifiquemos dados de menores cadastrados
          sem autorização, procederemos com a exclusão imediata.
        </p>
      </Section>

      <Section id="alteracoes" title="10. Alterações nesta Política">
        <p>
          Reservamo-nos o direito de atualizar esta Política de Privacidade a qualquer momento. Em caso de
          alterações relevantes, notificaremos você por e-mail e/ou por aviso em destaque na plataforma com
          pelo menos <strong>15 dias de antecedência</strong>. O uso continuado dos serviços após as alterações
          indica sua concordância.
        </p>
        <p>
          O histórico de versões desta política está disponível em{' '}
          <a href="https://zaapply.com.br/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapply.com.br/privacidade
          </a>.
        </p>
      </Section>

      <Section id="contato" title="11. Contato">
        <InfoBox>
          <strong>Zaapply — Encarregado de Proteção de Dados</strong><br />
          E-mail:{' '}
          <a href="mailto:privacidade@zaapply.com.br" className="text-primary underline underline-offset-4">
            privacidade@zaapply.com.br
          </a>
          <br />
          Site:{' '}
          <a href="https://zaapply.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapply.com.br
          </a>
          <br /><br />
          Veja também nossos{' '}
          <Link href="/termos" className="text-primary underline underline-offset-4">
            Termos de Serviço
          </Link>.
        </InfoBox>
      </Section>
    </article>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-xl font-bold mb-4 text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      {children}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 px-5 py-4 text-sm leading-relaxed">
      {children}
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-muted-foreground align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
