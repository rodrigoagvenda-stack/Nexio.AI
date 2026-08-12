import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { KeepAlive } from "@/components/KeepAlive";
import { CookieBanner } from "@/components/lgpd/CookieBanner";
import { PwaInit } from "@/components/PwaInit";

export const metadata: Metadata = {
  title: "Zaapply: CRM Inteligente com IA",
  description: "Sistema completo de CRM com automação e inteligência artificial",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zaapply",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <meta name="theme-color" content="#01573C" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zaapply" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-roboto antialiased">
        {children}
        <Toaster />
        <KeepAlive />
        <CookieBanner />
        <PwaInit />

        {/* ── Google Analytics ─────────────────────────────────────────────── */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              `}
            </Script>
          </>
        )}

        {/* ── Hotjar ───────────────────────────────────────────────────────── */}
        {HOTJAR_ID && (
          <Script id="hotjar-init" strategy="afterInteractive">
            {`
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
