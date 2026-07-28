import Link from 'next/link';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1A1A1A] bg-[#0A0A0A]/85 backdrop-blur">
      <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
        <Link href="/">
          <ZaapliLogo theme="dark" iconSize={26} />
        </Link>
        <Link href="/login">
          <Button variant="outline" size="sm">Entrar</Button>
        </Link>
      </div>
    </header>
  );
}
