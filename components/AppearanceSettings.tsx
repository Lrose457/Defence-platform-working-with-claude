"use client";

import { startTransition, useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";
type Accent = "cyan" | "amber" | "rose" | "green" | "blue" | "violet" | "orange" | "lime";
type Filter = "standard" | "high-contrast" | "soft" | "mono";
type TextSize = "small" | "default" | "large";
type Density = "compact" | "default" | "comfortable";

type Preferences = {
  theme: Theme;
  accent: Accent;
  filter: Filter;
  textSize: TextSize;
  density: Density;
  reducedMotion: boolean;
};

const defaultPreferences: Preferences = {
  theme: "dark",
  accent: "cyan",
  filter: "standard",
  textSize: "default",
  density: "default",
  reducedMotion: false,
};
const accentOptions: { id: Accent; label: string; color: string }[] = [
  { id: "cyan", label: "Signal cyan", color: "#38bdf8" },
  { id: "amber", label: "Field amber", color: "#fbbf24" },
  { id: "rose", label: "Alert rose", color: "#fb7185" },
  { id: "green", label: "Ops green", color: "#4ade80" },
  { id: "blue", label: "Command blue", color: "#60a5fa" },
  { id: "violet", label: "Vector violet", color: "#a78bfa" },
  { id: "orange", label: "Beacon orange", color: "#fb923c" },
  { id: "lime", label: "Field lime", color: "#a3e635" },
];

export default function AppearanceSettings() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const loadedPreferences = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("defence-appearance");
    loadedPreferences.current = true;

    if (!stored) return;

    try {
      const saved = { ...defaultPreferences, ...JSON.parse(stored) } as Preferences;
      startTransition(() => setPreferences(saved));
    } catch {
      window.localStorage.removeItem("defence-appearance");
    }
  }, []);

  useEffect(() => {
    if (!loadedPreferences.current) return;
    window.localStorage.setItem("defence-appearance", JSON.stringify(preferences));
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.accent = preferences.accent;
    document.documentElement.dataset.filter = preferences.filter;
    document.documentElement.dataset.textSize = preferences.textSize;
    document.documentElement.dataset.density = preferences.density;
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
  }, [preferences]);

  const update = <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className={`appearance-root${open ? " is-open" : ""}`} data-theme={preferences.theme} data-accent={preferences.accent} data-filter={preferences.filter}>
      <button type="button" className="appearance-trigger" aria-expanded={open} aria-controls="appearance-panel" onClick={() => setOpen((current) => !current)}>
        <span className="appearance-trigger-mark" aria-hidden="true">Aa</span>
        <span>Appearance</span>
        <span className="appearance-trigger-state">{preferences.theme}</span>
      </button>

      {open ? (
        <section id="appearance-panel" className="appearance-panel" aria-label="Appearance settings">
          <div className="appearance-panel-heading">
            <div>
              <p className="appearance-kicker">Workspace display</p>
              <h2>Make it yours</h2>
            </div>
            <button type="button" className="appearance-close" onClick={() => setOpen(false)}>Close</button>
          </div>

          <fieldset className="appearance-fieldset">
            <legend>Mode</legend>
            <div className="appearance-segmented">
              {(["dark", "light"] as Theme[]).map((theme) => (
                <button key={theme} type="button" className={preferences.theme === theme ? "is-selected" : ""} aria-pressed={preferences.theme === theme} onClick={() => update("theme", theme)}>
                  {theme === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="appearance-fieldset">
            <legend>Signal colour</legend>
            <div className="appearance-swatches">
              {accentOptions.map((accent) => (
                <button key={accent.id} type="button" className={preferences.accent === accent.id ? "is-selected" : ""} aria-label={accent.label} aria-pressed={preferences.accent === accent.id} onClick={() => update("accent", accent.id)}>
                  <span style={{ backgroundColor: accent.color }} />
                  <small>{accent.label}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="appearance-fieldset">
            <legend>Colour filter</legend>
            <select value={preferences.filter} onChange={(event) => update("filter", event.target.value as Filter)}>
              <option value="standard">Standard</option>
              <option value="high-contrast">High contrast</option>
              <option value="soft">Soft focus</option>
              <option value="mono">Monochrome</option>
            </select>
          </fieldset>

          <div className="appearance-options-row">
            <label className="appearance-fieldset">
              <span>Text size</span>
              <select value={preferences.textSize} onChange={(event) => update("textSize", event.target.value as TextSize)}>
                <option value="small">Small</option>
                <option value="default">Default</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label className="appearance-fieldset">
              <span>Density</span>
              <select value={preferences.density} onChange={(event) => update("density", event.target.value as Density)}>
                <option value="compact">Compact</option>
                <option value="default">Default</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </label>
          </div>

          <label className="appearance-toggle">
            <span>Reduce motion</span>
            <input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => update("reducedMotion", event.target.checked)} />
          </label>
          <p className="appearance-note">Your choices are saved on this device.</p>
        </section>
      ) : null}
    </div>
  );
}