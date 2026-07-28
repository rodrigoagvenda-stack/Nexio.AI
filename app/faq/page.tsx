import type { Metadata } from 'next';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'Perguntas frequentes — Zaapply',
  description: 'Tire suas dúvidas sobre o SDR com IA do Zaapply: planos, WhatsApp, CRM e como funciona.',
};

const FAQS = [
  {
    q: 'O Zaapply substitui meu vendedor?',
    a: 'Depende do seu produto. Preço fechado ou agendamento simples, o Zaapply fecha sozinho. Produto complexo ou sob consulta, ele qualifica e chama seu vendedor no momento certo de fechar.',
  },
  {
    q: 'Preciso trocar de CRM pra usar o Zaapply?',
    a: 'Não. O CRM Kanban já vem integrado, com funil e histórico de cada lead no mesmo lugar onde a conversa acontece.',
  },
  {
    q: 'Qual a diferença entre o plano Start e o Growth?',
    a: 'O Start tem 1 membro na equipe, SDR com IA, CRM e chat. O Growth libera até 5 membros e adiciona o Google Calendar integrado pra agendamento automático direto na conversa.',
  },
  {
    q: 'O Zaapply responde fora do horário comercial?',
    a: 'Sim. A conversa não espera o expediente abrir pra começar.',
  },
  {
    q: 'Corro o risco de perder meu número de WhatsApp?',
    a: 'Não, desde que você siga as políticas de uso do WhatsApp. O Zaapply usa a API oficial da Meta via CoEx, não é número por fora nem automação não oficial.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-roboto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#4fb884] mb-3">FAQ</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-balance">Perguntas frequentes</h1>
          <p className="mt-3 text-[#999]">Tudo que quem está prestes a assinar costuma perguntar antes.</p>

          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-[#212121]">
                <AccordionTrigger className="text-left text-[15px] hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-[#999] leading-relaxed">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
