import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { getProfile } from '../api/get-profile';
import { updateProfile } from '../api/update-profile';
import type { Profile, UpdateProfileRequest } from '../types';

export function useProfile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetched, setFetched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    getProfile(token)
      .then(setProfile)
      .finally(() => setFetched(true));
  }, [token]);

  async function save(update: UpdateProfileRequest) {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updateProfile(token, update);
      setProfile(updated);
    } finally {
      setSaving(false);
    }
  }

  return { profile, loading: token !== null && !fetched, saving, save };
}
