/** Titan SOC Academy mark — a geometric "T" within a precision ring. Original artwork. */
export function TitanMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id="tm-g" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0" stopColor="var(--accent-strong)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--surface-3)" stroke="var(--line-strong)" />
      <circle cx="20" cy="20" r="13" stroke="url(#tm-g)" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M11.5 13.5h17v3.6h-6.6V29h-3.8V17.1h-6.6z" fill="url(#tm-g)" />
    </svg>
  );
}

export function TitanWordmark() {
  return (
    <div className="flex items-center gap-3">
      <TitanMark />
      <div className="leading-none">
        <p className="text-[0.95rem] font-semibold tracking-[0.14em] text-fg">TITAN</p>
        <p className="mt-1 font-mono text-[0.625rem] tracking-[0.2em] text-fg-subtle">SOC ACADEMY</p>
      </div>
    </div>
  );
}
