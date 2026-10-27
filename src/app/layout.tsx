import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma de Ensaios",
  description: "Plataforma para automatizar ensaios agronÃ´micos, da casualizaÃ§Ã£o ao relatÃ³rio tÃ©cnico.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}