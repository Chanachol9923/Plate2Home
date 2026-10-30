import { describe, expect, it } from 'vitest';
import { googleAvatar, isGoogleAccount, safeNext } from './session';

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

describe('googleAvatar (D-102)', () => {
  const pic = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';

  it('takes the Google profile picture from avatar_url or picture', () => {
    expect(googleAvatar({ avatar_url: pic })).toBe(pic);
    expect(googleAvatar({ picture: pic })).toBe(pic);
  });

  it('drops anything not served by Google over https (user_metadata is user-editable)', () => {
    expect(googleAvatar({ avatar_url: 'https://evil.example/a.png' })).toBeNull();
    expect(googleAvatar({ avatar_url: 'http://lh3.googleusercontent.com/a/x' })).toBeNull();
    expect(
      googleAvatar({ avatar_url: 'https://lh3.googleusercontent.com.evil.example/a' }),
    ).toBeNull();
    expect(googleAvatar({ avatar_url: 'javascript:alert(1)' })).toBeNull();
    expect(googleAvatar({ avatar_url: 42 })).toBeNull();
    expect(googleAvatar(undefined)).toBeNull();
  });
});
