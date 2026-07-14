export interface AuthResponse {
  accessToken: string;
}

// Mirrors backend/src/auth/auth.controller.ts's GET /auth/me response
export interface CurrentUser {
  id: string;
  email: string;
}
