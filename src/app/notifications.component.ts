import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificationsService } from './api';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <h1>Notifications</h1>
    <div class="panel">
      @if (loading()) { <span class="muted">Loading…</span> }
      @else if (!notes.items().length) {
        <span class="muted">Nothing yet. When people you follow publish an event, it shows up here.</span>
      }
      <ul class="rows">
        @for (n of notes.items(); track n.id) {
          <li [class.fresh]="fresh().has(n.id)">
            @if (n.event_id) { <a [routerLink]="['/events', n.event_id]">{{ n.message }}</a> }
            @else if (n.actor) { <a [routerLink]="['/u', n.actor]">{{ n.message }}</a> }
            @else { <span>{{ n.message }}</span> }
            <span class="muted">{{ n.created_at | date:'d MMM, h:mm a' }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`.fresh { background: #fff8d6; margin: 0 -1.5rem; padding-left: 1.5rem; padding-right: 1.5rem; }`],
})
export class NotificationsComponent {
  notes = inject(NotificationsService);
  loading = signal(true);
  fresh = signal<Set<number>>(new Set());

  constructor() {
    this.notes.load().subscribe({
      next: (r) => {
        this.fresh.set(new Set(r.items.filter((i) => !i.read).map((i) => i.id)));  // keep highlight for this visit
        this.loading.set(false);
        if (r.unread) this.notes.markRead().subscribe();
      },
      error: () => this.loading.set(false),
    });
  }
}
