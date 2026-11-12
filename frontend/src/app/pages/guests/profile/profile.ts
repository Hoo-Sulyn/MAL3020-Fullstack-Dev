import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AuthUser } from '../../../services/auth.service';
import { RealtimeService } from '../../../services/realtime.service';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return confirmPassword && newPassword !== confirmPassword ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly profileForm: FormGroup;
  readonly passwordForm: FormGroup;
  user: AuthUser | null = null;
  isLoading = true;
  isSavingProfile = false;
  isChangingPassword = false;
  isDeletingAccount = false;
  showDeleteConfirmation = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      phoneNum: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-]{8,15}$/)]],
    });
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordMatchValidator },
    );
  }

  get guestName(): string {
    if (!this.user) {
      return '';
    }
    const firstName = this.profileForm.get('firstName')?.value || this.user.firstName;
    const lastName = this.profileForm.get('lastName')?.value || this.user.lastName;
    return `${firstName} ${lastName}`;
  }

  get guestInitials(): string {
    const firstName = this.profileForm.get('firstName')?.value || this.user?.firstName || '';
    const lastName = this.profileForm.get('lastName')?.value || this.user?.lastName || '';
    return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  }

  get passwordMismatch(): boolean {
    return (
      this.passwordForm.hasError('passwordsMismatch') &&
      Boolean(this.passwordForm.get('confirmPassword')?.touched)
    );
  }

  ngOnInit(): void {
    const currentUser = this.auth.getCurrentUser();
    if (!this.realtime.isConnected() || currentUser?.role !== 'guest') {
      this.auth.logout();
      this.realtime.disconnect();
      void this.router.navigateByUrl('/');
      return;
    }

    this.auth.getProfile().subscribe({
      next: (user) => {
        if (user.role !== 'guest') {
          this.auth.logout();
          this.realtime.disconnect();
          void this.router.navigateByUrl('/');
          return;
        }
        this.setUser(user);
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.auth.logout();
          this.realtime.disconnect();
          void this.router.navigateByUrl('/');
          return;
        }
        this.errorMessage = this.getErrorMessage(error, 'Unable to load your profile.');
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  onSubmit(): void {
    if (this.profileForm.invalid || this.isSavingProfile || !this.profileForm.dirty) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { firstName, lastName, email, phoneNum } = this.profileForm.getRawValue();
    this.auth
      .updateProfile({
        firstName,
        lastName,
        email,
        phone: phoneNum,
      })
      .subscribe({
        next: (user) => {
          this.setUser(user);
          this.auth.updateCachedUser(user);
          this.isSavingProfile = false;
          this.successMessage = 'Your profile has been updated.';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'Unable to save your profile.');
          this.isSavingProfile = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  cancelChanges(): void {
    if (this.user) {
      this.profileForm.reset(this.profileFormValue(this.user));
    }
    this.errorMessage = '';
    this.successMessage = '';
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.isChangingPassword) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isChangingPassword = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.isChangingPassword = false;
        this.successMessage = 'Your password has been changed.';
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'Unable to change your password.');
        this.isChangingPassword = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  beginDeleteAccount(): void {
    this.errorMessage = '';
    this.showDeleteConfirmation = true;
  }

  cancelDeleteAccount(): void {
    this.showDeleteConfirmation = false;
  }

  deleteAccount(): void {
    if (
      this.isDeletingAccount ||
      !window.confirm(
        'Permanently delete your guest account? Your saved booking records will remain.',
      )
    ) {
      return;
    }

    this.isDeletingAccount = true;
    this.errorMessage = '';
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.auth.logout();
        this.realtime.disconnect();
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'Unable to delete your account.');
        this.isDeletingAccount = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private setUser(user: AuthUser): void {
    this.user = user;
    this.profileForm.reset(this.profileFormValue(user));
  }

  private profileFormValue(user: AuthUser): Record<string, string> {
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNum: user.phone,
    };
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the server. Check that the backend is running.';
      }
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }
    }
    return fallback;
  }
}
