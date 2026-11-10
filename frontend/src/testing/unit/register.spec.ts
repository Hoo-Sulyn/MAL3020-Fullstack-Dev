import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GuestRegister } from '../../app/pages/guests/register/register';
import { AuthService } from '../../app/services/auth.service';

describe('GuestRegister', () => {
  it('displays an account-exists message when registration returns a conflict', () => {
    const register = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { message: 'An account with this email already exists.' },
      }))
    );
    TestBed.configureTestingModule({
      imports: [GuestRegister],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { register } },
      ],
    });

    const fixture = TestBed.createComponent(GuestRegister);
    const component = fixture.componentInstance;
    component.registerForm.setValue({
      firstName: 'Test',
      lastName: 'Guest',
      email: 'guest@example.com',
      phone: '+60123456789',
      password: 'valid-password',
      confirmPassword: 'valid-password',
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(register).toHaveBeenCalledOnce();
    expect(component.errorMessage).toBe(
      'An account with this email already exists. Please sign in or use a different email.'
    );
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'An account with this email already exists'
    );
    expect(component.isSubmitting).toBe(false);
    fixture.destroy();
  });
});
