import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { EventItem } from './api';
import { SeatBarComponent } from './seat-bar.component';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [RouterLink, DatePipe, SeatBarComponent],
  template: `
    <a class="card" [routerLink]="['/events', e.id]">
      @if (e.images.length) { <img [src]="'/uploads/' + e.images[0]" [alt]="e.title"> } @else { <div class="ph"></div> }
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
    </a>`,
  styles: [`
    .card { background: var(--surface); border: 2px solid var(--line); border-radius: 12px; overflow: hidden; text-decoration: none; display: block; height: 100%; }
    .card:hover { border-color: var(--accent); }
    img, .ph { width: 100%; height: 170px; object-fit: cover; display: block; background: var(--line); }
    .body { padding: 1rem; }
  `],
})
export class EventCardComponent { @Input({ required: true }) e!: EventItem; }
