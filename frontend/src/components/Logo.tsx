import Link from 'next/link';
import { Compass } from '@phosphor-icons/react/dist/ssr';

// The one lockup this app has — shared so AppHeader and AuthForm never
// render two different marks for the same brand.
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Compass size={22} weight="fill" className="text-accent" />
      <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        UrbanFlow
      </span>
    </Link>
  );
}
