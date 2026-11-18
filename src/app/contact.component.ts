import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, SocialApi, errMsg } from './api';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Contact us</h1>
    @if (sent()) {
      <div class="panel ok">
        <h2>Message sent</h2>
        <p>Thanks, {{ name }}. We’ll reply to {{ email }} as soon as we can.</p>
        <a class="btn" routerLink="/">Back to events</a>
      </div>
    } @else {
      <p class="muted">Questions, bugs or ideas? Tell us below.</p>
      <form class="panel" (ngSubmit)="submit()">
        <label for="n">Your name</label>
        <input id="n" name="name" [(ngModel)]="name" required maxlength="80" autocomplete="name">
        <label for="e">Email address</label>
        <input id="e" name="email" type="email" [(ngModel)]="email" required autocomplete="email">
        <label for="m">Message</label>
        <textarea id="m" name="message" rows="6" [(ngModel)]="message" required minlength="10" maxlength="2000"></textarea>
        <small class="muted">{{ message.length }} / 2000</small>
        @if (error()) { <div class="error">{{ error() }}</div> }
        <p><button class="primary" type="submit" [disabled]="busy()">Send message</button></p>
      </form>
    }
  `,
  styles: [`form, .ok { max-width: 620px; }`],
})
export class ContactComponent {
  private api = inject(SocialApi);
  name = inject(AuthService).user()?.username ?? '';
  email = ''; message = '';
  sent = signal(false); busy = signal(false); error = signal('');

  submit() {
    this.error.set('');
    this.busy.set(true);
    this.api.contact({ name: this.name, email: this.email, message: this.message }).subscribe({
      next: () => { this.busy.set(false); this.sent.set(true); },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e)); },
    });
  }
}
