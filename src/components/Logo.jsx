// Two overlapping circles -- the "match" in Reel Match -- reused wherever
// the brand needs to show up (headers, loading screens). Kept as one small
// component rather than inlined everywhere so the mark stays consistent.
export default function Logo({ size = 28, withWordmark = true }) {
  return (
    <div className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-1)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx="13" cy="16" r="10" fill="url(#logo-g)" fillOpacity="0.9" />
        <circle cx="19" cy="16" r="10" fill="url(#logo-g)" fillOpacity="0.9" />
      </svg>
      {withWordmark && <span className="logo-wordmark">Reel Match</span>}
    </div>
  );
}
