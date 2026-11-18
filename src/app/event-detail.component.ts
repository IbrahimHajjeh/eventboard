import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService, EventsApi, EventItem, Attendee, errMsg } from './api';
import { SeatBarComponent } from './seat-bar.component';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, SeatBarComponent],
  template: `
    @if (ev(); as e) {
      @if (e.images.length) {
        <div class="gallery">
          @for (img of e.images; track img) { <img [src]="'/uploads/' + img" [alt]="e.title"> }
        </div>
      }
      <div class="panel">
        <h1>{{ e.title }}</h1>
        <p><b>{{ e.starts_at | date:'EEEE d MMMM y, h:mm a' }}</b><br>{{ e.location }}</p>
        <p class="muted">Hosted by <a [routerLink]="['/u', e.host]">{{ e.host }}</a></p>
        @if (e.description) { <p class="desc">{{ e.description }}</p> }

        <app-seat-bar [seats]="e.seats" [taken]="e.taken" />
        <p>{{ e.taken }} of {{ e.seats }} seats taken</p>

        @if (error()) { <div class="error">{{ error() }}</div> }

        @if (isHost()) {
          <div class="actions">
            <a class="btn primary" [routerLink]="['/events', e.id, 'edit']">Edit event</a>
            <button class="danger" (click)="remove()">Delete event</button>
          </div>
        } @else if (!auth.user()) {
          <a class="btn primary" routerLink="/login">Log in to join</a>
        } @else if (e.joined) {
          <button (click)="leave()" [disabled]="busy()">Leave event</button>
        } @else if (e.taken >= e.seats) {
          <button disabled>Event is full</button>
        } @else {
          <button class="primary" (click)="join()" [disabled]="busy()">Join event</button>
        }
      </div>

      @if (isHost()) {
        <div class="panel guests">
          <h2>Guest list</h2>
          @if (!guests().length) { <p class="muted">Nobody has joined yet.</p> }
          <ul>
            @for (g of guests(); track g.username) {
              <li><b>{{ g.username }}</b> <span class="muted">joined {{ g.joined_at | date:'d MMM, h:mm a' }}</span></li>
            }
          </ul>
        </div>
      }
    } @else if (error()) { <div class="error">{{ error() }}</div> }
  `,
  styles: [`
    .gallery { display: flex; gap: .75rem; overflow-x: auto; margin-bottom: 1rem; }
    .gallery img { height: 280px; border-radius: 12px; flex: none; max-width: 100%; object-fit: cover; }
    .desc { white-space: pre-line; max-width: 70ch; }
    .actions { display: flex; gap: .75rem; flex-wrap: wrap; }
    .guests { margin-top: 1rem; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: .55rem 0; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 1rem; }
  `],
})
export class EventDetailComponent {
  auth = inject(AuthService);
  private api = inject(EventsApi);
  private router = inject(Router);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  ev = signal<EventItem | null>(null);
  guests = signal<Attendee[]>([]);
  error = signal('');
  busy = signal(false);

  constructor() { this.load(); }

  isHost() { return !!this.auth.user() && this.auth.user()!.id === this.ev()?.user_id; }

  load() {
    this.api.get(this.id).subscribe({
      next: (e) => {
        this.ev.set(e);
        if (this.isHost()) this.api.attendees(this.id).subscribe((g) => this.guests.set(g));
      },
      error: (e) => this.error.set(errMsg(e)),
    });
  }
  private act(call: ReturnType<EventsApi['join']>) {
    this.busy.set(true); this.error.set('');
    call.subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e)); this.load(); },
    });
  }
  join() { this.act(this.api.join(this.id)); }
  leave() { this.act(this.api.leave(this.id)); }
  remove() {
    if (confirm('Delete this event? Everyone on the guest list will lose their seat.'))
      this.api.remove(this.id).subscribe({ next: () => this.router.navigateByUrl('/'), error: (e) => this.error.set(errMsg(e)) });
  }
}
