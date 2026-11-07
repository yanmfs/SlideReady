export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" fill="#DC4A12" />
      <rect x="15" y="24" width="70" height="42" rx="6" fill="#FFFFFF" />
      <path
        d="M36 46l10 10 20-22"
        fill="none"
        stroke="#DC4A12"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="37" y="73" width="26" height="6" rx="3" fill="#FFFFFF" />
    </svg>
  );
}
