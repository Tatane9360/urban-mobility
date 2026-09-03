// The mark as Satori-compatible JSX, shared by the three icon generators
// (icon.tsx, icon-512, icon-maskable) so they can never drift into three
// different logos. Colours are literal: ImageResponse renders outside the
// document, where CSS custom properties do not resolve.
//
// The arc is white rather than the logo's navy, because these tiles are
// composited on that same navy — navy on navy would be invisible. The green
// path is unchanged; it reads on the dark tile at 6.2:1.
export function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <g
        fill="none"
        stroke="#ffffff"
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
        stroke="#7aba8e"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
