import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs';

export interface EventItem {
  id: number; title: string; description: string; location: string; starts_at: string;
  seats: number; taken: number; joined: boolean; host: string; user_id: number; images: string[];
}
export interface Attendee { username: string; joined_at: string; }
export interface User { id: number; username: string; }
export interface Person { username: string; is_following: boolean; }
export interface Profile {
  id: number; username: string; created_at: string; followers: number; following: number;
  is_following: boolean; events: EventItem[];
}
export interface Notice {
  id: number; type: string; message: string; event_id: number | null; read: boolean;
  created_at: string; actor: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  user = signal<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));

  get token() { return localStorage.getItem('token'); }

  private save(r: { token: string; user: User }) {
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    this.user.set(r.user);
  }
  login(username: string, password: string) {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', { username, password }).pipe(tap((r) => this.save(r)));
  }
  register(username: string, password: string) {
    return this.http.post<{ token: string; user: User }>('/api/auth/register', { username, password }).pipe(tap((r) => this.save(r)));
  }
  logout() {
    localStorage.removeItem('token'); localStorage.removeItem('user'); this.user.set(null);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const t = inject(AuthService).token;
  return next(t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req);
};

@Injectable({ providedIn: 'root' })
export class EventsApi {
  private http = inject(HttpClient);
  list(q = '', following = false) {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (following) params = params.set('following', '1');
    return this.http.get<EventItem[]>('/api/events', { params });
  }
  get(id: number) { return this.http.get<EventItem>(`/api/events/${id}`); }
  create(fd: FormData) { return this.http.post<{ id: number }>('/api/events', fd); }
  update(id: number, fd: FormData) { return this.http.put<{ id: number }>(`/api/events/${id}`, fd); }
  join(id: number) { return this.http.post(`/api/events/${id}/join`, {}); }
  leave(id: number) { return this.http.delete(`/api/events/${id}/join`); }
  attendees(id: number) { return this.http.get<Attendee[]>(`/api/events/${id}/attendees`); }
  remove(id: number) { return this.http.delete(`/api/events/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class SocialApi {
  private http = inject(HttpClient);
  profile(username: string) { return this.http.get<Profile>(`/api/users/${username}`); }
  follow(username: string) { return this.http.post(`/api/users/${username}/follow`, {}); }
  unfollow(username: string) { return this.http.delete(`/api/users/${username}/follow`); }
  friends() { return this.http.get<{ following: Person[]; followers: Person[] }>('/api/friends'); }
  search(q: string) { return this.http.get<Person[]>('/api/users', { params: { q } }); }
  contact(body: { name: string; email: string; message: string }) { return this.http.post('/api/contact', body); }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  unread = signal(0);
  items = signal<Notice[]>([]);
  load() {
    return this.http.get<{ unread: number; items: Notice[] }>('/api/notifications')
      .pipe(tap((r) => { this.unread.set(r.unread); this.items.set(r.items); }));
  }
  refresh() { this.load().subscribe({ error: () => {} }); }
  markRead() { return this.http.post('/api/notifications/read', {}).pipe(tap(() => this.unread.set(0))); }
}

export const errMsg = (e: any) => e?.error?.error || 'Something went wrong. Try again.';
