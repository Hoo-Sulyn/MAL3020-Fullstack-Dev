import { Component, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RealtimeService } from '../../../services/realtime.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './adminLogin.html',
  styleUrl: './adminLogin.css',
})
export class AdminLogin {
  loginForm: FormGroup;

  errorMessage = signal('');
  isSubmitting = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private realtime: RealtimeService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      if (
        this.loginForm.get('email')?.hasError('required') ||
        this.loginForm.get('password')?.hasError('required')
      ) {
        this.errorMessage.set('Please fill in both your staff email and password.');
      } else {
        this.errorMessage.set('Please enter a valid staff email address.');
      }
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    const { email, password } = this.loginForm.getRawValue();
    this.auth.login(email, password, 'admin').subscribe({
      next: (response) => {
        this.realtime.connect(response.token);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(
          returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard',
        );
      },
      error: (error) => {
        if (error.status === 401) {
          this.errorMessage.set(
            'Invalid staff email or password. Staff accounts must be provided by your hotel manager.',
          );
        } else {
          this.errorMessage.set(error.error?.message || 'Unable to sign in. Please try again.');
        }
        this.isSubmitting.set(false);
      },
    });
  }

  clearError(): void {
    this.errorMessage.set('');
  }
}
