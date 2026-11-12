import { expect, it } from "vitest";
import { themeFor } from "./companionTheme";

it("usa el primer gusto reconocido para la ropa y hasta dos para la sala", () => {
  const theme = themeFor(["Boleros y música criolla", "jardinería", "su perrito Toby"]);
  expect(theme.outfit).toBe("music");
  expect(theme.decor).toEqual(["music", "garden"]);
});

it("reconoce gustos sin tildes ni mayúsculas", () => {
  expect(themeFor(["FUTBOL"]).outfit).toBe("football");
  expect(themeFor(["tejer a crochet"]).outfit).toBe("knitting");
  expect(themeFor(["leer el periódico"]).outfit).toBe("reading");
});

it("usa los recuerdos solo si los gustos no dicen nada y si no, deja el look de siempre", () => {
  expect(themeFor(["conversar"], ["Mis ollas preferidas"]).outfit).toBe("cooking");
  expect(themeFor(["cantar"], ["Mis ollas preferidas"]).outfit).toBe("music");
  expect(themeFor([], [])).toEqual({ outfit: null, decor: [], description: "" });
});
