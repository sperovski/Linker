import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../shared/api-error';
import { fadeSlideIn } from '../../shared/animations';
import { IconComponent } from '../../shared/icon.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { DotFieldComponent } from '../../shared/dot-field.component';
import { LiquidEtherComponent } from '../../shared/liquid-ether.component';
import { LoaderComponent } from '../../shared/loader.component';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoaderComponent, ReactiveFormsModule, RouterLink, IconComponent, LinkButtonComponent, DotFieldComponent, LiquidEtherComponent],
  animations: [fadeSlideIn],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page" #authPage (mousemove)="onPageMove($event)">
      <app-dot-field />
      <app-liquid-ether
        [colors]="['#2C5E3A', '#3E7B4F', '#6FA07E']"
        [opacity]="0.4"
        [mouseForce]="10"
        [cursorSize]="80"
        [autoIntensity]="1.3"
        [autoSpeed]="0.32"
      />
      <div class="auth-glow auth-glow-follow" aria-hidden="true"></div>
      <div class="auth-card">
        <h1>Welcome back</h1>
        <p class="auth-sub">Log in to your Linker account.</p>

        @if (serverError()) {
          <div class="form-error-banner" @fadeSlideIn role="alert">{{ serverError() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="label" for="email">Email</label>
            <div class="group">
              <app-icon class="icon" name="mail" [size]="18" />
              <input
                id="email"
                type="email"
                class="input"
                formControlName="email"
                autocomplete="email"
                [class.invalid]="showError('email')"
              />
            </div>
            @if (showError('email')) {
              <div class="field-error" @fadeSlideIn>Enter a valid email address.</div>
            }
          </div>

          <div class="field">
            <div class="label-row">
              <label class="label" for="password">Password</label>
              <a routerLink="/forgot-password" class="forgot-link">Forgot password?</a>
            </div>
            <div class="group">
              <app-icon class="icon" name="lock" [size]="18" />
              <input
                id="password"
                type="password"
                class="input"
                formControlName="password"
                autocomplete="current-password"
                [class.invalid]="showError('password')"
              />
            </div>
            @if (showError('password')) {
              <div class="field-error" @fadeSlideIn>Password is required.</div>
            }
          </div>

          <app-link-button type="submit" block [disabled]="submitting()">
            @if (submitting()) {
              <app-loader mode="inline" label="Logging in" /> Logging in…
            } @else {
              Log in
            }
          </app-link-button>
        </form>

        <p class="auth-footer">
          No account yet? <a routerLink="/register">Create one</a>
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .label-row { display: flex; align-items: baseline; justify-content: space-between; }
      .forgot-link { font-size: 0.8125rem; font-weight: 600; }

      /* Cursor-trailing green blob — the same "liquid" glow as the landing hero.
         Sits above the dot field / ether (z 0) but below the card (z 1). A rAF
         spring loop writes a compositor-only transform, so it lags and deforms
         organically instead of tracking the pointer rigidly. */
      .auth-glow {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(56px);
      }

      .auth-glow-follow {
        left: 0;
        top: 0;
        width: 420px;
        height: 420px;
        z-index: 0;
        margin-left: -210px;
        margin-top: -210px;
        transform: translate3d(50vw, 42vh, 0);
        background: radial-gradient(circle, rgba(43, 110, 58, 0.4), transparent 68%);
        will-change: transform;
      }

      @media (prefers-reduced-motion: reduce) {
        .auth-glow-follow { display: none; }
      }
    `,
  ],
})
export class LoginComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly authPage = viewChild<ElementRef<HTMLElement>>('authPage');
  private readonly reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected showError(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate([this.auth.homePath()]),
      error: (err) => {
        this.submitting.set(false);
        this.serverError.set(apiErrorMessage(err, 'Login failed. Please try again.'));
      },
    });
  }

  ngOnDestroy(): void {
    if (this.glowRaf !== null) {
      cancelAnimationFrame(this.glowRaf);
    }
  }

  /**
   * Records where the follow-glow should head; a rAF loop eases it there.
   * Mirrors the landing hero: mousemove only stores the target, and the loop
   * writes a compositor-only transform outside change detection.
   */
  protected onPageMove(event: MouseEvent): void {
    if (this.reducedMotion) {
      return;
    }
    const page = this.authPage()?.nativeElement;
    if (!page) {
      return;
    }
    const rect = page.getBoundingClientRect();
    this.glowTarget = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (this.glowCurrent === null) {
      this.glowCurrent = { ...this.glowTarget };
    }
    if (this.glowRaf === null) {
      this.glowRaf = requestAnimationFrame(this.glowTick);
    }
  }

  private glowTarget = { x: 0, y: 0 };
  private glowCurrent: { x: number; y: number } | null = null;
  private readonly glowVel = { x: 0, y: 0 };
  private glowRaf: number | null = null;

  private readonly glowTick = (): void => {
    const glow = this.authPage()?.nativeElement.querySelector<HTMLElement>('.auth-glow-follow');
    const current = this.glowCurrent;
    if (!glow || !current) {
      this.glowRaf = null;
      return;
    }

    // Spring-damper toward the cursor: a little momentum lets the blob catch up
    // and settle organically rather than tracking the pointer rigidly — that lag
    // is what reads as "liquid".
    const stiffness = 0.055;
    const damping = 0.82;
    this.glowVel.x = (this.glowVel.x + (this.glowTarget.x - current.x) * stiffness) * damping;
    this.glowVel.y = (this.glowVel.y + (this.glowTarget.y - current.y) * stiffness) * damping;
    current.x += this.glowVel.x;
    current.y += this.glowVel.y;

    // Velocity-driven stretch: elongate along travel, pinch across it, so the
    // droplet deforms as it flows.
    const speed = Math.hypot(this.glowVel.x, this.glowVel.y);
    const stretch = Math.min(speed * 0.018, 0.32);
    const angle = (Math.atan2(this.glowVel.y, this.glowVel.x) * 180) / Math.PI;
    glow.style.transform =
      `translate3d(${current.x.toFixed(1)}px, ${current.y.toFixed(1)}px, 0) ` +
      `rotate(${angle.toFixed(1)}deg) scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.6).toFixed(3)}) ` +
      `rotate(${(-angle).toFixed(1)}deg)`;

    const settled =
      speed < 0.05 &&
      Math.abs(this.glowTarget.x - current.x) < 0.5 &&
      Math.abs(this.glowTarget.y - current.y) < 0.5;
    this.glowRaf = settled ? null : requestAnimationFrame(this.glowTick);
  };
}
