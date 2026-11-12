import { Component, inject } from '@angular/core';

import { ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { passwordsMismatch: true }
    : null;
}

@Component({
  selector: 'app-guest-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class GuestRegister {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  registerForm: FormGroup;
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor() {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-]{8,15}$/)]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator },
    );
  }

  onSubmit(): void {
    if (this.registerForm.invalid || this.isSubmitting) {
      this.registerForm.markAllAsTouched();
      this.errorMessage =
        'Please complete all required fields correctly before creating your account.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { firstName, lastName, email, phone, password } = this.registerForm.getRawValue();

    this.auth
      .register({
        firstName,
        lastName,
        email,
        phone,
        password,
      })
      .subscribe({
        next: () => {
          this.successMessage = 'Account created successfully. Redirecting to sign in...';
          this.changeDetector.markForCheck();
          setTimeout(() => this.router.navigateByUrl('/'), 800);
        },
        error: (error: unknown) => {
          this.errorMessage =
            error instanceof HttpErrorResponse && error.status === 409
              ? 'An account with this email already exists. Please sign in or use a different email.'
              : error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
                ? error.error.message
                : 'Unable to create your account right now.';
          this.isSubmitting = false;
          this.changeDetector.markForCheck();
        },
      });
  }
}
