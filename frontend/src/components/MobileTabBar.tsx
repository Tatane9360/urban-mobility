'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Warning, ClockCounterClockwise, UserCircle } from '@phosphor-icons/react/dist/ssr';
import { useAuth } from '../features/auth/hooks/useAuth';

const TABS = [
  { href: '/', label: 'Planifier', icon: Compass, guestVisible: true },
  // /alerts is a public endpoint on purpose ("a guest checking whether the
  // tram is disrupted shouldn't have to sign in first" — alerts.controller.ts)
  // — the tab follows that same intent.
  { href: '/alerts', label: 'Alertes', icon: Warning, guestVisible: true },
  { href: '/history', label: 'Historique', icon: ClockCounterClockwise, guestVisible: false },
  { href: '/profile', label: 'Profil', icon: UserCircle, guestVisible: false },
];

// Below `lg` a top nav needs a thumb reach a tab bar doesn't — this replaces
// AppHeader's Historique/Profil links on small screens; the header itself
// keeps the logo and account actions (login/logout). The bar itself stays up
// for a guest (Planifier/Alertes are both guest-accessible); only the
// sign-in-gated tabs drop out.
export function MobileTabBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => tab.guestVisible || user);

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-[1000] flex border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-zinc-800 dark:bg-zinc-900"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              // --accent's dark value (#3b6ea5) is 3.34:1 on this bar's dark
              // background — enough for the icon's fill but not WCAG AA's 4.5:1
              // for text. Only the label swaps to accent-hover in dark mode.
              active ? 'text-accent dark:text-accent-hover' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Icon size={22} weight={active ? 'fill' : 'regular'} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
