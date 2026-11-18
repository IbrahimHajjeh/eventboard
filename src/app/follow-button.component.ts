import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, SocialApi } from './api';

@Component({
  selector: 'app-follow-button',
  standalone: true,
  template: `
    <button [class.primary]="!following" [attr.aria-pressed]="following" [disabled]="busy()" (click)="toggle()">
      {{ following ? 'Following' : 'Follow' }}
    </button>`,
})
export class FollowButtonComponent {
  @Input({ required: true }) username = '';
  @Input() following = false;
  @Output() changed = new EventEmitter<boolean>();
  private api = inject(SocialApi);
  private auth = inject(AuthService);
  private router = inject(Router);
  busy = signal(false);

  toggle() {
    if (!this.auth.user()) { this.router.navigateByUrl('/login'); return; }
    this.busy.set(true);
    const call = this.following ? this.api.unfollow(this.username) : this.api.follow(this.username);
    call.subscribe({
      next: () => { this.following = !this.following; this.busy.set(false); this.changed.emit(this.following); },
      error: () => this.busy.set(false),
    });
  }
}
