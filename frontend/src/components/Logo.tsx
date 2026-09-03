import Link from 'next/link';

// The one lockup this app has — shared so AppHeader and AuthForm never
// render two different marks for the same brand.
//
// The mark is inlined rather than pulled from /logo-mark.svg through an <img>:
// the arc reads from --logo-arc, and CSS custom properties do not cross into
// an external image, so a linked file would keep the navy that scores 1.75
// against the dark background. public/logo-mark.svg holds the same artwork for
// anything outside the app.
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <svg
        viewBox="0 0 64 64"
        width={26}
        height={26}
        aria-hidden="true"
        className="shrink-0"
      >
        <g
          fill="none"
          stroke="var(--logo-arc)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 24 20 16h24l8 8" />
          <path d="M18 24h28" />
          <path d="M12 24v25" />
          <path d="M51 24v25" />
          <path d="M20 27v22" />
          <path d="M44 27v22" />
          <path d="M15.5 44v-8a1.6 1.6 0 0 1 3.2 0v8" />
          <path d="M45.3 44v-8a1.6 1.6 0 0 1 3.2 0v8" />
          <path d="M25 49V36a7 7 0 0 1 14 0v13" />
          <path d="M10 53h8" />
          <path d="M41 53h13" />
        </g>
        <path
          d="M8 56c8 1 14-1 18-6s-3-8 1-12 8-3 12-4 8 0 14-1"
          fill="none"
          stroke="var(--logo-route)"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        UrbanFlow
      </span>
    </Link>
  );
}
