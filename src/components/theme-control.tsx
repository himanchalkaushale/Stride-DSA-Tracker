"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemePreference } from "./theme-provider";

const options: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Follow this device" },
  { value: "dark", label: "Dark", hint: "Use the dark palette" },
  { value: "light", label: "Light", hint: "Use the light palette" },
];

function ThemeGlyph({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  }
  if (preference === "dark") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8.3 8.3 0 0 1 8.6 4a8.3 8.3 0 1 0 11.4 11.4Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
}

export function ThemeMenu({ className = "" }: { className?: string }) {
  const { preference, theme, setPreference } = useTheme();
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const select = (value: ThemePreference) => {
    setPreference(value);
    setOpen(false);
  };

  return (
    <div
      className={`theme-menu ${open ? "is-open" : ""} ${className}`.trim()}
      ref={menu}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        className="theme-menu-trigger"
        aria-label={`Appearance: ${preference}, currently ${theme}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Appearance"
        onClick={() => setOpen((current) => !current)}
      >
        <ThemeGlyph preference={preference} />
      </button>
      {open && <div className="theme-menu-popover" role="menu" aria-label="Choose appearance">
        <span>Appearance</span>
        {options.map((option) => (
          <button
            type="button"
            role="menuitemradio"
            aria-checked={preference === option.value}
            onClick={() => select(option.value)}
            title={option.hint}
            key={option.value}
          >
            <ThemeGlyph preference={option.value} />
            <span><b>{option.label}</b><small>{option.hint}</small></span>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>}
    </div>
  );
}

export function AppearanceSettings() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="settings-section appearance-settings">
      <div><h2>Appearance</h2><p>Choose a palette or follow your operating system.</p></div>
      <div className="appearance-segmented" role="group" aria-label="Appearance">
        {options.map((option) => (
          <button
            type="button"
            aria-pressed={preference === option.value}
            onClick={() => setPreference(option.value)}
            title={option.hint}
            key={option.value}
          >
            <ThemeGlyph preference={option.value} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
