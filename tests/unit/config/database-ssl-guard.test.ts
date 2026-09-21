import { describe, expect, it } from 'vitest';
import { assertTlsForRemoteHost } from '../../../src/config/database.js';

const SUPABASE_URL =
  'postgresql://postgres.abc:pw@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

describe('assertTlsForRemoteHost', () => {
  it('rejects a remote DATABASE_URL when DB_SSL is not enabled', () => {
    expect(() =>
      assertTlsForRemoteHost({ databaseUrl: SUPABASE_URL, host: 'localhost', dbSsl: false })
    ).toThrow(/aws-1-eu-west-1\.pooler\.supabase\.com/);
  });

  it('allows a remote DATABASE_URL once DB_SSL is enabled', () => {
    expect(() =>
      assertTlsForRemoteHost({ databaseUrl: SUPABASE_URL, host: 'localhost', dbSsl: true })
    ).not.toThrow();
  });

  it('allows a local DATABASE_URL without TLS', () => {
    expect(() =>
      assertTlsForRemoteHost({
        databaseUrl: 'postgres://postgres:postgres@localhost:5435/payment_service_test',
        host: 'localhost',
        dbSsl: false
      })
    ).not.toThrow();
  });

  it('prefers the DATABASE_URL host over the discrete DB_HOST', () => {
    // DB_HOST says localhost, but DATABASE_URL wins — so this must still throw.
    expect(() =>
      assertTlsForRemoteHost({ databaseUrl: SUPABASE_URL, host: 'localhost', dbSsl: false })
    ).toThrow();
  });

  it('rejects a remote discrete DB_HOST when no DATABASE_URL is set', () => {
    expect(() =>
      assertTlsForRemoteHost({ host: 'db.internal.example.com', dbSsl: false })
    ).toThrow(/db\.internal\.example\.com/);
  });

  it('allows the loopback addresses without TLS', () => {
    for (const host of ['localhost', '127.0.0.1', '::1']) {
      expect(() => assertTlsForRemoteHost({ host, dbSsl: false })).not.toThrow();
    }
  });

  it('fails closed when the DATABASE_URL cannot be parsed', () => {
    // An unknown host has not been shown to be local, so it must be treated as
    // remote rather than waved through.
    expect(() =>
      assertTlsForRemoteHost({ databaseUrl: 'not-a-valid-url', host: 'localhost', dbSsl: false })
    ).toThrow(/unparseable database host/);
  });
});
