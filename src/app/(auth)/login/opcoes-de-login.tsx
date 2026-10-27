// Parte apresentacional da tela de login (sem dados nem acesso ao Supabase).
// Recebe as Server Actions por props para poder ser testada isoladamente.
import type { ConfigDeLogin } from "@/lib/auth/config";

type Acao = (formData: FormData) => void | Promise<void>;

export type OpcoesDeLoginProps = {
  config: Pick<ConfigDeLogin, "microsoftHabilitado" | "loginLocalPorSenha">;
  erro: string | null;
  next: string;
  acaoMicrosoft: Acao;
  acaoSenha: Acao;
};

const botao =
  "w-full rounded-md px-4 py-3 text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700";

export function OpcoesDeLogin({ config, erro, next, acaoMicrosoft, acaoSenha }: OpcoesDeLoginProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {erro && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {erro}
        </p>
      )}

      <form action={acaoMicrosoft} className="flex flex-col gap-2">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          disabled={!config.microsoftHabilitado}
          aria-describedby={config.microsoftHabilitado ? undefined : "aviso-microsoft"}
          className={`${botao} bg-blue-800 text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700`}
        >
          Entrar com a conta Microsoft
        </button>
        {!config.microsoftHabilitado && (
          <p id="aviso-microsoft" className="text-sm text-zinc-700 dark:text-zinc-300">
            O login com a conta Microsoft ainda não está configurado neste ambiente. Procure a coordenação.
          </p>
        )}
      </form>

      {config.loginLocalPorSenha && (
        <form action={acaoSenha} className="flex flex-col gap-3 border-t border-zinc-300 pt-6" aria-labelledby="titulo-login-local">
          <h2 id="titulo-login-local" className="text-base font-semibold">
            Login local de desenvolvimento
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Somente para os usuários de teste do ambiente local.</p>
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input name="email" type="email" required autoComplete="username" className="rounded-md border border-zinc-400 px-3 py-2 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Senha
            <input name="senha" type="password" required autoComplete="current-password" className="rounded-md border border-zinc-400 px-3 py-2 text-base" />
          </label>
          <button type="submit" className={`${botao} border border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
            Entrar com e-mail e senha
          </button>
        </form>
      )}
    </div>
  );
}
