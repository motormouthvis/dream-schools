export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#12854c" />
        {/* house */}
        <path d="M9 16.5 16 11l7 5.5V23a1 1 0 0 1-1 1h-3v-4h-6v4h-3a1 1 0 0 1-1-1v-6.5Z" fill="#fff" />
        <path d="M16 9.2 7.5 16l1.2 1.5L16 11.8l7.3 5.7 1.2-1.5L16 9.2Z" fill="#a5e635" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[13px] font-extrabold tracking-tight text-brand-700 sm:text-sm">
          Dream Neighborhood
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          School Explorer
        </span>
      </span>
    </span>
  );
}
