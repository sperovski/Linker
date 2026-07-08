import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
    title: 'Linker — Internships that fit',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Log in — Linker',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
    title: 'Sign up — Linker',
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email.component').then((m) => m.VerifyEmailComponent),
    title: 'Verify email — Linker',
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    title: 'Reset password — Linker',
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
    title: 'Choose a new password — Linker',
  },
  {
    path: 'admin',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    title: 'Admin — Linker',
  },
  {
    path: 'internships',
    loadComponent: () => import('./features/student/browse.component').then((m) => m.BrowseComponent),
    title: 'Browse internships — Linker',
  },
  {
    path: 'internships/:id',
    loadComponent: () =>
      import('./features/student/internship-detail.component').then((m) => m.InternshipDetailComponent),
    title: 'Internship — Linker',
  },
  {
    path: 'applications',
    canActivate: [roleGuard('Student')],
    loadComponent: () =>
      import('./features/student/my-applications.component').then((m) => m.MyApplicationsComponent),
    title: 'My applications — Linker',
  },
  {
    path: 'saved',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/saved.component').then((m) => m.SavedComponent),
    title: 'Saved internships — Linker',
  },
  {
    path: 'cv-review',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/cv-review.component').then((m) => m.CvReviewComponent),
    title: 'Rate my CV — Linker',
  },
  {
    path: 'profile',
    canActivate: [roleGuard('Student')],
    loadComponent: () =>
      import('./features/student/student-profile.component').then((m) => m.StudentProfileComponent),
    title: 'My profile — Linker',
  },
  {
    path: 'company/dashboard',
    canActivate: [roleGuard('Company')],
    loadComponent: () =>
      import('./features/company/dashboard.component').then((m) => m.CompanyDashboardComponent),
    title: 'Dashboard — Linker',
  },
  {
    path: 'company/listings',
    canActivate: [roleGuard('Company')],
    loadComponent: () =>
      import('./features/company/my-listings.component').then((m) => m.MyListingsComponent),
    title: 'My listings — Linker',
  },
  {
    path: 'company/internships/new',
    canActivate: [roleGuard('Company')],
    loadComponent: () =>
      import('./features/company/internship-form.component').then((m) => m.InternshipFormComponent),
    title: 'Post an internship — Linker',
  },
  {
    path: 'company/internships/:id/edit',
    canActivate: [roleGuard('Company')],
    loadComponent: () =>
      import('./features/company/internship-form.component').then((m) => m.InternshipFormComponent),
    title: 'Edit internship — Linker',
  },
  {
    path: 'company/internships/:id/applicants',
    canActivate: [roleGuard('Company')],
    loadComponent: () =>
      import('./features/company/applicants.component').then((m) => m.ApplicantsComponent),
    title: 'Applicants — Linker',
  },
  {
    path: 'company/profile',
    canActivate: [roleGuard('Company')],
    loadComponent: () =>
      import('./features/company/company-profile.component').then((m) => m.CompanyProfileComponent),
    title: 'Company profile — Linker',
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page not found — Linker',
  },
];
