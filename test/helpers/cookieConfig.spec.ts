import { buildCookieOptions } from 'src/helpers/cookieConfig';

describe('buildCookieOptions()', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should produce dev-safe options when NODE_ENV is not "prod"', () => {
    process.env.NODE_ENV = 'dev';
    const opts = buildCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe('lax');
    expect(opts.maxAge).toBe(1000 * 60 * 60 * 24 * 7);
  });

  it('should produce dev-safe options when NODE_ENV is undefined (local fallback)', () => {
    delete process.env.NODE_ENV;
    const opts = buildCookieOptions();
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe('lax');
  });

  it('should produce prod-safe options when NODE_ENV is "prod"', () => {
    process.env.NODE_ENV = 'prod';
    const opts = buildCookieOptions();
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('none');
    expect(opts.httpOnly).toBe(true);
  });

  it('should produce prod-safe options when NODE_ENV is "production"', () => {
    process.env.NODE_ENV = 'production';
    const opts = buildCookieOptions();
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('none');
  });
});
