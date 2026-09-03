'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

// Covers the gap the app already had: AuthProvider blocks the header nav while
// it checks the stored token, so the first paint was a half-drawn header —
// logo present, navigation missing — that then popped into place.
const EXIT_MS = 260;

// A floor, not a delay stacked on the token check: it is measured from mount,
// so a check that takes longer than this adds nothing at all. It exists
// because the check usually resolves in ~100ms, and a splash that flashes for
// one frame reads as a glitch rather than as an opening. Kept short —
// MOTION_INTENSITY 2 and the PRD's eco-design constraint both argue against
// holding a user in front of an animation, so this buys legibility and
// nothing more.
const MIN_VISIBLE_MS = 900;

export function BootSplash({ done }: { done: boolean }) {
  // Kept mounted one transition past `done` so the fade-out can play; unmounted
  // after, so nothing sits over the app holding a paint layer.
  const [mounted, setMounted] = useState(true);
  const [floorElapsed, setFloorElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFloorElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  const leaving = done && floorElapsed;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (!mounted) return null;

  return (
    <div
      // aria-hidden with no role: this is a paint-over of content that is
      // already in the DOM behind it. Announcing "loading" would make a
      // screen reader wait for something its user never sees.
      aria-hidden="true"
      data-leaving={leaving ? '' : undefined}
      className="fixed inset-0 z-[3000] grid place-items-center bg-background transition-opacity duration-[260ms] ease-out data-leaving:pointer-events-none data-leaving:opacity-0 motion-reduce:transition-none"
    >
      <div className="flex flex-col items-center gap-5">
        {/* Two files rather than one: the artwork is a raster, so its navy
            cannot follow --logo-arc the way an inline mark would, and that navy
            scores 1.75 against the dark background. The -dark file is the same
            cut-out with only the navy lifted toward #3b6ea5; the green already
            clears 8.7 and is untouched in both. */}
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

        {/* The name arrives behind the mark, so the two read in order rather
            than competing. One short rise — no per-letter assembly, no
            typewriter: this is a public transit service, and lettering that
            performs undermines it. */}
        <p className="text-lg font-semibold tracking-tight text-zinc-900 [animation:boot-word_360ms_cubic-bezier(0.16,1,0.3,1)_260ms_both] sm:text-xl dark:text-zinc-50 motion-reduce:animate-none">
          UrbanFlow
        </p>
      </div>
    </div>
  );
}
