// The mark as Satori-compatible JSX, shared by the three icon generators
// (icon.tsx, icon-512, icon-maskable) so they can never drift into three
// different logos. Colours are literal here: ImageResponse renders outside the
// document, where CSS custom properties do not resolve.
//
// White on the brand navy, since these are always composited on their own
// background — the tile in a browser tab or on a home screen.
export function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <g fill="#ffffff">
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
        stroke="#f97316"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
