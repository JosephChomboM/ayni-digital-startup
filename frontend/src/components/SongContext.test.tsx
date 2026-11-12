import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SongContext } from "./SongContext";
import { getSongContext, confirmSongContext } from "../api/songContext";

vi.mock("../api/songContext", () => ({ getSongContext: vi.fn(), confirmSongContext: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("permite precisar artista, confirmar la grabación y consultar la fuente", async () => {
  const recording = { recording_id: "recording", title: "Canción", artist: "Artista", year: 1987, genres: ["pop"], source_url: "https://musicbrainz.org/recording/recording" };
  vi.mocked(getSongContext).mockResolvedValueOnce({ status: "unavailable" }).mockResolvedValueOnce({ status: "needs_confirmation", candidates: [recording] });
  vi.mocked(confirmSongContext).mockResolvedValue({ status: "confirmed", ...recording });
  render(<SongContext memoryId="memory" />);
  await screen.findByText(/No hay datos confirmados/);
  fireEvent.change(screen.getByLabelText("Artista y canción (opcional)"), { target: { value: "Artista - Canción" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar artista, año y género" }));
  fireEvent.click(await screen.findByRole("button", { name: "Es esta grabación" }));
  await screen.findByText("Año de la grabación: 1987");
  expect(getSongContext).toHaveBeenLastCalledWith("memory", true, "Artista - Canción");
  expect(confirmSongContext).toHaveBeenCalledWith("memory", "recording");
  expect(screen.getByRole("link", { name: "Fuente: MusicBrainz" })).toHaveAttribute("href", recording.source_url);
});

it("muestra el error de consulta y permite reintentar", async () => {
  vi.mocked(getSongContext).mockResolvedValueOnce({ status: "unavailable" }).mockRejectedValueOnce(new Error("Servicio no disponible"));
  render(<SongContext memoryId="memory" />);
  await screen.findByText(/No hay datos confirmados/);
  fireEvent.click(screen.getByRole("button", { name: "Buscar artista, año y género" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
  await waitFor(() => expect(screen.getByRole("button", { name: "Buscar artista, año y género" })).toBeEnabled());
});
