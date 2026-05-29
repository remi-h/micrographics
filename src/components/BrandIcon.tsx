export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Micrographics Creator">
      <rect width="64" height="64" rx="12" fill="#101111" />
      <path d="M12 12h40v40H12z" fill="none" stroke="#f5f2ea" strokeWidth="2.5" />
      <path d="M20 12v40M32 12v40M44 12v40M12 20h40M12 32h40M12 44h40" stroke="#f5f2ea" strokeOpacity=".28" strokeWidth="1.4" />
      <path d="M13 32c5.2-9.2 12-13.8 19-13.8S45.8 22.8 51 32c-5.2 9.2-12 13.8-19 13.8S18.2 41.2 13 32z" fill="none" stroke="#55f0dc" strokeLinejoin="round" strokeWidth="2.8" />
      <circle cx="32" cy="32" r="7.5" fill="none" stroke="#f5f2ea" strokeWidth="2.4" />
      <circle cx="32" cy="32" r="2.8" fill="#f5f2ea" />
      <path d="M32 10v7M32 47v7M10 32h7M47 32h7" stroke="#ff4f3d" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}
