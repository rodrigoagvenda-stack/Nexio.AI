import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - vend.AI",
  description: "Quem já queimou os barcos, entra por aqui. 🚀",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative">
      {/* Background com blur */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=2574&auto=format&fit=crop')`
        }}
      />
      <div className="absolute inset-0 bg-black/60" />

      {/* Conteúdo */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
