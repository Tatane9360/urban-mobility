import { ImageResponse } from 'next/og';
import { LogoMark } from '../logo-mark';

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
        }}
      >
        <LogoMark size={396} />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
