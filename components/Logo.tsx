// Schoolhouse mark — bell cupola, roof, arched door. Reused as the brand icon
// and on the "Home" buttons across the school list.
export function SchoolhouseMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="#12854c" />
      <rect x="14.5" y="5" width="3" height="4.2" fill="#ffffff" />
      <path d="M13.7 5 16 2.5 18.3 5Z" fill="#a5e635" />
      <path d="M7 17 16 9.4 25 17Z" fill="#a5e635" />
      <rect x="9" y="16" width="14" height="9" rx="1" fill="#ffffff" />
      <path d="M14.1 25v-4.1a1.9 1.9 0 0 1 3.8 0V25Z" fill="#12854c" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <SchoolhouseMark className="h-8 w-8" />
      <span className="text-[15px] font-extrabold leading-tight tracking-tight text-brand-700 sm:text-base">
        Dream Neighborhood
      </span>
    </span>
  );
}
