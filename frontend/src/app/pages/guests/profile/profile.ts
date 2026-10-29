import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterLink, ReactiveFormsModule],
    templateUrl: './profile.html',
    styleUrl: './profile.css'
})

export class Profile {
    profileForm: FormGroup;

    constructor(private fb: FormBuilder){
        this.profileForm = this.fb.group({

        });
    }

    onSubmit(){
        
    }
}