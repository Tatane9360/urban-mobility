import { ImageResponse } from 'next/og';

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
          fontSize: 288,
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
