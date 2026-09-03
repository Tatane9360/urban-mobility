'use client';

import { useEffect, useState } from 'react';

// Covers the gap the app already had: AuthProvider blocks the header nav while
// it checks the stored token, so the first paint was a half-drawn header —
// logo present, navigation missing — that then popped into place.
//
// It is tied to that check and nothing else: no minimum duration, no timer. On
// a warm load it is gone in ~100ms and the animation simply does not get far,
// which is the correct outcome. MOTION_INTENSITY 2 rules out decorative motion,
// and a splash that outlives its own reason for existing is exactly that.
const EXIT_MS = 260;

export function BootSplash({ done }: { done: boolean }) {
  // Kept mounted one transition past `done` so the fade-out can play; unmounted
  // after, so nothing sits over the app holding a paint layer.
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [done]);

  if (!mounted) return null;

  return (
    <div
      // aria-hidden with no role: this is a paint-over of content that is
      // already in the DOM behind it. Announcing "loading" would make a
      // screen reader wait for something its user never sees.
      aria-hidden="true"
      data-leaving={done ? '' : undefined}
      className="fixed inset-0 z-[3000] grid place-items-center bg-background transition-opacity duration-[260ms] ease-out data-leaving:pointer-events-none data-leaving:opacity-0 motion-reduce:transition-none"
    >
      <svg
        viewBox="0 0 64 64"
        className="w-40 sm:w-48 [animation:boot-arc_320ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none"
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
        {/* The route draws itself left to right. The motion is the product's
            own subject — a journey being traced — rather than a spinner
            standing in for one. pathLength normalises the dash values so they
            do not depend on the curve's measured length. */}
        <path
          d="M8 56c8 1 14-1 18-6s-3-8 1-12 8-3 12-4 8 0 14-1"
          fill="none"
          stroke="var(--logo-route)"
          strokeWidth="2.8"
          strokeLinecap="round"
          pathLength={1}
          className="[stroke-dasharray:1] [animation:boot-route_900ms_cubic-bezier(0.22,1,0.36,1)_120ms_both] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
        />
      </svg>
    </div>
  );
}
