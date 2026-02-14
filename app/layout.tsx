import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { KeepAlive } from "@/components/KeepAlive";

export const metadata: Metadata = {
  title: "nexio.ai - CRM Inteligente com IA",
  description: "Sistema completo de CRM com automação e inteligência artificial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-roboto antialiased">
        {children}
        <Toaster />
        <KeepAlive />
      </body>
    </html>
  );
}
