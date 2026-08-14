import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';

export interface Footer18Props {
    newsletterHeading?: string;
    newsletterPlaceholder?: string;
    brandName?: string;
    features?: { label: string; href: string }[];
    recites?: { label: string; href: string }[];
    pricing?: { label: string; href: string }[];
    exploreText?: string;
    exploreHref?: string;
    trialText?: string;
    trialHref?: string;
    address?: React.ReactNode;
    bottomNav?: { label: string; href: string }[];
    socialLinks?: { label: string; href: string }[];
}

export default function Footer18({
    newsletterHeading = "Assine nossa\nnewsletter",
    newsletterPlaceholder = "Seu e-mail",
    brandName = "Zaapply",
    features = [
        { label: "SDR com IA", href: "#como-funciona" },
        { label: "CRM Kanban", href: "#diferencial" },
        { label: "Atendimento via chat", href: "#diferencial" },
        { label: "Google Calendar (Growth)", href: "#planos" },
    ],
    recites = [
        { label: "Blog", href: "/blog" },
        { label: "Perguntas frequentes", href: "/faq" },
        { label: "Central de Ajuda", href: "/ajuda" },
    ],
    pricing = [
        { label: "Política de Privacidade", href: "/privacidade" },
        { label: "Termos de Uso", href: "/termos" },
        { label: "Proteção de Dados (LGPD)", href: "/protecao-de-dados" },
    ],
    exploreText = "Assinar o Zaapply",
    exploreHref = "#planos",
    trialText = "Assinar o Zaapply",
    trialHref = "#planos",
    address,
    bottomNav = [
        { label: "COMO FUNCIONA", href: "#como-funciona" },
        { label: "DIFERENCIAL", href: "#diferencial" },
        { label: "PLANOS", href: "#planos" },
        { label: "FAQ", href: "/faq" },
        { label: "BLOG", href: "/blog" },
    ],
    socialLinks = [
        { label: "INSTAGRAM", href: "#" },
        { label: "LINKEDIN", href: "#" },
    ],
}: Footer18Props) {

    return (
        <footer className="relative w-full bg-neutral-950/70 text-neutral-400 font-sans overflow-hidden min-h-screen flex flex-col justify-between">
            {/* Noise Background */}
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            <div className="relative z-10 max-w-[1500px] w-full mx-auto px-6 md:px-12 lg:px-20 xl:px-24 pt-16 md:pt-20 flex flex-col">

                {/* Top Section */}
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-12">

                    {/* Left: Newsletter Box */}
                    <Reveal delay={0.05} className="w-full lg:w-[450px] shrink-0 bg-[#171717] border border-transparent rounded-md p-6 md:p-8 flex flex-col justify-between min-h-[300px] md:min-h-[420px]">
                        <h2 className="text-3xl md:text-4xl text-neutral-400 font-medium tracking-tight whitespace-pre-line leading-[1.1]">
                            {newsletterHeading}
                        </h2>

                        <form className="relative w-full mt-12 md:mt-16" onSubmit={(e) => e.preventDefault()}>
                            <input
                                type="email"
                                placeholder={newsletterPlaceholder}
                                className="w-full bg-transparent border-b border-neutral-500 pb-4 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 pr-10 text-sm"
                                required
                            />
                            <button
                                type="submit"
                                className="absolute right-0 top-0 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer pb-4 flex items-center justify-center"
                            >
                                <ArrowRight size={20} />
                            </button>
                        </form>
                    </Reveal>

                    {/* Right: Columns */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 md:gap-8 pt-4">

                        {/* Column 1: Features & CTA */}
                        <Reveal delay={0.1} className="flex flex-col gap-10 md:gap-12">
                            <div className="flex flex-col gap-4">
                                <h4 className="font-medium text-neutral-200">Produto</h4>
                                <ul className="flex flex-col gap-3">
                                    {features.map((link, idx) => (
                                        <li key={idx}>
                                            <a href={link.href} className="text-[15px] text-neutral-400 hover:text-neutral-200 transition-colors">
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex flex-col gap-6 mt-2 md:mt-4">
                                <a
                                    href={trialHref}
                                    className="inline-flex items-center justify-center w-fit px-6 py-3 rounded-full bg-[#01573C] text-[#d8d8d8] text-sm font-semibold hover:bg-[#01573C]/90 transition-colors [box-shadow:0_2px_0_0_#07261C] active:translate-y-px active:[box-shadow:none]"
                                >
                                    {trialText}
                                </a>
                                {address && (
                                    <p className="text-sm text-neutral-500 leading-relaxed max-w-2xl">
                                        {address}
                                    </p>
                                )}
                            </div>
                        </Reveal>

                        {/* Column 2: Recursos */}
                        <Reveal delay={0.15} className="flex flex-col gap-4">
                            <h4 className="font-medium text-neutral-200">Recursos</h4>
                            <ul className="flex flex-col gap-3">
                                {recites.map((link, idx) => (
                                    <li key={idx}>
                                        <a href={link.href} className="text-[15px] text-neutral-400 hover:text-neutral-200 transition-colors">
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </Reveal>

                        {/* Column 3: Privacidade & Explore */}
                        <Reveal delay={0.2} className="flex flex-col justify-between gap-12 h-full">
                            <div className="flex flex-col gap-4">
                                <h4 className="font-medium text-neutral-200">Privacidade</h4>
                                <ul className="flex flex-col gap-3">
                                    {pricing.map((link, idx) => (
                                        <li key={idx}>
                                            <a href={link.href} className="text-[15px] text-neutral-400 hover:text-neutral-200 transition-colors">
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-8 md:mt-auto">
                                <a
                                    href={exploreHref}
                                    className="inline-flex items-center gap-2 text-[22px] text-neutral-300 hover:text-white transition-colors group"
                                >
                                    {exploreText}
                                    <ArrowUpRight size={22} className="text-neutral-500 group-hover:text-white transition-colors" />
                                </a>
                            </div>
                        </Reveal>

                    </div>
                </div>

            </div>

            {/* Bottom Section */}
            <div className="relative z-10 w-full flex flex-col mt-auto">
                <div className="max-w-[1500px] w-full mx-auto px-6 md:px-12 lg:px-20 xl:px-24 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8 md:mb-4">

                    <Reveal delay={0.05} y={12} className="flex flex-wrap gap-x-8 gap-y-4">
                        {bottomNav.map((link, idx) => (
                            <a
                                key={idx}
                                href={link.href}
                                className="text-[11px] font-medium tracking-widest text-neutral-400 hover:text-neutral-200 transition-colors uppercase"
                            >
                                {link.label}
                            </a>
                        ))}
                    </Reveal>

                    <Reveal delay={0.1} y={12} className="flex flex-wrap gap-x-8 gap-y-4">
                        {socialLinks.map((link, idx) => (
                            <a
                                key={idx}
                                href={link.href}
                                className="text-[11px] font-medium tracking-widest text-neutral-400 hover:text-neutral-200 transition-colors uppercase flex items-center gap-1.5 group"
                            >
                                {link.label}
                                <ArrowUpRight size={12} className="text-neutral-600 group-hover:text-neutral-200 transition-colors" />
                            </a>
                        ))}
                    </Reveal>

                </div>

                {/* Giant Brand Name */}
                <Reveal delay={0.15} y={30} blur={8} className="w-full flex justify-center">
                    <svg
                        className="w-full h-auto select-none"
                        viewBox={`0 0 ${Math.max(brandName.length * 90, 400)} 110`}
                        preserveAspectRatio="xMidYMid meet"
                        aria-label={brandName}
                    >
                        <text
                            x="0"
                            y="105"
                            dominantBaseline="alphabetic"
                            textAnchor="start"
                            textLength="100%"
                            lengthAdjust="spacing"
                            className="fill-white/20 font-bold tracking-tighter"
                            fontSize="140"
                        >
                            {brandName.toUpperCase()}
                        </text>
                    </svg>
                </Reveal>
            </div>
        </footer>
    );
}
