import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, errMsg } from './api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>{{ mode() === 'login' ? 'Log in' : 'Create your account' }}</h1>
    <form class="panel" (ngSubmit)="submit()">
      <label for="u">Username</label>
      <input id="u" name="username" [(ngModel)]="username" required autocomplete="username">
      <label for="p">Password</label>
      <input id="p" name="password" type="password" [(ngModel)]="password" required
             [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'">
      @if (error()) { <div class="error">{{ error() }}</div> }
      <p><button class="primary" type="submit">{{ mode() === 'login' ? 'Log in' : 'Sign up' }}</button></p>
      <p class="muted">
        @if (mode() === 'login') { New here? <a href="#" (click)="flip($event)">Create an account</a> }
        @else { Already have an account? <a href="#" (click)="flip($event)">Log in</a> }
      </p>
    </form>
  `,
  styles: [`form { max-width: 420px; }`],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  mode = signal<'login' | 'register'>('login');
  username = ''; password = '';
  error = signal('');

  flip(e: Event) { e.preventDefault(); this.error.set(''); this.mode.set(this.mode() === 'login' ? 'register' : 'login'); }

  submit() {
    const call = this.mode() === 'login'
      ? this.auth.login(this.username, this.password)
      : this.auth.register(this.username, this.password);
    call.subscribe({ next: () => this.router.navigateByUrl('/'), error: (e) => this.error.set(errMsg(e)) });
  }
}
