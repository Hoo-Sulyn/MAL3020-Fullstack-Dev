import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { authGuard } from '../../app/guards/auth.guard';

// A token with the same shape as the API's JWT. The guard only reads its expiry time.
function makeToken(expiresInSeconds: number): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

function signIn(role: 'guest' | 'admin', expiresInSeconds = 3600): void {
  const token = makeToken(expiresInSeconds);
  const user = { id: '1', firstName: 'Test', lastName: 'User', email: 'a@b.test', phone: '1', role };
  sessionStorage.setItem('haven_session', JSON.stringify({ token, user }));
  sessionStorage.setItem('haven_token', token);
}

function runGuard(role: 'guest' | 'admin'): boolean | UrlTree {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  return TestBed.runInInjectionContext(() => authGuard(role)({} as never, {} as never)) as
    | boolean
    | UrlTree;
}

describe('authGuard', () => {
  afterEach(() => sessionStorage.clear());

  it('lets a signed-in user of the right role open the page', () => {
    signIn('guest');
    expect(runGuard('guest')).toBe(true);
  });

  it('sends a signed-out visitor to the guest sign-in page for a guest page', () => {
    const result = runGuard('guest') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/');
  });

  it('sends a signed-out visitor to the staff sign-in page for an admin page', () => {
    const result = runGuard('admin') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/adminLogin');
  });

  it('does not let a guest open an admin page, and keeps the guest signed in', () => {
    signIn('guest');

    const result = runGuard('admin') as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/adminLogin');
    expect(sessionStorage.getItem('haven_session')).not.toBeNull();
  });

  it('rejects a session whose token has expired', () => {
    signIn('admin', -60);
    const result = runGuard('admin') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/adminLogin');
  });
});
