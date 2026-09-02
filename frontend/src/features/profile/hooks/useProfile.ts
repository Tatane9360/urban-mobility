import { useEffect, useState } from 'react';
import { ApiError } from '@/src/lib/api-client';
import { useAuth } from '../../auth/hooks/useAuth';
import { getProfile } from '../api/get-profile';
import { updateProfile } from '../api/update-profile';
import type { Profile, UpdateProfileRequest } from '../types';

export function useProfile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetched, setFetched] = useState(false);
  const [saving, setSaving] = useState(false);
  // A rejected request used to vanish into an unhandled rejection, leaving the
  // page blank forever (load) or the button back at rest as if it had worked
  // (save). Both now have somewhere to land.
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getProfile(token)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setFetched(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  async function save(update: UpdateProfileRequest) {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateProfile(token, update);
      setProfile(updated);
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : typeof navigator !== 'undefined' && !navigator.onLine
            ? 'Vous êtes hors ligne : vos préférences n\u2019ont pas été enregistrées.'
            : "Impossible d\u2019enregistrer vos préférences pour le moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  function retryLoad() {
    setLoadError(false);
    setFetched(false);
    setReloadKey((k) => k + 1);
  }

  return {
    profile,
    loading: token !== null && !fetched,
    loadError,
    saving,
    saveError,
    save,
    retryLoad,
  };
}
