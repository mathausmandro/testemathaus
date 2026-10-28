import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma de Ensaios",
  description: "Plataforma para automatizar ensaios agronômicos, da casualização ao relatório técnico.",
};

// CSP com nonce por requisição (tarefa 017, src/proxy.ts): o Next só aplica o nonce aos scripts de
// páginas renderizadas na requisição. Uma casca estática pré-renderizada no build sairia sem nonce e
// seria bloqueada. Por isso o layout raiz espera a requisição (connection) e desliga a validação de
// casca estática do Cache Components para o app inteiro (instant = false). Decisão e alternativas
// (SRI com hash) em docs/seguranca/decisoes.md.
export const instant = false;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
