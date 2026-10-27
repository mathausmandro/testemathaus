"use server";
// Sair: encerra a sessão no Supabase Auth e apaga os cookies, mesmo que o Auth esteja fora do ar.
import { redirect } from "next/navigation";
import { sair } from "@/lib/data/auth";
import { createServerSupabase, limparCookiesDaSessao } from "@/lib/data/server/server-client";

export async function sairDaConta(): Promise<void> {
  try {
    await sair(await createServerSupabase());
  } catch {
    // segue para a limpeza local
  }
  try {
    await limparCookiesDaSessao();
  } catch {
    // sem cookies para limpar
  }
  redirect("/login");
}
