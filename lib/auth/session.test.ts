import { describe, expect, it } from 'vitest';
import { isGoogleAccount, safeNext } from './session';

describe('isGoogleAccount', () => {
  it('accepts accounts with a Google identity', () => {
    expect(isGoogleAccount({ provider: 'google', providers: ['google'] })).toBe(true);
    expect(isGoogleAccount({ provider: 'email', providers: ['email', 'google'] })).toBe(true);
    expect(isGoogleAccount({ provider: 'google' })).toBe(true);
  });

  it('rejects accounts made with email sign-up or anything else', () => {
    expect(isGoogleAccount({ provider: 'email', providers: ['email'] })).toBe(false);
    expect(isGoogleAccount({ provider: 'anonymous' })).toBe(false);
    expect(isGoogleAccount({})).toBe(false);
  });
});

describe('safeNext', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/en/signed-in')).toBe('/en/signed-in');
    expect(safeNext('/lost')).toBe('/lost');
  });

  it('falls back for anything that could leave the site', () => {
    for (const bad of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'lost']) {
      expect(safeNext(bad)).toBe('/signed-in');
    }
  });
});
