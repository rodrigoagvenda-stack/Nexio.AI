'use client'

import React, { useRef } from 'react';
import { ArrowRight } from 'lucide-react';

interface Hero4Props {
    /** Small pill badge text above the heading */
    badgeText?: string;
    headingLine1?: string;
    headingLine2?: string;
    description?: string;
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
    /** Foto de fundo do hero. Sem imagem, cai num fundo escuro sólido. */
    backgroundImage?: string;
}

export default function Hero4({
    badgeText = '✦  SDR com IA para WhatsApp',
    headingLine1 = '23h de sexta. O lead manda mensagem.',
    headingLine2 = 'Ninguém responde até segunda.',
    description = 'O Zaapply é o SDR que atende no WhatsApp da sua empresa: responde, qualifica e chama seu vendedor na hora certa. A venda acontece na conversa, não em mais um sistema pra alguém abrir.',
    primaryCtaLabel = 'Assinar o Zaapply',
    primaryCtaHref = '#planos',
    secondaryCtaLabel = 'Ver como funciona',
    secondaryCtaHref = '#como-funciona',
    backgroundImage,
}: Hero4Props) {

    const line1Words = headingLine1.split(' ');
    const line2Words = headingLine2.split(' ');
    const sectionRef = useRef<HTMLElement>(null);

    // Spotlight que segue o mouse, via CSS custom properties (sem lib de animação)
    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        currentTarget.style.setProperty('--mx', `${clientX - left}px`);
        currentTarget.style.setProperty('--my', `${clientY - top}px`);
    }

    return (
        <section
            ref={sectionRef}
            className="relative w-full h-screen min-h-[700px] overflow-hidden bg-[#0A0A0A] group"
            onMouseMove={handleMouseMove}
        >

            {/* Foto de fundo, quando fornecida — zoom cinematico de entrada */}
            {backgroundImage && (
                <div className="absolute inset-0 hero-fx-zoom">
                    <img
                        src={backgroundImage}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                </div>
            )}

            {/* Layered gradient overlays */}
            <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0A]/90 via-[#0A0A0A]/40 to-[#0A0A0A]/20" />
            <div className="absolute inset-0 bg-linear-to-r from-[#0A0A0A]/50 via-transparent to-transparent" />

            {/* Noise texture */}
            <div
                className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '128px 128px',
                }}
            />

            {/* Mouse-tracking spotlight, CSS puro via custom properties */}
            <div
                className="pointer-events-none absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                    background: 'radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.05), transparent 80%)',
                }}
            />

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col h-full w-full">

                {/* Hero Content */}
                <div className="flex-1 flex flex-col justify-end px-6 md:px-10 lg:px-16 xl:px-24 pb-20 md:pb-28">
                    <div className="max-w-2xl">

                        {/* Badge pill */}
                        <div
                            className="inline-flex items-center mb-8 md:mb-10 hero-fx-up"
                            style={{ animationDelay: '0.5s' }}
                        >
                            <span className="relative inline-flex items-center px-4 py-1.5 rounded-full text-[12px] md:text-[13px] font-medium text-white/85 border border-white/15 bg-white/4 backdrop-blur-sm overflow-hidden">
                                <span className="absolute inset-0 -translate-x-full animate-[shimmer_3.5s_infinite] bg-linear-to-r from-transparent via-white/[0.07] to-transparent" />
                                <span className="relative">{badgeText}</span>
                            </span>
                        </div>

                        {/* Heading — word-by-word stagger via CSS */}
                        <h1 className="text-white text-[42px] sm:text-[54px] md:text-[64px] lg:text-[72px] font-light leading-[1.05] tracking-tight mb-6 md:mb-8">
                            <span className="block overflow-hidden">
                                {line1Words.map((word, i) => (
                                    <span
                                        key={i}
                                        className="inline-block mr-[0.3em] hero-fx-word"
                                        style={{ animationDelay: `${0.65 + i * 0.1}s` }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </span>
                            <span className="block overflow-hidden">
                                {line2Words.map((word, i) => (
                                    <span
                                        key={i}
                                        className="inline-block mr-[0.3em] hero-fx-word"
                                        style={{ animationDelay: `${0.95 + i * 0.1}s` }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </span>
                        </h1>

                        {/* Animated horizontal rule */}
                        <div
                            className="h-px bg-linear-to-r from-white/40 via-white/15 to-transparent mb-6 md:mb-7 max-w-sm hero-fx-rule"
                            style={{ animationDelay: '1.25s' }}
                        />

                        {/* Description */}
                        <p
                            className="text-white/55 text-sm md:text-[15px] leading-relaxed max-w-md mb-10 md:mb-12 hero-fx-up"
                            style={{ animationDelay: '1.35s' }}
                        >
                            {description}
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex items-center gap-4 md:gap-5">
                            {/* Primary — white filled pill */}
                            <a
                                href={primaryCtaHref}
                                className="relative bg-white text-[#0d0b0f] rounded-full px-7 py-3 text-[14px] font-semibold overflow-hidden group/btn hero-fx-up transition-transform duration-200 hover:scale-[1.04] active:scale-[0.96]"
                                style={{ animationDelay: '1.55s' }}
                            >
                                {/* Hover sweep — dark fills from bottom */}
                                <span className="absolute inset-0 bg-[#0d0b0f] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out rounded-full" />
                                <span className="relative z-10 group-hover/btn:text-white transition-colors duration-300">
                                    {primaryCtaLabel}
                                </span>
                            </a>

                            {/* Secondary — semi-transparent dark pill */}
                            <a
                                href={secondaryCtaHref}
                                className="flex items-center gap-2.5 bg-white/8 hover:bg-white/[0.14] backdrop-blur-sm border border-white/10 text-white rounded-full px-6 py-3 text-[14px] font-medium transition-all duration-300 group hero-fx-up hover:scale-[1.03] active:scale-[0.97]"
                                style={{ animationDelay: '1.7s' }}
                            >
                                {secondaryCtaLabel}
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/15 group-hover:bg-white/25 transition-colors">
                                    <ArrowRight size={12} strokeWidth={2} />
                                </span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="w-full px-6 md:px-10 lg:px-16 xl:px-24 pb-8 md:pb-10 flex items-end justify-between">
                    <div />

                    {/* Status ao vivo, sem prova social fabricada */}
                    <div className="flex items-center gap-2.5 hero-fx-up" style={{ animationDelay: '2s' }}>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#96F63C] opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#96F63C]" />
                        </span>
                        <p className="text-white/45 text-[13px] md:text-[14px] font-medium tracking-wide">
                            Respondendo agora, em tempo real
                        </p>
                    </div>
                </div>

            </div>

            {/* Decorative Corner Frame Lines */}
            <div className="absolute top-6 right-6 md:top-8 md:right-10 lg:right-16 w-12 h-12 pointer-events-none hidden md:block hero-fx-fade" style={{ animationDelay: '2.4s' }}>
                <span className="absolute top-0 right-0 w-full h-px bg-linear-to-l from-white/20 to-transparent" />
                <span className="absolute top-0 right-0 w-px h-full bg-linear-to-b from-white/20 to-transparent" />
            </div>

            <div className="absolute bottom-6 left-6 md:bottom-8 md:left-10 lg:left-16 w-12 h-12 pointer-events-none hidden md:block hero-fx-fade" style={{ animationDelay: '2.4s' }}>
                <span className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-white/20 to-transparent" />
                <span className="absolute bottom-0 left-0 w-px h-full bg-linear-to-t from-white/20 to-transparent" />
            </div>

            {/* CSS keyframes — animações de entrada sem depender de lib JS */}
            <style>{`
                @keyframes shimmer {
                    to { transform: translateX(200%); }
                }
                @keyframes hero-zoom {
                    from { opacity: 0; transform: scale(1.12); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes hero-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes hero-word {
                    from { opacity: 0; transform: translateY(120%); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes hero-rule {
                    from { transform: scaleX(0); }
                    to { transform: scaleX(1); }
                }
                @keyframes hero-fade {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .hero-fx-zoom { animation: hero-zoom 2.6s cubic-bezier(0.25, 0.1, 0.25, 1) both; }
                .hero-fx-up { animation: hero-up 0.7s ease-out both; }
                .hero-fx-word { animation: hero-word 0.85s cubic-bezier(0.33, 1, 0.68, 1) both; }
                .hero-fx-rule { transform-origin: left; animation: hero-rule 1.2s cubic-bezier(0.33, 1, 0.68, 1) both; }
                .hero-fx-fade { animation: hero-fade 1s ease-out both; }
                @media (prefers-reduced-motion: reduce) {
                    .hero-fx-zoom, .hero-fx-up, .hero-fx-word, .hero-fx-rule, .hero-fx-fade {
                        animation: none !important;
                        opacity: 1 !important;
                        transform: none !important;
                    }
                }
            `}</style>
        </section>
    );
}
