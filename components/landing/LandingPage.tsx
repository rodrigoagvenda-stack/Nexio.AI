'use client';

import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { Button } from '@/components/ui/button';
import { Reveal } from './Reveal';
import { WhatsAppSimulator } from './WhatsAppSimulator';
import { Bot, Calendar, MessageSquare, KanbanSquare, Users2 } from 'lucide-react';

const PLANS = [
  {
    name: 'Zaapply Start',
    price: '297',
    members: '1 membro',
    features: ['SDR com IA', 'CRM Kanban', 'Atendimento via chat'],
    badge: null as string | null,
  },
  {
    name: 'Zaapply Growth',
    price: '397',
    members: 'Até 5 membros',
    features: ['Tudo do Start', 'Google Calendar integrado'],
    badge: 'Mais completo',
  },
];

const STEPS = [
  { side: 'in' as const, t: 'Lead manda mensagem, a qualquer hora.', d: 'O Zaapply responde no mesmo instante, sem fila de espera.' },
  { side: 'out' as const, t: 'Ele entende o que o lead quer.', d: 'Faz as perguntas certas e organiza tudo no CRM, sem ninguém digitar nada.' },
  { side: 'out' as const, t: 'Fecha sozinho ou entrega pronto.', d: 'Produto simples, o próprio agente fecha. Produto consultivo, entrega o lead quente pro vendedor no momento exato.' },
];

function Section({ id, className = '', children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`px-6 py-24 md:py-32 ${className}`}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

export function LandingPage() {
  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-[#0A0A0A] text-white font-roboto">
        <SiteHeader />

        {/* hero */}
        <Section className="pt-16 md:pt-24 pb-28">
          <div className="grid md:grid-cols-[1.15fr_1fr] gap-16 items-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 text-xs text-[#8f8f8f] mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#96F63C] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#96F63C]" />
                </span>
                respondendo agora, em tempo real
              </div>
              <h1 className="text-[2.75rem] md:text-6xl font-extrabold leading-[1.04] tracking-tight text-balance">
                23h de sexta. O lead manda mensagem.<br />Ninguém responde até segunda.
              </h1>
              <p className="mt-6 text-lg text-[#999] max-w-md leading-relaxed">
                O Zaapply é o SDR que atende no WhatsApp da sua empresa: responde, qualifica e chama seu vendedor na hora certa. A venda acontece na conversa, não em mais um sistema pra alguém abrir.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button size="lg">Assinar o Zaapply</Button>
                <a href="#como-funciona">
                  <Button variant="secondary" size="lg">Ver como funciona</Button>
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.15} className="flex justify-center md:justify-end">
              <WhatsAppSimulator />
            </Reveal>
          </div>
        </Section>

        {/* como funciona — narrado como a própria conversa */}
        <Section id="como-funciona" className="bg-[#0D0D0D] border-y border-[#161616]">
          <Reveal className="max-w-lg mx-auto text-center mb-16">
            <h2 className="text-2xl md:text-[2rem] font-bold text-balance">Da mensagem à venda, sem trocar de tela</h2>
          </Reveal>
          <div className="max-w-xl mx-auto flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.t} delay={i * 0.12} y={16} className={`flex ${step.side === 'in' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-4 ${
                  step.side === 'in'
                    ? 'bg-[#1B1B1B] rounded-bl-sm'
                    : 'bg-[#0F3D2B] rounded-br-sm'
                }`}>
                  <p className="font-semibold text-[15px]">{step.t}</p>
                  <p className="mt-1.5 text-sm text-[#a8a8a8] leading-relaxed">{step.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* para quem é */}
        <Section>
          <Reveal className="max-w-lg mx-auto text-center mb-14">
            <h2 className="text-2xl md:text-[2rem] font-bold text-balance">Dois jeitos de vender, o mesmo SDR</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-px bg-[#1c1c1c] rounded-2xl overflow-hidden">
            <Reveal className="bg-[#0A0A0A] p-8 md:p-10">
              <p className="font-mono text-xs text-[#666] mb-3">FECHA SOZINHO</p>
              <h3 className="font-bold text-xl">SDR que fecha</h3>
              <p className="mt-3 text-sm text-[#999] leading-relaxed">
                Produto com preço fechado ou agendamento simples: barbearia, clínica, curso, imóvel pra locação. O Zaapply conduz do oi ao fechamento sozinho.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="bg-[#0A0A0A] p-8 md:p-10">
              <p className="font-mono text-xs text-[#666] mb-3">PASSA O BASTÃO</p>
              <h3 className="font-bold text-xl">SDR que qualifica</h3>
              <p className="mt-3 text-sm text-[#999] leading-relaxed">
                Produto complexo ou sob consulta: consultoria, projeto sob medida, ticket alto. O Zaapply aquece a conversa e chama seu vendedor no momento exato de fechar.
              </p>
            </Reveal>
          </div>
        </Section>

        {/* diferencial */}
        <Section className="bg-[#0D0D0D] border-y border-[#161616]">
          <Reveal className="max-w-lg mx-auto text-center mb-14">
            <h2 className="text-2xl md:text-[2rem] font-bold text-balance">Não é CRM com WhatsApp.<br />É WhatsApp com CRM.</h2>
            <p className="mt-4 text-[#999] text-[15px]">
              Ferramenta de CRM genérica trata o WhatsApp como mais um canal plugado, a venda ainda acontece dentro do sistema. No Zaapply é o contrário.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="max-w-2xl mx-auto rounded-2xl border border-[#212121] overflow-hidden">
            {[
              ['Onde a venda acontece', 'No sistema, depois de alguém abrir', 'Na própria conversa'],
              ['Quem qualifica o lead', 'Vendedor, manualmente', 'O SDR com IA, sozinho'],
              ['Histórico do lead', 'Precisa integrar ou copiar', 'Já nasce no CRM Kanban'],
              ['Fora do horário comercial', 'Espera alguém abrir o sistema', 'Responde na hora'],
            ].map((row, i, arr) => (
              <div key={row[0]} className={`grid grid-cols-[1fr_1fr] sm:grid-cols-[1.2fr_1fr_1fr] ${i < arr.length - 1 ? 'border-b border-[#181818]' : ''}`}>
                <div className="hidden sm:flex items-center px-5 py-4 text-sm text-[#777]">{row[0]}</div>
                <div className="px-5 py-4 text-sm text-[#888] border-r border-[#181818] flex flex-col justify-center">
                  <span className="sm:hidden text-xs text-[#555] mb-1">{row[0]}</span>
                  {row[1]}
                </div>
                <div className="px-5 py-4 text-sm font-semibold text-white bg-[#0F3D2B]/30 flex items-center">{row[2]}</div>
              </div>
            ))}
          </Reveal>
        </Section>

        {/* features */}
        <Section>
          <Reveal className="max-w-lg mx-auto text-center mb-14">
            <h2 className="text-2xl md:text-[2rem] font-bold text-balance">Sem sistema separado, sem retrabalho</h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Bot, t: 'Agente SDR com IA', d: 'Conduz a conversa inteira no WhatsApp, do primeiro oi à hora de fechar' },
              { icon: MessageSquare, t: 'Atendimento via chat', d: 'Seu time entra na conversa quando quiser, sem perder o histórico' },
              { icon: KanbanSquare, t: 'CRM Kanban', d: 'Cada lead com funil e histórico completo, sem copiar nada pra outro sistema' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 0.1} className="border border-[#1c1c1c] rounded-2xl p-6">
                <f.icon className="w-5 h-5 text-[#7fae8f]" strokeWidth={1.75} />
                <h3 className="mt-4 font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm text-[#888] leading-relaxed">{f.d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2} className="mt-6 rounded-2xl border border-[#2c4d3d] bg-[#0F3D2B]/15 p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <p className="text-xs font-mono uppercase tracking-wide text-[#96F63C] shrink-0">No Growth, além disso</p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#7fae8f]" strokeWidth={1.75} />
                <p className="text-sm text-[#ccc]">Google Calendar integrado</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Users2 className="w-4 h-4 text-[#7fae8f]" strokeWidth={1.75} />
                <p className="text-sm text-[#ccc]">Até 5 membros na equipe</p>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* planos */}
        <Section id="planos" className="bg-[#0D0D0D] border-y border-[#161616]">
          <Reveal className="max-w-lg mx-auto text-center mb-14">
            <h2 className="text-2xl md:text-[2rem] font-bold text-balance">Escolha o tamanho do seu time</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {PLANS.map((plan, i) => (
              <Reveal
                key={plan.name}
                delay={i * 0.1}
                className={`relative rounded-2xl p-7 border ${
                  plan.badge ? 'border-[#01573C] bg-gradient-to-b from-[#0F3D2B]/40 to-transparent' : 'border-[#212121]'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-7 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#01573C] text-white">
                    {plan.badge}
                  </span>
                )}
                <p className="text-sm text-[#999]">{plan.name}</p>
                <p className="mt-2 text-4xl font-extrabold tabular-nums">
                  R${plan.price}<span className="text-base font-medium text-[#777]">/mês</span>
                </p>
                <p className="mt-1 text-xs text-[#777]">{plan.members}</p>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-[#ccc] flex items-start gap-2.5">
                      <span className="text-[#7fae8f] mt-0.5 font-mono text-xs">＋</span>{f}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2} className="mt-10 text-center">
            <Button size="lg">Assinar o Zaapply</Button>
          </Reveal>
        </Section>

        {/* prova social */}
        <Section>
          <Reveal className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl md:text-[2rem] font-bold text-balance">Quem já usa o Zaapply vende mais rápido</h2>
            <div className="mt-8 rounded-2xl border border-dashed border-[#2a2a2a] p-8 text-sm text-[#666]">
              Aguardando depoimento ou logo real de cliente. Não preencher com prova social fictícia.
            </div>
          </Reveal>
        </Section>

        {/* cta final */}
        <Section className="pb-28">
          <Reveal className="rounded-3xl border border-[#212121] bg-gradient-to-br from-[#07261C] via-[#0A3728] to-[#0A0A0A] p-12 md:p-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-balance">A próxima mensagem que chegar,<br />alguém vai responder.</h2>
            <p className="mt-3 text-[#a8a8a8] max-w-md mx-auto">
              O Zaapply responde antes que esfrie, qualifica certo e passa a venda pra você fechar.
            </p>
            <div className="mt-8">
              <Button size="lg">Assinar o Zaapply</Button>
            </div>
          </Reveal>
        </Section>

        <SiteFooter />
      </div>
    </SmoothScrollProvider>
  );
}
