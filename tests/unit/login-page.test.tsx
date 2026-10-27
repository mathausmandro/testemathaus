import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpcoesDeLogin } from "@/app/(auth)/login/opcoes-de-login";

afterEach(cleanup);

const acoes = { acaoMicrosoft: vi.fn(), acaoSenha: vi.fn() };

describe("tela de login", () => {
  it("sem provedor configurado: botão desabilitado com aviso explicando", () => {
    render(<OpcoesDeLogin config={{ microsoftHabilitado: false, loginLocalPorSenha: false }} erro={null} next="/inicio" {...acoes} />);
    const botao = screen.getByRole("button", { name: "Entrar com a conta Microsoft" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(/ainda não está configurado/);
  });

  it("com provedor configurado: botão habilitado e sem aviso", () => {
    render(<OpcoesDeLogin config={{ microsoftHabilitado: true, loginLocalPorSenha: false }} erro={null} next="/inicio" {...acoes} />);
    expect(screen.getByRole("button", { name: "Entrar com a conta Microsoft" })).toBeEnabled();
    expect(screen.queryByText(/ainda não está configurado/)).toBeNull();
  });

  it("formulário de senha só aparece no modo local", () => {
    const { rerender } = render(
      <OpcoesDeLogin config={{ microsoftHabilitado: false, loginLocalPorSenha: false }} erro={null} next="/inicio" {...acoes} />,
    );
    expect(screen.queryByLabelText("Senha")).toBeNull();
    rerender(<OpcoesDeLogin config={{ microsoftHabilitado: false, loginLocalPorSenha: true }} erro={null} next="/inicio" {...acoes} />);
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Entrar com e-mail e senha" })).toBeInTheDocument();
  });

  it("mostra o erro em alerta e repassa o next validado", () => {
    const { container } = render(
      <OpcoesDeLogin config={{ microsoftHabilitado: true, loginLocalPorSenha: true }} erro="E-mail ou senha inválidos." next="/ensaios" {...acoes} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    const nexts = [...container.querySelectorAll('input[name="next"]')].map((i) => (i as HTMLInputElement).value);
    expect(nexts).toEqual(["/ensaios", "/ensaios"]);
  });
});
