import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from '../../app/interceptors/auth.interceptor';

function signIn(role: 'guest' | 'admin'): void {
  const user = { id: '1', firstName: 'T', lastName: 'U', email: 'a@b.test', phone: '1', role };
  sessionStorage.setItem('haven_session', JSON.stringify({ token: 'x.y.z', user }));
  sessionStorage.setItem('haven_token', 'x.y.z');
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    navigate = vi.fn().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigate as never);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => sessionStorage.clear());

  it('ends the session and returns an admin to the staff sign-in when the token is rejected', () => {
    signIn('admin');
    let failed = false;

    http.get('http://localhost:3000/api/bookings').subscribe({ error: () => (failed = true) });
    backend.expectOne('http://localhost:3000/api/bookings').flush(
      { message: 'The authentication token is invalid or expired.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(failed).toBe(true);
    expect(sessionStorage.getItem('haven_session')).toBeNull();
    expect(sessionStorage.getItem('haven_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/adminLogin');
  });

  it('returns a guest to the guest sign-in when the token is rejected', () => {
    signIn('guest');

    http.get('http://localhost:3000/api/profile').subscribe({ error: () => undefined });
    backend.expectOne('http://localhost:3000/api/profile').flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('does not sign anyone out for a wrong password or an unrelated error', () => {
    signIn('guest');

    http.post('http://localhost:3000/api/auth/login', {}).subscribe({ error: () => undefined });
    backend.expectOne('http://localhost:3000/api/auth/login').flush(
      { message: 'Invalid email or password.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    http.get('http://localhost:3000/api/rooms').subscribe({ error: () => undefined });
    backend.expectOne('http://localhost:3000/api/rooms').flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );

    expect(sessionStorage.getItem('haven_session')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
