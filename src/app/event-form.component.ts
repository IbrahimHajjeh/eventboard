import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, EventsApi, errMsg } from './api';

const MAX_PHOTOS = 5;

// ISO string -> value for <input type="datetime-local"> in the user's timezone
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>{{ editId ? 'Edit event' : 'Publish an event' }}</h1>
    @if (loading()) { <p class="muted">Loading event…</p> }
    @else {
    <form class="panel" (ngSubmit)="submit()">
      <label for="t">Title</label>
      <input id="t" name="title" [(ngModel)]="title" required maxlength="120">

      <label for="d">Description</label>
      <textarea id="d" name="description" rows="4" [(ngModel)]="description"></textarea>

      <label for="l">Location</label>
      <input id="l" name="location" [(ngModel)]="location" required maxlength="200" placeholder="Venue and city">

      <label for="s">Date and time</label>
      <input id="s" name="starts" type="datetime-local" [(ngModel)]="startsAt" required>

      <label for="n">Number of seats</label>
      <input id="n" name="seats" type="number" [min]="taken || 1" max="10000" [(ngModel)]="seats" required>
      @if (taken) { <small class="muted">{{ taken }} already joined, so you can't go lower than {{ taken }}.</small> }

      @if (existing().length) {
        <label>Current photos</label>
        <div class="previews">
          @for (img of existing(); track img) {
            <figure [class.removed]="removed().includes(img)">
              <img [src]="'/uploads/' + img" alt="Current photo">
              <button type="button" (click)="toggleRemove(img)">
                {{ removed().includes(img) ? 'Keep' : 'Remove' }}
              </button>
            </figure>
          }
        </div>
      }

      <label for="p">{{ editId ? 'Add photos' : 'Photos' }} (up to {{ maxNew() }} more, 5 MB each)</label>
      <input id="p" type="file" accept="image/*" multiple (change)="pick($event)">
      @if (previews().length) {
        <div class="previews">@for (p of previews(); track p) { <img [src]="p" alt="Selected photo preview"> }</div>
      }

      @if (error()) { <div class="error">{{ error() }}</div> }
      <p class="actions">
        <button class="primary" type="submit" [disabled]="busy()">{{ editId ? 'Save changes' : 'Publish event' }}</button>
        @if (editId) { <button type="button" (click)="cancel()">Cancel</button> }
      </p>
    </form>
    }
  `,
  styles: [`
    form { max-width: 620px; }
    .previews { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: .5rem; }
    .previews img { height: 80px; border-radius: 8px; display: block; }
    figure { margin: 0; }
    figure button { width: 100%; margin-top: .3rem; padding: .25rem; font-size: .85rem; }
    figure.removed img { opacity: .3; }
    .actions { display: flex; gap: .75rem; }
  `],
})
export class EventFormComponent {
  private api = inject(EventsApi);
  private router = inject(Router);
  private auth = inject(AuthService);
  editId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || 0;

  title = ''; description = ''; location = ''; startsAt = ''; seats = 20; taken = 0;
  files: File[] = [];
  existing = signal<string[]>([]);
  removed = signal<string[]>([]);
  previews = signal<string[]>([]);
  loading = signal(!!this.editId);
  error = signal('');
  busy = signal(false);

  constructor() {
    if (!this.editId) return;
    this.api.get(this.editId).subscribe({
      next: (e) => {
        if (e.user_id !== this.auth.user()?.id) { this.router.navigate(['/events', e.id]); return; }
        this.title = e.title; this.description = e.description; this.location = e.location;
        this.startsAt = toLocalInput(e.starts_at); this.seats = e.seats; this.taken = e.taken;
        this.existing.set(e.images);
        this.loading.set(false);
      },
      error: (e) => { this.loading.set(false); this.error.set(errMsg(e)); },
    });
  }

  maxNew() { return MAX_PHOTOS - (this.existing().length - this.removed().length); }

  toggleRemove(img: string) {
    this.removed.update((r) => (r.includes(img) ? r.filter((x) => x !== img) : [...r, img]));
  }

  pick(ev: Event) {
    const list = Array.from((ev.target as HTMLInputElement).files || []).slice(0, Math.max(this.maxNew(), 0));
    this.files = list;
    this.previews.set(list.map((f) => URL.createObjectURL(f)));
  }

  cancel() { this.router.navigate(['/events', this.editId]); }

  submit() {
    this.error.set('');
    if (!this.title.trim() || !this.location.trim() || !this.startsAt || !(this.seats > 0)) {
      this.error.set('Add a title, location, time and at least one seat.'); return;
    }
    if (this.seats < this.taken) {
      this.error.set(`${this.taken} already joined, so seats can't go below ${this.taken}.`); return;
    }
    const fd = new FormData();
    fd.append('title', this.title);
    fd.append('description', this.description);
    fd.append('location', this.location);
    fd.append('starts_at', new Date(this.startsAt).toISOString());
    fd.append('seats', String(this.seats));
    if (this.editId) fd.append('remove_images', JSON.stringify(this.removed()));
    this.files.forEach((f) => fd.append('images', f));

    this.busy.set(true);
    const call = this.editId ? this.api.update(this.editId, fd) : this.api.create(fd);
    call.subscribe({
      next: (r) => this.router.navigate(['/events', r.id]),
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e)); },
    });
  }
}
