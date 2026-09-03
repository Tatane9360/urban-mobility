import { ImageResponse } from 'next/og';
import { LogoMark } from './logo-mark';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
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
        <LogoMark size={148} />
      </div>
    ),
    size,
  );
}
