import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';

export interface EventItem {
  id: number; title: string; description: string; location: string; starts_at: string;
  seats: number; taken: number; joined: boolean; host: string; user_id: number; images: string[];
}
export interface Attendee { username: string; joined_at: string; }
export interface User { id: number; username: string; }

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
  list() { return this.http.get<EventItem[]>('/api/events'); }
  get(id: number) { return this.http.get<EventItem>(`/api/events/${id}`); }
  create(fd: FormData) { return this.http.post<{ id: number }>('/api/events', fd); }
  update(id: number, fd: FormData) { return this.http.put<{ id: number }>(`/api/events/${id}`, fd); }
  join(id: number) { return this.http.post(`/api/events/${id}/join`, {}); }
  leave(id: number) { return this.http.delete(`/api/events/${id}/join`); }
  attendees(id: number) { return this.http.get<Attendee[]>(`/api/events/${id}/attendees`); }
  remove(id: number) { return this.http.delete(`/api/events/${id}`); }
}

export const errMsg = (e: any) => e?.error?.error || 'Something went wrong. Try again.';
