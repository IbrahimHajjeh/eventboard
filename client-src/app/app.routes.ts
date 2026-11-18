import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './api';
import { EventsListComponent } from './events-list.component';
import { EventDetailComponent } from './event-detail.component';
import { EventFormComponent } from './event-form.component';
import { LoginComponent } from './login.component';

const needsLogin = () => inject(AuthService).user() ? true : inject(Router).createUrlTree(['/login']);

export const routes: Routes = [
  { path: '', component: EventsListComponent },
  { path: 'events/new', component: EventFormComponent, canActivate: [needsLogin] },
  { path: 'events/:id/edit', component: EventFormComponent, canActivate: [needsLogin] },
  { path: 'events/:id', component: EventDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: '' },
];
