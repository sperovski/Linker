import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';

export interface GooeyNavItem {
  label: string;
  link: string;
}

/**
 * Top-nav active indicator, a native Angular port of the React Bits "GooeyNav":
 * a green blob pill morphs to the active item and spits a short particle burst
 * on change. Active state follows the real route (so it's correct on refresh and
 * on back/forward), and also animates on click.
 *
 * Dark→light conversion: the reference's CSS `blur() contrast()` goo needs a
 * black backdrop to resolve edges and ghosts on white, so this uses an SVG
 * alpha-goo filter instead (blur → alpha contrast → composite atop), which
 * merges blobs by transparency and is background-independent. Pill + particle
 * colours come from the brand tokens.
 */
@Component({
  selector: 'app-gooey-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="gooey-nav" #root>
      <!-- Alpha-goo filter: background-independent, so it reads on white. -->
      <svg class="goo-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="gooey-nav-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <span class="effect filter" #effect [class.instant]="reducedMotion"></span>
      <!-- Particles live outside the goo filter so they aren't clipped/erased. -->
      <span class="particles" #particles></span>

      <ul class="gn-list" #list>
        @for (item of items(); track item.link; let i = $index) {
          <li class="gn-item" [class.active]="i === activeIndex()">
            <a
              [routerLink]="item.link"
              (click)="activate(i)"
              (keydown.space)="$event.preventDefault(); go(item.link, i)"
            >
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .gooey-nav {
        --gn-1: var(--color-primary);
        --gn-2: var(--brand-sage);
        --gn-3: var(--brand-border);
        --gn-4: var(--brand-deep);
        position: relative;
        display: inline-flex;
      }

      .goo-defs {
        position: absolute;
        width: 0;
        height: 0;
      }

      .gn-list {
        position: relative;
        z-index: 2; /* text sits above the blob pill */
        display: flex;
        align-items: center;
        gap: var(--space-md);
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .gn-item a {
        position: relative;
        display: inline-block;
        padding: 6px 14px;
        border-radius: 999px;
        color: var(--color-text-soft);
        font-weight: 600;
        font-size: 0.9375rem;
        white-space: nowrap;
        transition: color 320ms ease;
      }

      .gn-item a:hover {
        color: var(--color-primary);
        text-decoration: none;
      }

      .gn-item.active a {
        color: #fff; /* sits on the green pill */
      }

      .gn-item a:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 3px;
      }

      /* The gooey blob layer: a green pill + particle droplets, merged by #goo. */
      .effect {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        z-index: 1;
        pointer-events: none;
        filter: url(#gooey-nav-goo);
        transition:
          left 420ms cubic-bezier(0.4, 0, 0.2, 1),
          top 420ms cubic-bezier(0.4, 0, 0.2, 1),
          width 420ms cubic-bezier(0.4, 0, 0.2, 1),
          height 420ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      .effect.instant {
        transition: none;
      }

      .effect::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: var(--color-primary);
      }

      /* Crisp particle burst, above the text, no goo filter (so nothing clips). */
      .particles {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        z-index: 3;
        pointer-events: none;
      }

      /* ::ng-deep: the particle/point nodes are created with createElement, so
         they lack this component's encapsulation attribute — pierce it so these
         rules still reach them. */
      .particles ::ng-deep .particle {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        transform: translate(var(--start-x, 0), var(--start-y, 0));
        animation: gn-particle var(--time, 600ms) ease-out forwards;
      }

      .particles ::ng-deep .point {
        display: block;
        width: var(--r, 14px);
        height: var(--r, 14px);
        margin: calc(var(--r, 14px) / -2);
        border-radius: 999px;
        background: var(--color, var(--gn-1));
        animation: gn-point var(--time, 600ms) ease-out forwards;
      }

      @keyframes gn-particle {
        0% {
          transform: translate(var(--start-x, 0), var(--start-y, 0)) scale(var(--scale, 1));
        }
        100% {
          transform: translate(var(--end-x, 0), var(--end-y, 0)) scale(0);
        }
      }

      @keyframes gn-point {
        0% {
          opacity: 1;
        }
        70% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .effect {
          transition: none;
        }
        .gn-item a {
          transition: none;
        }
      }
    `,
  ],
})
export class GooeyNavComponent implements AfterViewInit, OnDestroy {
  readonly items = input.required<GooeyNavItem[]>();
  readonly animationTime = input(600);
  readonly particleCount = input(15);
  readonly particleDistances = input<[number, number]>([110, 24]);
  readonly particleR = input(100);
  readonly timeVariance = input(300);
  /** 1-based indices into the --gn-1..4 brand palette. */
  readonly colors = input<number[]>([1, 2, 3, 1, 2, 3, 1, 4]);
  readonly initialActiveIndex = input(0);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly effect = viewChild.required<ElementRef<HTMLElement>>('effect');
  private readonly particles = viewChild.required<ElementRef<HTMLElement>>('particles');

  private readonly router = inject(Router);

  protected readonly activeIndex = signal(0);
  protected readonly reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private resizeObserver?: ResizeObserver;
  private routerSub?: Subscription;

  ngAfterViewInit(): void {
    // Active follows the real route; fall back to the requested initial index.
    const fromUrl = this.indexForUrl(this.router.url);
    this.activeIndex.set(fromUrl >= 0 ? fromUrl : this.initialActiveIndex());
    this.positionPill(false);

    this.resizeObserver = new ResizeObserver(() => this.positionPill(false));
    this.resizeObserver.observe(this.list().nativeElement);

    // Route changes (URL bar, back/forward, links elsewhere) re-sync + burst.
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const i = this.indexForUrl(this.router.url);
        if (i >= 0 && i !== this.activeIndex()) {
          this.activeIndex.set(i);
          this.positionPill(true);
        }
      });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.routerSub?.unsubscribe();
  }

  /** Click on an item: immediate visual feedback; routerLink does the navigating. */
  protected activate(i: number): void {
    if (i === this.activeIndex()) return;
    this.activeIndex.set(i);
    this.positionPill(true);
  }

  /** Space key: navigate through the router (not a fake click). */
  protected go(link: string, i: number): void {
    this.activate(i);
    this.router.navigateByUrl(link);
  }

  private indexForUrl(url: string): number {
    const path = url.split('?')[0].split('#')[0];
    return this.items().findIndex(
      (it) => path === it.link || path.startsWith(it.link + '/'),
    );
  }

  private activeItemEl(): HTMLElement | null {
    return this.list().nativeElement.querySelectorAll<HTMLElement>('.gn-item')[
      this.activeIndex()
    ] ?? null;
  }

  private positionPill(burst: boolean): void {
    const li = this.activeItemEl();
    const effect = this.effect().nativeElement;
    const particles = this.particles().nativeElement;
    if (!li) {
      effect.style.opacity = '0';
      return;
    }
    const rootRect = this.root().nativeElement.getBoundingClientRect();
    const rect = li.getBoundingClientRect();
    const left = rect.left - rootRect.left;
    const top = rect.top - rootRect.top;
    effect.style.opacity = '1';
    effect.style.left = `${left}px`;
    effect.style.top = `${top}px`;
    effect.style.width = `${rect.width}px`;
    effect.style.height = `${rect.height}px`;

    // Burst origin: the centre of the active item.
    particles.style.left = `${left + rect.width / 2}px`;
    particles.style.top = `${top + rect.height / 2}px`;

    if (burst && !this.reducedMotion) this.makeParticles(particles);
  }

  private makeParticles(effect: HTMLElement): void {
    const [far, near] = this.particleDistances();
    const count = this.particleCount();
    const palette = this.colors();
    const base = this.animationTime();

    for (let i = 0; i < count; i++) {
      const time = base + Math.random() * this.timeVariance();
      const angle = (360 / count) * i + (Math.random() * 26 - 13);
      const dist = near + Math.random() * (far - near);
      const rad = (angle * Math.PI) / 180;

      const particle = document.createElement('span');
      const point = document.createElement('span');
      particle.className = 'particle';
      point.className = 'point';

      const startScale = 0.6 + Math.random() * 0.6;
      particle.style.setProperty('--start-x', `${Math.cos(rad) * dist * 0.15}px`);
      particle.style.setProperty('--start-y', `${Math.sin(rad) * dist * 0.15}px`);
      particle.style.setProperty('--end-x', `${Math.cos(rad) * dist}px`);
      particle.style.setProperty('--end-y', `${Math.sin(rad) * dist}px`);
      particle.style.setProperty('--time', `${time}ms`);
      particle.style.setProperty('--scale', `${startScale}`);
      point.style.setProperty('--time', `${time}ms`);
      point.style.setProperty('--r', `${9 + Math.random() * 8}px`);
      const colorIdx = palette[i % palette.length];
      point.style.setProperty('--color', `var(--gn-${colorIdx}, var(--gn-1))`);

      particle.appendChild(point);
      effect.appendChild(particle);
      window.setTimeout(() => particle.remove(), time + 60);
    }
  }
}
