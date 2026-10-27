"use server";
// Ações públicas da tela de login. Não exigem sessão (é como ela é obtida), mas
// revalidam a configuração no servidor: botão desabilitado na tela não é segurança.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfigDeLogin, origemDoSite, origemDosCabecalhos } from "@/lib/auth/config";
import { caminhoDeRetornoSeguro } from "@/lib/auth/redirect";
import { entrarComSenha, iniciarLoginMicrosoft } from "@/lib/data/auth";
import { createServerSupabase } from "@/lib/data/server/server-client";

function texto(v: FormDataEntryValue | null): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function entrarComMicrosoft(formData: FormData): Promise<void> {
  const config = getConfigDeLogin();
  const next = caminhoDeRetornoSeguro(texto(formData.get("next")));
  if (!config.microsoftHabilitado) redirect("/login?erro=indisponivel");

  const h = await headers();
  const callback = new URL("/auth/callback", origemDoSite(config, origemDosCabecalhos((n) => h.get(n))));
  callback.searchParams.set("next", next);

  let urlDeAutorizacao: string | null = null;
  try {
    urlDeAutorizacao = await iniciarLoginMicrosoft(await createServerSupabase(), callback.toString());
  } catch {
    urlDeAutorizacao = null;
  }
  if (!urlDeAutorizacao) redirect("/login?erro=indisponivel");
  redirect(urlDeAutorizacao);
}

export async function entrarComSenhaLocal(formData: FormData): Promise<void> {
  const config = getConfigDeLogin();
  // Fora do ambiente local o modo não existe, mesmo que alguém poste o formulário direto.
  if (!config.loginLocalPorSenha) redirect("/login?erro=indisponivel");
  const next = caminhoDeRetornoSeguro(texto(formData.get("next")));

  let ok = false;
  try {
    await entrarComSenha(await createServerSupabase(), { email: formData.get("email"), senha: formData.get("senha") });
    ok = true;
  } catch {
    ok = false; // mensagem única: não revela se o e-mail existe
  }
  if (!ok) redirect(`/login?erro=credenciais&next=${encodeURIComponent(next)}`);
  redirect(next);
}
