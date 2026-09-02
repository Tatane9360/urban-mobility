import { ApiError } from '@/src/lib/api-client';

// Maps the known backend failure codes (see backend/src/auth/auth.service.ts)
// to warm, specific French copy. Falls back to a generic message only for
// truly unknown failures — a raw ApiError.message is never shown verbatim,
// since it may be written for developers rather than end users.
export function authErrorMessage(err: unknown, isRegister: boolean): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return 'Email ou mot de passe incorrect.';
    }
    if (err.status === 409) {
      return 'Un compte existe déjà avec cet email. Essayez de vous connecter.';
    }
    if (err.status >= 500) {
      return 'Le service est momentanément indisponible. Réessayez dans un instant.';
    }
    return isRegister
      ? 'Impossible de créer le compte pour le moment. Réessayez.'
      : 'Impossible de vous connecter pour le moment. Réessayez.';
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Vous êtes hors ligne. Vérifiez votre connexion et réessayez.';
  }
  return 'Une erreur est survenue, réessayez.';
}
