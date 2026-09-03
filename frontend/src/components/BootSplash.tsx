'use client';

import Image from 'next/image';
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
      {/* Two files rather than one: the artwork is a raster, so its navy cannot
          follow --logo-arc the way the inline mark does, and that navy scores
          1.75 against the dark background. The -dark file is the same cut-out
          with only the navy lifted toward #3b6ea5; the green already clears
          8.7 and is untouched in both. */}
      <div className="w-40 [animation:boot-arc_420ms_cubic-bezier(0.16,1,0.3,1)_both] sm:w-52 motion-reduce:animate-none">
        <Image
          src="/logo-urban-flow.png"
          alt=""
          width={666}
          height={666}
          priority
          className="h-auto w-full dark:hidden"
        />
        <Image
          src="/logo-urban-flow-dark.png"
          alt=""
          width={666}
          height={666}
          priority
          className="hidden h-auto w-full dark:block"
        />
      </div>
    </div>
  );
}
