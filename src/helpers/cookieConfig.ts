export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax' | 'strict';
  maxAge: number;
}

const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const buildCookieOptions = (): CookieOptions => {
  const isProd =
    process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
};
