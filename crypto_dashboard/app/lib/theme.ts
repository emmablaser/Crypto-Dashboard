/**
 * Flips the `data-theme` attribute on <html> between light and dark.
 *
 * Theme is attribute-driven (set before paint by the script in root.tsx) and
 * not persisted, so it resets to the system preference on each load. Reading
 * the current value from the DOM keeps this correct even before React mounts.
 */
export function toggleTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
}
