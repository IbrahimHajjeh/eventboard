import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, EventsApi, EventItem } from './api';
import { EventCardComponent } from './event-card.component';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [RouterLink, FormsModule, EventCardComponent],
  template: `
    <section class="hero">
      <h1>Find a night out.<br>Take a seat.</h1>
      <p>Browse events, join in one tap, and follow hosts so you hear about their next one first.</p>
      <form (ngSubmit)="load()">
        <input name="q" [(ngModel)]="q" placeholder="Search by title or place" aria-label="Search events">
        <button class="go" type="submit">Search</button>
      </form>
    </section>

    @if (auth.user()) {
      <div class="tabs">
        <button [class.on]="!following()" (click)="setTab(false)">All events</button>
        <button [class.on]="following()" (click)="setTab(true)">From people I follow</button>
      </div>
    }

    @if (loading()) { <p class="muted">Loading events…</p> }
    @else if (!events().length) {
      <div class="panel">
        @if (following()) {
          <b>Nobody you follow has an upcoming event.</b> <a routerLink="/friends">Find people to follow</a>.
        } @else if (lastQuery()) {
          <b>No events match “{{ lastQuery() }}”.</b> Try a different word or a nearby place.
        } @else {
          <b>No events yet.</b> Be the first — publish one and people can start joining.
        }
      </div>
    }

    <div class="grid">
      @for (e of events(); track e.id) { <app-event-card [e]="e" /> }
    </div>
  `,
  styles: [`
    .hero { background: var(--accent); color: #fff; border-radius: 16px; padding: clamp(1.5rem, 5vw, 3rem); margin-bottom: 1.5rem; }
    .hero h1 { font-size: clamp(2.2rem, 6vw, 4rem); }
    .hero p { max-width: 52ch; font-size: 1.1rem; margin: .75rem 0 1.25rem; }
    .hero form { display: flex; gap: .5rem; max-width: 520px; flex-wrap: wrap; }
    .hero input { flex: 1 1 220px; border-color: #fff; }
    .hero .go { background: var(--seat); border-color: var(--seat); color: var(--ink); }
  `],
})
export class EventsListComponent {
  auth = inject(AuthService);
  private api = inject(EventsApi);
  events = signal<EventItem[]>([]);
  loading = signal(true);
  following = signal(false);
  lastQuery = signal('');
  q = '';

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    const q = this.q.trim();
    this.api.list(q, this.following()).subscribe({
      next: (e) => { this.events.set(e); this.lastQuery.set(q); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  setTab(f: boolean) { this.following.set(f); this.load(); }
}
