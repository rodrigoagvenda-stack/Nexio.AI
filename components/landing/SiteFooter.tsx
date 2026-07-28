import Link from 'next/link';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { ShieldCheck } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-[#141414] bg-[#0A0A0A]">
      <div className="mx-auto max-w-5xl px-6 py-14 grid sm:grid-cols-[1.4fr_1fr_1fr] gap-10">
        <div>
          <ZaapliLogo theme="dark" iconSize={24} />
          <p className="mt-3 text-sm text-[#666] max-w-[26ch]">SDR com IA que atende no WhatsApp da sua empresa.</p>
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-[#666] mb-4">Privacidade</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/privacidade" className="text-[#999] hover:text-white transition-colors">Política de Privacidade</Link></li>
            <li><Link href="/termos" className="text-[#999] hover:text-white transition-colors">Termos de Uso</Link></li>
            <li><Link href="/protecao-de-dados" className="text-[#999] hover:text-white transition-colors">Proteção de Dados (LGPD)</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-[#666] mb-4">Recursos</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/blog" className="text-[#999] hover:text-white transition-colors">Blog</Link></li>
            <li><Link href="/faq" className="text-[#999] hover:text-white transition-colors">Perguntas frequentes</Link></li>
            <li><Link href="/ajuda" className="text-[#999] hover:text-white transition-colors">Central de Ajuda</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#141414] px-6 py-5">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-xs text-[#555]">
          <span>&copy; {new Date().getFullYear()} Zaapply</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> PT-BR</span>
        </div>
      </div>
    </footer>
  );
}
