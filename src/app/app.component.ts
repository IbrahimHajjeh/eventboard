import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService, NotificationsService } from './api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="bar">
      <a routerLink="/" class="logo">Eventboard</a>
      <nav aria-label="Main">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Events</a>
        <a routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/contact" routerLinkActive="active">Contact</a>
        @if (auth.user(); as u) {
          <a routerLink="/friends" routerLinkActive="active">Friends</a>
          <a routerLink="/notifications" routerLinkActive="active">
            Notifications
            @if (notes.unread()) { <span class="badge" [attr.aria-label]="notes.unread() + ' unread'">{{ notes.unread() }}</span> }
          </a>
          <a [routerLink]="['/u', u.username]" routerLinkActive="active">{{ u.username }}</a>
          <a routerLink="/events/new" class="btn primary">Publish an event</a>
          <button class="out" (click)="logout()">Log out</button>
        } @else {
          <a routerLink="/login" class="btn primary">Log in or sign up</a>
        }
      </nav>
    </header>
    <main class="wrap"><router-outlet /></main>
    <footer>
      <span>Eventboard — events you can actually take a seat at.</span>
      <span><a routerLink="/about">About</a> <a routerLink="/contact">Contact us</a></span>
    </footer>
  `,
  styles: [`
    .bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem;
           padding: .9rem 1rem; background: var(--ink); color: #fff; }
    .logo { font-weight: 800; font-size: 1.4rem; letter-spacing: -.03em; text-decoration: none; }
    nav { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    nav a:not(.btn) { text-decoration: none; color: #b9c0d0; padding: .2rem 0; border-bottom: 2px solid transparent; }
    nav a:not(.btn):hover, nav a.active { color: #fff; border-bottom-color: var(--seat); }
    .out { color: #fff; border-color: #fff; }
    .badge { background: var(--seat); color: var(--ink); font-size: .75rem; font-weight: 800;
             border-radius: 999px; padding: .05rem .45rem; margin-left: .25rem; }
    footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1.5rem 1rem;
             border-top: 2px solid var(--line); color: var(--muted); max-width: 1040px; margin: 0 auto; }
    footer a { margin-left: 1rem; }
  `],
})
export class AppComponent {
  auth = inject(AuthService);
  notes = inject(NotificationsService);
  private router = inject(Router);

  constructor() {
    const poll = () => { if (this.auth.user()) this.notes.refresh(); };
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(poll);
    setInterval(poll, 30000);
    poll();
  }

  logout() {
    this.auth.logout();
    this.notes.unread.set(0);
    this.router.navigateByUrl('/');
  }
}
