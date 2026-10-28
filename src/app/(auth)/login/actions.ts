"use server";
// Ações públicas da tela de login. Não exigem sessão (é como ela é obtida), mas
// revalidam a configuração no servidor: botão desabilitado na tela não é segurança.
// Entrada validada com zod pelo utilitário compartilhado (src/lib/validation).
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getConfigDeLogin, origemDoSite, origemDosCabecalhos } from "@/lib/auth/config";
import { campoDeRetornoSchema } from "@/lib/auth/redirect";
import { credenciaisSchema, entrarComSenha, iniciarLoginMicrosoft } from "@/lib/data/auth";
import { createServerSupabase } from "@/lib/data/server/server-client";
import { lerFormulario, validarEntrada } from "@/lib/validation";

const retornoSchema = z.object({ next: campoDeRetornoSchema });

/** Destino depois do login: nunca falha, cai no padrão se o valor não for um caminho permitido. */
function lerRetorno(formData: FormData): string {
  return validarEntrada(retornoSchema, lerFormulario(formData, ["next"])).next;
}

export async function entrarComMicrosoft(formData: FormData): Promise<void> {
  const config = getConfigDeLogin();
  const next = lerRetorno(formData);
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
  const next = lerRetorno(formData);

  let ok = false;
  try {
    const credenciais = validarEntrada(credenciaisSchema, lerFormulario(formData, ["email", "senha"]));
    await entrarComSenha(await createServerSupabase(), credenciais);
    ok = true;
  } catch {
    ok = false; // mensagem única: não revela se o e-mail existe
  }
  if (!ok) redirect(`/login?erro=credenciais&next=${encodeURIComponent(next)}`);
  redirect(next);
}
