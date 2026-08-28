'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadSimple, Warning } from '@phosphor-icons/react/dist/ssr';
import { useAuth } from '../../auth/hooks/useAuth';
import { deleteAccount, exportUserData } from '../api/user-data';

export function UserDataSection({ email }: { email: string }) {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  // Two steps, not one: arming the danger zone, then typing the email back.
  const [confirming, setConfirming] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const data = await exportUserData(token);
      // ponytail: Blob + object URL is the platform's own "save this JSON"
      // path — no file-saver dependency for eight lines.
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `urbanflow-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!token) return;
    setDeleting(true);
    try {
      await deleteAccount(token);
      logout();
      router.replace('/');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Mes données</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Vous pouvez récupérer une copie de vos données ou supprimer définitivement votre compte.
      </p>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        aria-label="Télécharger toutes mes données au format JSON"
        className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-[#1E3A5F] hover:text-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-[#3B6EA5] dark:hover:text-[#3B6EA5]"
      >
        <DownloadSimple size={16} weight="bold" />
        {exporting ? 'Préparation…' : 'Télécharger mes données (JSON)'}
      </button>

      <div className="mt-6 rounded-lg border border-red-200 p-4 dark:border-red-900/60">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
          <Warning size={16} weight="bold" />
          Supprimer mon compte
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Votre profil et tous vos itinéraires sauvegardés seront effacés. Cette action est irréversible.
        </p>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Supprimer définitivement mon compte"
            className="mt-3 h-11 rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <label htmlFor="confirm-email" className="text-sm text-zinc-700 dark:text-zinc-300">
              Saisissez <span className="font-medium">{email}</span> pour confirmer.
            </label>
            <input
              id="confirm-email"
              type="email"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              autoComplete="off"
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || typedEmail !== email}
                aria-label="Confirmer la suppression définitive de mon compte"
                className="h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setTypedEmail('');
                }}
                disabled={deleting}
                className="h-11 rounded-lg px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
