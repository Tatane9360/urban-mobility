import { apiFetch } from '@/src/lib/api-client';
import type { FavoriteAddress, Profile } from '../types';

// An account that saved favorites before the {label, address} shape shipped
// still has plain strings in the jsonb column. The backend upgrades those on
// write (see upgradeLegacyEntry in update-profile.dto.ts), but a profile that
// has not been PATCHed since still reads back as strings — and `.label` on a
// string is undefined, which reaches the DOM as "Retirer undefined" in the
// remove button's aria-label. Normalising here covers every consumer at once
// rather than guarding each render site.
function normalizeFavorite(entry: FavoriteAddress | string): FavoriteAddress {
  return typeof entry === 'string' ? { label: '', address: entry } : entry;
}

export async function getProfile(token: string): Promise<Profile> {
  const profile = await apiFetch<Profile>('/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    ...profile,
    favoriteAddresses: (profile.favoriteAddresses ?? []).map(normalizeFavorite),
  };
}
