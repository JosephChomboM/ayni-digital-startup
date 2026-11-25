import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MusicPlayer, musicSource } from "./MusicPlayer";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("plays and pauses YouTube with the API and reports autoplay blocking", async () => {
  const player = { playVideo: vi.fn(), pauseVideo: vi.fn(), seekTo: vi.fn(), destroy: vi.fn(), setVolume: vi.fn() };
  let events: Record<string, (event: unknown) => void>;
  vi.stubGlobal("YT", { Player: class {
    constructor(_element: HTMLElement, options: { events: typeof events }) {
      events = options.events;
      queueMicrotask(() => events.onReady({ target: player }));
      return player;
    }
  } });
  const { rerender, unmount } = render(<MusicPlayer url="https://youtu.be/M7lc1UVf-VE" title="Canción familiar" paused={false} />);
  await waitFor(() => expect(player.playVideo).toHaveBeenCalledOnce());
  act(() => events.onStateChange({ data: 1 }));
  expect(screen.getByRole("status")).toHaveTextContent("Reproduciendo Canción familiar");
  fireEvent.click(screen.getByRole("button", { name: "Pausar música" }));
  expect(player.pauseVideo).toHaveBeenCalledOnce();
  act(() => events.onAutoplayBlocked({}));
  expect(screen.getByRole("status")).toHaveTextContent("El navegador pide");
  fireEvent.change(screen.getByLabelText("Volumen de la música"), { target: { value: "35" } });
  expect(player.setVolume).toHaveBeenLastCalledWith(35);
  rerender(<MusicPlayer url="https://youtu.be/M7lc1UVf-VE" title="Canción familiar" paused />);
  expect(player.pauseVideo).toHaveBeenCalledTimes(2);
  unmount();
  expect(player.destroy).toHaveBeenCalledOnce();
});

it("recognizes allowed providers and rejects lookalike domains", () => {
  expect(musicSource("https://open.spotify.com/track/1234567890123456789012")).toEqual({ provider: "spotify", id: "1234567890123456789012" });
  expect(musicSource("https://youtube.com.evil.test/watch?v=M7lc1UVf-VE")).toBeNull();
  expect(musicSource("javascript:alert(1)")).toBeNull();
});

it("waits for Spotify readiness and reflects its actual playback events", async () => {
  const listeners: Record<string, (event: { data: { isPaused: boolean; isBuffering: boolean } }) => void> = {};
  const control = { play: vi.fn(), pause: vi.fn(), restart: vi.fn(), destroy: vi.fn(), addListener: vi.fn((name, handler) => { listeners[name] = handler; }) };
  const { unmount } = render(<MusicPlayer url="https://open.spotify.com/track/1234567890123456789012" title="Canción familiar" paused={false} />);
  const callback = (window as unknown as { onSpotifyIframeApiReady: (api: unknown) => void }).onSpotifyIframeApiReady;
  await act(async () => callback({ createController: (_element: HTMLElement, _options: unknown, ready: (value: typeof control) => void) => ready(control) }));
  expect(control.play).not.toHaveBeenCalled();
  act(() => listeners.ready({ data: { isPaused: true, isBuffering: false } }));
  expect(control.play).toHaveBeenCalledOnce();
  act(() => listeners.playback_update({ data: { isPaused: false, isBuffering: false } }));
  expect(screen.getByRole("status")).toHaveTextContent("Reproduciendo Canción familiar");
  fireEvent.click(screen.getByRole("button", { name: "Pausar música" }));
  expect(control.pause).toHaveBeenCalledOnce();
  act(() => listeners.playback_update({ data: { isPaused: true, isBuffering: false } }));
  expect(screen.getByRole("status")).toHaveTextContent("Música en pausa");
  expect(screen.queryByLabelText("Volumen de la música")).not.toBeInTheDocument();
  unmount();
  expect(control.destroy).toHaveBeenCalledOnce();
});
