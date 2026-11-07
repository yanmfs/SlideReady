export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" fill="var(--accent)" />
      <rect x="20" y="24" width="60" height="42" rx="6" fill="var(--accent-contrast)" />
      <path
        d="M36 52l9 9 19-22"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="42" y="70" width="16" height="6" rx="3" fill="var(--accent-contrast)" />
    </svg>
  );
}
