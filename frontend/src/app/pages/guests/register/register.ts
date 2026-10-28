import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-guest-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class GuestRegister {
  // 1. Declare the form group property here
  registerForm: FormGroup;

  // 2. Initialize it using FormBuilder in the constructor
  constructor(private fb: FormBuilder) {
    this.registerForm = this.fb.group({
      // Add your form fields here (make sure these match your formControlName attributes in register.html)
      // Example:
      // email: ['', [Validators.required, Validators.email]],
      // password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.registerForm.valid) {
      console.log(this.registerForm.value);
    }
  }
}