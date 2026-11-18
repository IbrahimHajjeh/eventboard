import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Person, SocialApi } from './api';
import { FollowButtonComponent } from './follow-button.component';

type Tab = 'following' | 'followers' | 'find';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [RouterLink, FormsModule, FollowButtonComponent],
  template: `
    <h1>Friends</h1>
    <p class="muted">Follow people to get a notification whenever they publish a new event.</p>

    <div class="tabs">
      <button [class.on]="tab() === 'following'" (click)="go('following')">Following ({{ following().length }})</button>
      <button [class.on]="tab() === 'followers'" (click)="go('followers')">Followers ({{ followers().length }})</button>
      <button [class.on]="tab() === 'find'" (click)="go('find')">Find people</button>
    </div>

    @if (tab() === 'find') {
      <form class="search" (ngSubmit)="search()">
        <input name="q" [(ngModel)]="q" placeholder="Search usernames" aria-label="Search usernames">
        <button class="primary" type="submit">Search</button>
      </form>
    }

    <div class="panel">
      @if (!list().length) {
        <span class="muted">
          @switch (tab()) {
            @case ('following') { You’re not following anyone yet. Use <b>Find people</b> to start. }
            @case ('followers') { Nobody follows you yet. Publish an event and share it. }
            @default { No users match that search. }
          }
        </span>
      }
      <ul class="rows">
        @for (p of list(); track p.username) {
          <li>
            <a [routerLink]="['/u', p.username]"><b>{{ p.username }}</b></a>
            <app-follow-button [username]="p.username" [following]="p.is_following" (changed)="reload()" />
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`.search { display: flex; gap: .5rem; max-width: 460px; margin-bottom: 1rem; }`],
})
export class FriendsComponent {
  private api = inject(SocialApi);
  tab = signal<Tab>('following');
  following = signal<Person[]>([]);
  followers = signal<Person[]>([]);
  found = signal<Person[]>([]);
  q = '';

  constructor() { this.reload(); }

  list() { return this.tab() === 'following' ? this.following() : this.tab() === 'followers' ? this.followers() : this.found(); }

  go(t: Tab) { this.tab.set(t); if (t === 'find') this.search(); }
  search() { this.api.search(this.q.trim()).subscribe((r) => this.found.set(r)); }
  reload() {
    this.api.friends().subscribe((r) => { this.following.set(r.following); this.followers.set(r.followers); });
  }
}
