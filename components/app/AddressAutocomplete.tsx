"use client";

import { useEffect, useRef, useState } from "react";

// Address input with debounced suggestions (via /api/autocomplete). Emits the
// chosen label string — used for the "default address" fallback fields in the
// admin panel.
export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<{ label: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const suppressRef = useRef(false);

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    // Only fetch/open while the field is focused, so the list never pops up on
    // page load (when the saved value is populated programmatically).
    if (!focused) return;
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(value)}`, {
          signal: ac.signal,
        });
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted or network error */
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  function pick(label: string) {
    suppressRef.current = true;
    onChange(label);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setFocused(true);
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() =>
          setTimeout(() => {
            setFocused(false);
            setOpen(false);
          }, 150)
        }
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(suggestions[active].label);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.label);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  i === active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-slate-300">⌖</span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
