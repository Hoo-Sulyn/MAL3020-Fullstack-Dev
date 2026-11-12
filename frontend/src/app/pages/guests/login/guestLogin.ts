import { Component, signal, inject } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RealtimeService } from '../../../services/realtime.service';

@Component({
  selector: 'app-guest-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './guestLogin.html',
  styleUrl: './guestLogin.css',
})
export class GuestLogin {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private realtime = inject(RealtimeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm: FormGroup;
  errorMessage = signal('');
  showRegisterPrompt = signal(false);
  isSubmitting = signal(false);

  constructor() {
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
        this.errorMessage.set('Please fill in both your email and password.');
      } else {
        this.errorMessage.set('Please enter a valid email address.');
      }
      this.showRegisterPrompt.set(false);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.showRegisterPrompt.set(false);
    const { email, password } = this.loginForm.getRawValue();
    this.auth.login(email, password, 'guest').subscribe({
      next: (response) => {
        this.realtime.connect(response.token);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(
          returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/hotelBooking',
        );
      },
      error: (error) => {
        if (error.status === 401) {
          this.errorMessage.set(
            'Invalid email or password. Have you registered a guest account yet?',
          );
          this.showRegisterPrompt.set(true);
        } else {
          this.errorMessage.set(error.error?.message || 'Unable to sign in. Please try again.');
        }
        this.isSubmitting.set(false);
      },
    });
  }

  clearError(): void {
    this.errorMessage.set('');
    this.showRegisterPrompt.set(false);
  }
}
