import { expect, it } from "vitest";
import { lookFor } from "./companionTheme";

it("arma un look de respaldo con el primer gusto y un objeto del segundo", () => {
  const look = lookFor(["Boleros y música criolla", "jardinería", "su perrito Toby"]);
  expect(look?.hat).toBe("fedora");
  expect(look?.decor.map((item) => item.icon)).toEqual(["guitar", "flower-2"]);
});

it("reconoce gustos sin tildes ni mayúsculas y prioriza la primera palabra", () => {
  expect(lookFor(["FUTBOL"])?.body).toBe("sash");
  expect(lookFor(["cocina criolla"])?.hat).toBe("chef");
  expect(lookFor(["leer el periódico"])?.glasses).toBe(true);
});

it("usa los recuerdos solo si los gustos no dicen nada y si no, deja el look de siempre", () => {
  expect(lookFor(["conversar"], ["Mis ollas preferidas"])?.hat).toBe("chef");
  expect(lookFor(["cantar"], ["Mis ollas preferidas"])?.hat).toBe("fedora");
  expect(lookFor([], [])).toBeNull();
});
