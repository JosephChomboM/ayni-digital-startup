import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("muestra el nombre de la app", () => {
    render(<App />);
    const elementosAyni = screen.getAllByText(/Ayni/i);
    expect(elementosAyni.length).toBeGreaterThan(0);
  });
});

