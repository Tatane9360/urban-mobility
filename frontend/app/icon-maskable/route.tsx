import { ImageResponse } from 'next/og';

// Android's maskable-icon safe zone is the centered ~80% circle — content
// outside it may be clipped by the launcher's mask shape, so the glyph is
// scaled down and padded relative to icon-512's plain square icon.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1E3A5F',
          color: '#fff',
          fontSize: 168,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        U
      </div>
    ),
    { width: 512, height: 512 },
  );
}
