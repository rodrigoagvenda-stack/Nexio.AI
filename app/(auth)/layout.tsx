import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "nexio.ai",
  description: "Sistema completo de CRM com automação e inteligência artificial",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
