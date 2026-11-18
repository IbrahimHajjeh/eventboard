import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService, Profile, SocialApi, errMsg } from './api';
import { EventCardComponent } from './event-card.component';
import { FollowButtonComponent } from './follow-button.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, RouterLink, EventCardComponent, FollowButtonComponent],
  template: `
    @if (p(); as u) {
      <div class="panel head">
        <div class="avatar" aria-hidden="true">{{ u.username[0].toUpperCase() }}</div>
        <div class="who">
          <h1>{{ u.username }}</h1>
          <p class="muted">Member since {{ u.created_at | date:'MMMM y' }}</p>
          <p><b>{{ u.followers }}</b> {{ u.followers === 1 ? 'follower' : 'followers' }} · <b>{{ u.following }}</b> following</p>
        </div>
        @if (!isMe(u.username)) {
          <app-follow-button [username]="u.username" [following]="u.is_following" (changed)="load(u.username)" />
        } @else {
          <a class="btn" routerLink="/friends">Manage friends</a>
        }
      </div>

      <h2 class="sub">Events by {{ u.username }}</h2>
      @if (!u.events.length) { <div class="panel muted">{{ u.username }} hasn’t published an event yet.</div> }
      <div class="grid">@for (e of u.events; track e.id) { <app-event-card [e]="e" /> }</div>
    } @else if (error()) { <div class="error">{{ error() }}</div> }
  `,
  styles: [`
    .head { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
    .who { flex: 1 1 200px; } .who h1 { margin: 0; } .who p { margin: .25rem 0 0; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--seat); border: 3px solid var(--ink);
              display: grid; place-items: center; font-size: 2rem; font-weight: 800; }
    .sub { margin: 2rem 0 1rem; }
  `],
})
export class ProfileComponent {
  private api = inject(SocialApi);
  private auth = inject(AuthService);
  p = signal<Profile | null>(null);
  error = signal('');

  constructor() {
    inject(ActivatedRoute).paramMap.subscribe((m) => { this.p.set(null); this.load(m.get('username')!); });
  }
  isMe(name: string) { return this.auth.user()?.username.toLowerCase() === name.toLowerCase(); }
  load(username: string) {
    this.api.profile(username).subscribe({ next: (p) => this.p.set(p), error: (e) => this.error.set(errMsg(e)) });
  }
}
