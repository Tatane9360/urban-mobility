'use client';

import { createContext, useEffect, useState } from 'react';
import { getCurrentUser } from '../api/me';
import type { CurrentUser } from '../types';

const TOKEN_STORAGE_KEY = 'urbanflow.accessToken';

interface AuthContextValue {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  // Starts true so the header doesn't flash "Connexion" before the stored
  // token (if any) has been checked; the mount effect always resolves it.
  const [checkingStoredToken, setCheckingStoredToken] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    Promise.resolve()
      .then(async () => {
        if (!storedToken) return;
        setTokenState(storedToken);
        try {
          setUser(await getCurrentUser(storedToken));
        } catch {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setTokenState(null);
        }
      })
      .finally(() => setCheckingStoredToken(false));
  }, []);

  function setToken(newToken: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setTokenState(newToken);
    getCurrentUser(newToken)
      .then(setUser)
      .catch(() => setUser(null));
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setTokenState(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading: checkingStoredToken, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
