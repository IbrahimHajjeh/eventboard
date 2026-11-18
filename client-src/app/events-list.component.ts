import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { EventsApi, EventItem } from './api';
import { SeatBarComponent } from './seat-bar.component';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [RouterLink, DatePipe, SeatBarComponent],
  template: `
    <h1>What’s happening</h1>
    <p class="muted">Pick an event and take a seat.</p>

    @if (loading()) { <p class="muted">Loading events…</p> }
    @else if (!events().length) {
      <div class="panel"><b>No events yet.</b> Be the first — publish one and people can start joining.</div>
    }

    <div class="grid">
      @for (e of events(); track e.id) {
        <a class="card" [routerLink]="['/events', e.id]">
          @if (e.images.length) { <img [src]="'/uploads/' + e.images[0]" [alt]="e.title"> }
          @else { <div class="ph"></div> }
          <div class="body">
            <h3>{{ e.title }}</h3>
            <div class="muted">{{ e.starts_at | date:'EEE d MMM, h:mm a' }}</div>
            <div class="muted">{{ e.location }}</div>
            <app-seat-bar [seats]="e.seats" [taken]="e.taken" />
            <small>
              @if (e.taken >= e.seats) { Full } @else { {{ e.seats - e.taken }} of {{ e.seats }} seats left }
              · hosted by {{ e.host }}
            </small>
          </div>
        </a>
      }
    </div>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1.5rem; }
    .card { background: var(--surface); border: 2px solid var(--line); border-radius: 12px; overflow: hidden; text-decoration: none; display: block; }
    .card:hover { border-color: var(--accent); }
    img, .ph { width: 100%; height: 170px; object-fit: cover; display: block; background: var(--line); }
    .body { padding: 1rem; }
  `],
})
export class EventsListComponent {
  private api = inject(EventsApi);
  events = signal<EventItem[]>([]);
  loading = signal(true);
  constructor() {
    this.api.list().subscribe({ next: (e) => { this.events.set(e); this.loading.set(false); }, error: () => this.loading.set(false) });
  }
}
