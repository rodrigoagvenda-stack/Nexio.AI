import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Zaapli — Termos de Serviço',
  description: 'Leia os termos e condições para uso da plataforma Zaapli.',
}

export default function TermosPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <div className="mb-10">
        <p className="text-sm text-muted-foreground mb-2">Última atualização: 01 de maio de 2025</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">Termos de Serviço</h1>
        <p className="text-muted-foreground text-base">
          Estes Termos de Serviço ("Termos") regulam o uso da plataforma <strong>Zaapli</strong>, um CRM com
          automação e inteligência artificial disponível em{' '}
          <a href="https://zaapli.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapli.com.br
          </a>{' '}
          e{' '}
          <a href="https://crm.nexioai.online" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            crm.nexioai.online
          </a>.
          Ao criar uma conta ou usar qualquer parte dos nossos serviços, você ("Usuário") concorda integralmente
          com estes Termos. Se você estiver aceitando em nome de uma empresa, declara ter autoridade legal para
          vincular essa empresa a estes Termos.
        </p>
      </div>

      <Section id="servico" title="1. Descrição do Serviço">
        <p>
          A Zaapli oferece uma plataforma SaaS (Software as a Service) de CRM com as seguintes funcionalidades:
        </p>
        <ul>
          <li>Gestão de leads e pipeline de vendas</li>
          <li>SDR automatizado com inteligência artificial via WhatsApp</li>
          <li>Atendimento e chat com leads em tempo real</li>
          <li>Automação de follow-up, anti-noshow e remarketing</li>
          <li>Relatórios e métricas de desempenho comercial</li>
          <li>Integração com WhatsApp via API (UAZapi)</li>
          <li>Captação e qualificação automática de leads</li>
        </ul>
        <p>
          O serviço é prestado no modelo de assinatura mensal ou anual, conforme o plano contratado.
          A Zaapli reserva-se o direito de adicionar, modificar ou descontinuar funcionalidades com aviso prévio.
        </p>
      </Section>

      <Section id="conta" title="2. Conta e Responsabilidades do Usuário">
        <SubSection title="2.1 Elegibilidade">
          <p>
            O uso da plataforma é restrito a pessoas jurídicas ou pessoas físicas maiores de 18 anos.
            Ao se cadastrar, você declara que as informações fornecidas são verdadeiras, completas e atualizadas.
          </p>
        </SubSection>

        <SubSection title="2.2 Segurança da conta">
          <p>
            Você é responsável por manter a confidencialidade das suas credenciais de acesso (e-mail e senha)
            e por todas as atividades realizadas sob sua conta. Em caso de acesso não autorizado, notifique-nos
            imediatamente em{' '}
            <a href="mailto:suporte@zaapli.com.br" className="text-primary underline underline-offset-4">
              suporte@zaapli.com.br
            </a>.
          </p>
        </SubSection>

        <SubSection title="2.3 Dados de leads">
          <p>
            Você é inteiramente responsável pelos dados pessoais de terceiros (leads, clientes) que inserir
            na plataforma, incluindo a obtenção de consentimento adequado conforme a{' '}
            <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              Lei nº 13.709/2018 (LGPD)
            </a>{' '}
            e demais legislações aplicáveis. A Zaapli atua como operadora de dados em relação aos dados de seus leads.
          </p>
        </SubSection>
      </Section>

      <Section id="uso-aceitavel" title="3. Uso Aceitável">
        <p>É expressamente vedado utilizar a plataforma para:</p>
        <ul>
          <li>Enviar spam, mensagens em massa não solicitadas ou listas compradas</li>
          <li>Disseminar conteúdo ilegal, ofensivo, discriminatório ou enganoso</li>
          <li>Realizar engenharia reversa, descompilar ou copiar qualquer parte do software</li>
          <li>Tentar acessar sistemas, contas ou dados de outros usuários</li>
          <li>Sobrecarregar intencionalmente a infraestrutura da plataforma (ataques DDoS)</li>
          <li>Automatizar interações de forma a violar os termos de uso da API do WhatsApp</li>
          <li>Revender, sublicenciar ou transferir o acesso à plataforma sem autorização expressa</li>
          <li>Usar a plataforma para atividades ilegais ou que violem direitos de terceiros</li>
        </ul>
        <p>
          O descumprimento desta cláusula pode resultar em suspensão ou encerramento imediato da conta,
          sem direito a reembolso, e poderá ensejar responsabilidade civil e criminal.
        </p>
      </Section>

      <Section id="planos" title="4. Planos, Preços e Pagamentos">
        <SubSection title="4.1 Planos de assinatura">
          <p>
            Os planos disponíveis, com seus respectivos recursos e preços, estão descritos na página de{' '}
            <a href="https://zaapli.com.br/planos" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              Planos e Preços
            </a>.
            A Zaapli reserva-se o direito de ajustar os preços, comunicando com antecedência mínima de{' '}
            <strong>30 dias</strong> via e-mail.
          </p>
        </SubSection>

        <SubSection title="4.2 Cobrança">
          <p>
            As cobranças são realizadas de forma recorrente (mensal ou anual) através da plataforma{' '}
            <strong>Asaas</strong>. O vencimento é fixo conforme a data de início da assinatura. Em caso de
            inadimplência, o acesso à plataforma poderá ser suspenso após <strong>5 dias</strong> de atraso,
            sendo reativado após a regularização do pagamento.
          </p>
        </SubSection>

        <SubSection title="4.3 Período de teste">
          <p>
            Quando disponível, o período de teste gratuito tem duração definida na oferta. Ao final do teste,
            a assinatura é convertida automaticamente para o plano escolhido, salvo cancelamento anterior.
          </p>
        </SubSection>

        <SubSection title="4.4 Reembolsos">
          <p>
            Oferecemos reembolso integral em até <strong>7 dias corridos</strong> após a primeira contratação,
            nos termos do Art. 49 do Código de Defesa do Consumidor (CDC). Após esse prazo, não há reembolso
            proporcional por períodos não utilizados.
          </p>
        </SubSection>
      </Section>

      <Section id="cancelamento" title="5. Cancelamento e Encerramento">
        <SubSection title="5.1 Cancelamento pelo usuário">
          <p>
            Você pode cancelar sua assinatura a qualquer momento através das configurações da conta em{' '}
            <Link href="/configuracoes" className="text-primary underline underline-offset-4">
              Configurações
            </Link>{' '}
            ou enviando e-mail para{' '}
            <a href="mailto:suporte@zaapli.com.br" className="text-primary underline underline-offset-4">
              suporte@zaapli.com.br
            </a>.
            O acesso permanece ativo até o fim do período já pago. Seus dados ficam disponíveis por
            <strong> 90 dias</strong> após o cancelamento para exportação, sendo então excluídos.
          </p>
        </SubSection>

        <SubSection title="5.2 Encerramento pela Zaapli">
          <p>
            A Zaapli pode encerrar ou suspender sua conta, com ou sem aviso prévio, em caso de:
          </p>
          <ul>
            <li>Violação destes Termos</li>
            <li>Inadimplência superior a 30 dias</li>
            <li>Uso fraudulento ou que prejudique outros usuários</li>
            <li>Determinação legal ou judicial</li>
          </ul>
        </SubSection>

        <SubSection title="5.3 Encerramento do serviço">
          <p>
            Caso a Zaapli decida encerrar o serviço como um todo, notificaremos todos os usuários com pelo
            menos <strong>60 dias de antecedência</strong> e proporcionaremos meios para exportação dos dados.
          </p>
        </SubSection>
      </Section>

      <Section id="propriedade-intelectual" title="6. Propriedade Intelectual">
        <p>
          Todo o código-fonte, design, marca, logotipos, interfaces, algoritmos de IA e demais elementos da
          plataforma Zaapli são de propriedade exclusiva da Zaapli ou de seus licenciantes e estão protegidos
          pelas leis de propriedade intelectual aplicáveis.
        </p>
        <p>
          Ao usar a plataforma, você recebe uma licença limitada, não exclusiva, intransferível e revogável
          para uso interno do seu negócio. Nenhum direito de propriedade é transferido.
        </p>
        <p>
          Você mantém todos os direitos sobre os dados de seus leads e conversas inseridos na plataforma.
          Ao usar nossos serviços, você nos concede uma licença para processar esses dados exclusivamente
          para a prestação do serviço contratado.
        </p>
      </Section>

      <Section id="ia-whatsapp" title="7. Uso de Inteligência Artificial e WhatsApp">
        <SubSection title="7.1 Agente de IA">
          <p>
            O SDR automatizado e os recursos de IA da plataforma utilizam modelos de linguagem de terceiros
            (OpenAI GPT). As respostas geradas pela IA são baseadas nas configurações e dados fornecidos por
            você. A Zaapli não garante que as respostas da IA serão sempre precisas ou adequadas para
            todos os contextos.
          </p>
          <p>
            Você é responsável por revisar as configurações do agente e por qualquer comunicação enviada em
            nome da sua empresa via IA.
          </p>
        </SubSection>

        <SubSection title="7.2 API do WhatsApp">
          <p>
            O uso da integração com WhatsApp está sujeito aos{' '}
            <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              Termos de Serviço do WhatsApp Business
            </a>{' '}
            e às políticas da Meta. O uso indevido (spam, mensagens proibidas) pode resultar no bloqueio do
            seu número pela Meta, situação pela qual a Zaapli não se responsabiliza.
          </p>
        </SubSection>
      </Section>

      <Section id="privacidade" title="8. Privacidade">
        <p>
          O tratamento dos seus dados pessoais é regido pela nossa{' '}
          <Link href="/privacidade" className="text-primary underline underline-offset-4">
            Política de Privacidade
          </Link>,
          que é parte integrante destes Termos. Ao aceitar estes Termos, você também concorda com
          nossa Política de Privacidade.
        </p>
      </Section>

      <Section id="disponibilidade" title="9. Disponibilidade e SLA">
        <p>
          A Zaapli se compromete a garantir disponibilidade de <strong>99,5%</strong> ao mês (uptime),
          excluindo janelas de manutenção programadas e eventos fora do nosso controle (força maior, falhas
          de provedores de infraestrutura).
        </p>
        <p>
          Manutenções programadas serão comunicadas com <strong>24 horas de antecedência</strong> e realizadas
          preferencialmente em horários de menor uso. Incidentes de indisponibilidade não programada serão
          comunicados em nosso canal de status em{' '}
          <a href="https://status.zaapli.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            status.zaapli.com.br
          </a>.
        </p>
      </Section>

      <Section id="responsabilidade" title="10. Limitação de Responsabilidade">
        <p>
          Na máxima extensão permitida pela lei aplicável, a Zaapli não será responsável por:
        </p>
        <ul>
          <li>Perdas de receita, lucros cessantes ou danos indiretos decorrentes do uso da plataforma</li>
          <li>Conteúdo gerado pela IA que seja impreciso ou inadequado ao seu contexto</li>
          <li>Bloqueio de números de WhatsApp por violação das políticas da Meta</li>
          <li>Perda de dados causada por falha do usuário em realizar backups</li>
          <li>Ações de terceiros, incluindo hackers ou fornecedores de infraestrutura</li>
          <li>Indisponibilidade decorrente de força maior</li>
        </ul>
        <p>
          Em nenhuma hipótese a responsabilidade total da Zaapli perante você excederá o valor pago
          nos últimos <strong>3 meses</strong> de assinatura.
        </p>
      </Section>

      <Section id="lei-aplicavel" title="11. Lei Aplicável e Foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Qualquer controvérsia
          decorrente destes Termos será submetida ao foro da comarca de <strong>São Paulo/SP</strong>,
          com exclusão de qualquer outro, por mais privilegiado que seja, salvo disposição legal em contrário.
        </p>
        <p>
          As relações de consumo são regidas também pelo{' '}
          <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            Código de Defesa do Consumidor (Lei nº 8.078/1990)
          </a>{' '}
          e pela{' '}
          <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            LGPD (Lei nº 13.709/2018)
          </a>.
        </p>
      </Section>

      <Section id="alteracoes" title="12. Alterações nestes Termos">
        <p>
          Podemos atualizar estes Termos periodicamente. Em caso de alterações materiais, notificaremos
          você por e-mail e/ou aviso em destaque na plataforma com pelo menos <strong>15 dias de antecedência</strong>.
          O uso continuado após a vigência das alterações constitui aceitação dos novos Termos.
        </p>
        <p>
          O histórico de versões está disponível em{' '}
          <a href="https://zaapli.com.br/termos" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapli.com.br/termos
          </a>.
        </p>
      </Section>

      <Section id="contato" title="13. Contato e Suporte">
        <InfoBox>
          <strong>Zaapli — Suporte e Atendimento</strong><br />
          E-mail:{' '}
          <a href="mailto:suporte@zaapli.com.br" className="text-primary underline underline-offset-4">
            suporte@zaapli.com.br
          </a>
          <br />
          Assuntos jurídicos:{' '}
          <a href="mailto:juridico@zaapli.com.br" className="text-primary underline underline-offset-4">
            juridico@zaapli.com.br
          </a>
          <br />
          Proteção de dados:{' '}
          <a href="mailto:privacidade@zaapli.com.br" className="text-primary underline underline-offset-4">
            privacidade@zaapli.com.br
          </a>
          <br />
          Site:{' '}
          <a href="https://zaapli.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            zaapli.com.br
          </a>
          <br /><br />
          Veja também nossa{' '}
          <Link href="/privacidade" className="text-primary underline underline-offset-4">
            Política de Privacidade
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
