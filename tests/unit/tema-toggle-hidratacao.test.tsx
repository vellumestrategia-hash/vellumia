import { act, cleanup, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme/theme-toggle";

vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));
vi.mock("react-hotkeys-hook", () => ({ useHotkeys: vi.fn() }));
afterEach(cleanup);

it("restaura tema salvo sem divergir do HTML do servidor", async () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<ThemeToggle />);
  expect(container.querySelector("button")).toHaveAttribute(
    "aria-label",
    "Tema: system. Cmd+Shift+L para alternar.",
  );
  document.body.appendChild(container);
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <ThemeToggle />, { onRecoverableError });
  });
  expect(
    screen.getByRole("button", { name: "Tema: dark. Cmd+Shift+L para alternar." }),
  ).toBeVisible();
  expect(onRecoverableError).not.toHaveBeenCalled();
  await act(async () => root!.unmount());
  container.remove();
});
