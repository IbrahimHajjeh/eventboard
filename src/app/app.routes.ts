import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './api';
import { EventsListComponent } from './events-list.component';
import { EventDetailComponent } from './event-detail.component';
import { EventFormComponent } from './event-form.component';
import { LoginComponent } from './login.component';
import { AboutComponent } from './about.component';
import { ContactComponent } from './contact.component';
import { FriendsComponent } from './friends.component';
import { ProfileComponent } from './profile.component';
import { NotificationsComponent } from './notifications.component';

const needsLogin = () => inject(AuthService).user() ? true : inject(Router).createUrlTree(['/login']);

export const routes: Routes = [
  { path: '', component: EventsListComponent },
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'friends', component: FriendsComponent, canActivate: [needsLogin] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [needsLogin] },
  { path: 'u/:username', component: ProfileComponent },
  { path: 'events/new', component: EventFormComponent, canActivate: [needsLogin] },
  { path: 'events/:id/edit', component: EventFormComponent, canActivate: [needsLogin] },
  { path: 'events/:id', component: EventDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: '' },
];
