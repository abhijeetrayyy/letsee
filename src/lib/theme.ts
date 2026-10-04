/**
 * Light or dark, for the whole app (docs/design/SYSTEM.md §1). Light is the
 * default; the choice lives on the device. `data-theme="dark"` on <html>
 * switches every token at once (src/design/tokens.css); the bands films are
 * shown on carry it themselves and are dark either way.
 *
 * The root layout sets the attribute before first paint (THEME_SCRIPT), so a
 * dark choice never flashes light.
 */
import { TOKENS, TOKENS_DARK } from "@/design/tokens";

export type Theme = "light" | "dark";

/** The page colour of each palette, for the browser's own bar (`theme-color`). */
const LIGHT_PAGE = TOKENS.page;
const DARK_PAGE = TOKENS_DARK.page;
export const THEME_KEY = "letsee:theme";

/** Runs in <head> before the page paints. Kept tiny and dependency-free. */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark"){document.documentElement.setAttribute("data-theme","dark");document.addEventListener("DOMContentLoaded",function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${DARK_PAGE}")})}}catch(e){}`;

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? DARK_PAGE : LIGHT_PAGE);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Remembered for this visit only.
  }
}

/** Whether the app is dark right now — for colours JS has to compute (charts, the diary calendar). */
export function isDarkTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
}
