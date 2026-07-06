"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export const POPUP_SNIPPET = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

export const INLINE_SNIPPET = `<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 px-4 py-3.5 pr-12 text-[13px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        aria-label="Copy code"
        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
