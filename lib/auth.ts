// Simple admin auth — demo credentials
export const ADMIN_COOKIE = 'ops1_admin';
export const ADMIN_TOKEN = 'ops1-admin-authenticated-2025';

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

export function verifyToken(token: string | undefined): boolean {
  return token === ADMIN_TOKEN;
}
