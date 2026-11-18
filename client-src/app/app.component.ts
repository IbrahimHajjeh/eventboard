import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="bar">
      <a routerLink="/" class="logo">Eventboard</a>
      <nav>
        @if (auth.user(); as u) {
          <span class="muted">Signed in as <b>{{ u.username }}</b></span>
          <a routerLink="/events/new" class="btn primary">Publish an event</a>
          <button (click)="logout()">Log out</button>
        } @else {
          <a routerLink="/login" class="btn primary">Log in or sign up</a>
        }
      </nav>
    </header>
    <main class="wrap"><router-outlet /></main>
  `,
  styles: [`
    .bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem;
           padding: .9rem 1rem; background: var(--ink); color: #fff; }
    .logo { font-weight: 800; font-size: 1.4rem; letter-spacing: -.03em; text-decoration: none; }
    nav { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    nav .muted { color: #b9c0d0; }
    nav button { color: #fff; border-color: #fff; }
  `],
})
export class AppComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  logout() { this.auth.logout(); this.router.navigateByUrl('/'); }
}
