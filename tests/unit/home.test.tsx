import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("página inicial", () => {
  it("mostra o título em português", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Plataforma de Ensaios" }),
    ).toBeInTheDocument();
  });
});