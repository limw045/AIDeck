"use client";
import { Icon } from "./symbols";

export function ThemeToggle() {
  function toggle() {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("gt-theme", theme); } catch { /* Theme remains usable without storage. */ }
  }
  return <button type="button" className="icon-button theme-toggle" onClick={toggle} aria-label="Toggle light and dark theme" title="Toggle light and dark theme"><Icon name="moon" className="theme-moon" /><Icon name="sun" className="theme-sun" /></button>;
}

