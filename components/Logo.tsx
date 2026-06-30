export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* Official Dream Neighborhood wordmark (same logo + font as dreamneighborhood.com) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dn-nav-logo.svg"
        alt="Dream Neighborhood"
        className="h-7 w-auto sm:h-8"
      />
    </span>
  );
}
