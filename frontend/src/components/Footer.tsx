import Link from 'next/link';

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-500 ${className}`}>
      <Link href="/mentions-legales" className="hover:text-zinc-700 dark:hover:text-zinc-300">
        Mentions légales
      </Link>
      <Link href="/confidentialite" className="hover:text-zinc-700 dark:hover:text-zinc-300">
        Confidentialité
      </Link>
    </div>
  );
}

export function Footer({ className = '' }: { className?: string }) {
  return (
    <footer
      className={`border-t border-zinc-200 px-4 py-6 dark:border-zinc-800 ${className}`}
    >
      <LegalLinks className="mx-auto max-w-7xl" />
    </footer>
  );
}
