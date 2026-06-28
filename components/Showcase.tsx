// Landing showcase: a friendly schools/kids scene with sample "data bubbles"
// demonstrating what the explorer surfaces for every address.

function Bubble({
  label,
  value,
  color,
  className,
}: {
  label: string;
  value: string;
  color: string;
  className: string;
}) {
  return (
    <div
      className={`absolute flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur-sm ${className}`}
    >
      <span className="h-7 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">
          {label}
        </span>
        <span className="block text-sm font-extrabold sm:text-base" style={{ color }}>
          {value}
        </span>
      </span>
    </div>
  );
}

export function Showcase() {
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/showcase.png"
          alt="Neighborhood with a school and children"
          className="aspect-[2/1] w-full object-cover object-[center_72%]"
        />

        {/* Sample data bubbles (illustrative values) over the open sky */}
        <Bubble label="Academic rating" value="9 / 10" color="#059669" className="left-[3%] top-[5%]" />
        <Bubble
          label="Graduation rate"
          value="91%"
          color="#12854c"
          className="left-[37%] top-[3%] hidden sm:flex"
        />
        <Bubble label="Safety score" value="8 / 10" color="#65a30d" className="right-[3%] top-[5%]" />
        <Bubble
          label="Test scores"
          value="78% proficient"
          color="#1fa55f"
          className="left-[6%] top-[34%] hidden sm:flex"
        />
        <Bubble
          label="Student-teacher"
          value="15 : 1"
          color="#0f6a3f"
          className="right-[5%] top-[36%] hidden sm:flex"
        />
      </div>
      <p className="mx-auto mt-3 max-w-xl px-2 text-center text-sm text-slate-500">
        Search any address to see{" "}
        <strong className="text-slate-700">
          real ratings, test scores, graduation, and safety data
        </strong>{" "}
        for every nearby public &amp; private school.
        <span className="block text-[11px] text-slate-400">Sample values shown.</span>
      </p>
    </div>
  );
}
