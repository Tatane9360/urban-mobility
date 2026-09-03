import Link from 'next/link';

// The one lockup this app has — shared so AppHeader and AuthForm never
// render two different marks for the same brand.
//
// The mark is inlined rather than pulled from /logo-mark.svg through an <img>:
// the arc reads from --logo-arc, and CSS custom properties do not cross into
// an external image, so a linked file would stay navy on the dark theme.
// public/logo-mark.svg holds the same artwork for anything outside the app.
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <svg
        viewBox="0 0 64 64"
        width={24}
        height={24}
        aria-hidden="true"
        className="shrink-0"
      >
        <g fill="var(--logo-arc)">
          <path d="M9 18h46v6H9z" />
          <path d="M15 9h34l6 8H9z" />
          <path d="M12 24h9v25h-9z" />
          <path d="M43 24h9v25h-9z" />
          <path d="M21 40a11 11 0 0 1 22 0v9h-6v-9a5 5 0 0 0-10 0v9h-6z" />
          <path d="M7 49h50v5H7z" />
        </g>
        <path
          d="M14 58c6 0 8-7 18-7s12-7 18-7"
          fill="none"
          stroke="var(--logo-route)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        UrbanFlow
      </span>
    </Link>
  );
}
