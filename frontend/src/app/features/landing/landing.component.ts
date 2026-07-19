import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { IconComponent } from '../../shared/icon.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { CompanyLogoComponent } from '../../shared/company-logo.component';
import { LinkButtonComponent } from '../../shared/link-button.component';
import { BgDecorComponent } from '../../shared/bg-decor.component';
import { DotFieldComponent } from '../../shared/dot-field.component';
import { LiquidEtherComponent } from '../../shared/liquid-ether.component';
import { HowItStartedComponent } from './how-it-started.component';

const ROTATING_WORDS = ['skills.', 'schedule.', 'ambition.', 'city.'];

type MarqueeItem =
  | { kind: 'word'; text: string; tone: 'navy' | 'teal' }
  | { kind: 'logo'; src: string; alt: string }
  | { kind: 'mark'; text: string };

interface MarqueeRow {
  reverse: boolean;
  duration: number;
  accent: boolean;
  tilted: boolean;
  items: MarqueeItem[];
}

const MARQUEE_ROWS: MarqueeRow[] = [
  {
    reverse: false,
    duration: 36,
    accent: true,
    tilted: false,
    items: [
      { kind: 'word', text: 'Software Engineering', tone: 'navy' },
      { kind: 'logo', src: 'assets/logos/endava.png', alt: 'Endava' },
      { kind: 'word', text: 'Data Science', tone: 'teal' },
      { kind: 'mark', text: 'Netcetera' },
      { kind: 'word', text: 'Product Design', tone: 'navy' },
      { kind: 'logo', src: 'assets/logos/seavus.png', alt: 'Seavus' },
      { kind: 'word', text: 'Finance', tone: 'teal' },
      { kind: 'logo', src: 'assets/logos/nlb.png', alt: 'NLB Banka' },
    ],
  },
  {
    reverse: true,
    duration: 42,
    accent: false,
    tilted: true,
    items: [
      { kind: 'word', text: 'Marketing', tone: 'teal' },
      { kind: 'logo', src: 'assets/logos/stopanska.png', alt: 'Stopanska Banka' },
      { kind: 'word', text: 'Legal', tone: 'navy' },
      { kind: 'logo', src: 'assets/logos/Komercijalna_Banka_AD_Skopje.png', alt: 'Komercijalna Banka' },
      { kind: 'word', text: 'Pharma', tone: 'teal' },
      { kind: 'logo', src: 'assets/logos/alkaloid-skopje-01-logo-svg-vector.svg', alt: 'Alkaloid' },
      { kind: 'word', text: 'Engineering', tone: 'navy' },
      { kind: 'logo', src: 'assets/logos/Replek-Farm-1-scaled.png', alt: 'Replek Farm' },
    ],
  },
  {
    reverse: false,
    duration: 32,
    accent: false,
    tilted: false,
    items: [
      { kind: 'word', text: 'Telecom', tone: 'navy' },
      { kind: 'logo', src: 'assets/logos/a1_makedonija_logo.png', alt: 'A1 Macedonia' },
      { kind: 'word', text: 'Energy', tone: 'teal' },
      { kind: 'mark', text: 'EVN Macedonia' },
      { kind: 'logo', src: 'assets/logos/telekom.png', alt: 'Makedonski Telekom' },
      { kind: 'word', text: 'Manufacturing', tone: 'navy' },
      { kind: 'logo', src: 'assets/logos/Makstil DITH logo header2.png', alt: 'Makstil' },
      { kind: 'logo', src: 'assets/logos/feni.jpg', alt: 'Feni' },
      { kind: 'mark', text: 'Asseco SEE' },
    ],
  },
];

interface Pillar {
  pill: string;
  icon: 'search' | 'check' | 'clock' | 'user';
  headline: string;
  description: string;
  tint: 'navy' | 'sky' | 'green' | 'deep';
  tilt: number;
  radius: string;
  offset: boolean;
}

const PILLARS: Pillar[] = [
  {
    pill: 'Discover',
    icon: 'search',
    headline: 'Smart internship matches',
    description: 'Listings that fit your skills and city, not a wall of noise.',
    tint: 'navy',
    tilt: -1,
    radius: '20px',
    offset: false,
  },
  {
    pill: 'Apply',
    icon: 'check',
    headline: 'One-click applications',
    description: 'Apply with your profile and track everything in one place.',
    tint: 'sky',
    tilt: 0,
    radius: '14px',
    offset: false,
  },
  {
    pill: 'Track',
    icon: 'clock',
    headline: 'Real-time status updates',
    description: 'See exactly where each application stands, the moment it changes.',
    tint: 'green',
    tilt: 1,
    radius: '18px',
    offset: false,
  },
  {
    pill: 'Grow',
    icon: 'user',
    headline: 'Build your profile',
    description: 'Skills, CV and faculty info that companies actually see.',
    tint: 'deep',
    tilt: -0.5,
    radius: '24px',
    offset: false,
  },
];

interface Stat {
  value: number | null;
  suffix: string;
  text: string | null;
  label: string;
}

const STATS: Stat[] = [
  { value: 13, suffix: '+', text: null, label: 'companies hiring' },
  { value: 14, suffix: '', text: null, label: 'faculties represented' },
  { value: 6, suffix: '', text: null, label: 'industries' },
  { value: null, suffix: '', text: 'Weekly', label: 'new roles added' },
];

const FACULTIES = [
  'FINKI',
  'FEIT',
  'Faculty of Mechanical Engineering',
  'Faculty of Civil Engineering',
  'Faculty of Architecture',
  'Faculty of Economics, Skopje',
  'Faculty of Law “Iustinianus Primus”',
  'Faculty of Medicine',
  'Faculty of Pharmacy',
  'Faculty of Natural Sciences and Mathematics',
  'Faculty of Philosophy',
  'Faculty of Philology “Blaže Koneski”',
  'UACS',
  'FON University',
];

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BgDecorComponent, DotFieldComponent, LiquidEtherComponent, RouterLink, IconComponent, RevealDirective, CompanyLogoComponent, LinkButtonComponent, HowItStartedComponent],
  animations: [
    trigger('wordSwap', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('280ms ease-out', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
    trigger('sceneSwap', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('450ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('450ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
  template: `
    <!-- ============================== HERO ============================== -->
    <section class="hero band-tint" #heroSection (mousemove)="onHeroMove($event)">
      <app-bg-decor variant="subtle" />
      <app-dot-field />
      <app-liquid-ether
        [colors]="['#2C5E3A', '#3E7B4F', '#6FA07E']"
        [opacity]="0.4"
        [mouseForce]="10"
        [cursorSize]="80"
        [autoIntensity]="1.3"
        [autoSpeed]="0.32"
      />
      <div class="hero-glow hero-glow-follow"></div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="eyebrow">The internship platform for students</span>
          <h1 class="display">
            Find work that fits<br />your
            <span class="rotator" [@wordSwap]="word()">{{ word() }}</span>
          </h1>
          <p class="hero-sub">
            Internships in Skopje from companies you already know. Real roles,
            honest applications, no noise in between.
          </p>
          <div class="hero-ctas hero-ctas-stack">
            <app-link-button variant="standard" routerLink="/internships" size="lg">
              Browse internships
              <app-icon name="arrow-right" [size]="17" />
            </app-link-button>
            <app-link-button
              variant="standard-secondary"
              size="lg"
              routerLink="/register"
              [queryParams]="{ as: 'company' }"
            >
              Post an internship
            </app-link-button>
          </div>
          <p class="hero-note">Free for students. Always.</p>
        </div>

        <div class="hero-visual" #heroVisual aria-hidden="true">
          <div class="hero-blob"></div>
          <div class="hero-glow hero-glow-fixed"></div>
          @if (scene() === 0) {
            <div class="scene" @sceneSwap>
              <!-- floating card peeking out from behind the phone -->
              <div class="float-item float-back enter-1">
                <div class="bob">
                  <div class="mock-card">
                    <div class="mock-row">
                      <span class="avatar"><span class="person-ic woman"></span></span>
                      <div>
                        <div class="mock-title">Elena Trajkovska</div>
                        <div class="mock-soft">FINKI · Class of 2027</div>
                      </div>
                    </div>
                    <div class="mock-badges">
                      <span class="tag">Angular</span>
                      <span class="tag">SQL</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="phone-wrap enter-0">
                <div class="phone">
                  <span class="phone-island"></span>
                  <div class="phone-screen">
                    <div class="ps-head">Internships</div>
                    <div class="ps-search"><app-icon name="search" [size]="11" /> frontend intern</div>
                    <div class="ps-card">
                      <app-company-logo name="Netcetera" [size]="26" />
                      <div>
                        <div class="ps-name">Frontend Intern</div>
                        <div class="ps-sub">Netcetera · Skopje</div>
                      </div>
                      <span class="ps-chip">Part-time</span>
                    </div>
                    <div class="ps-card">
                      <app-company-logo name="Endava" [size]="26" />
                      <div>
                        <div class="ps-name">Backend Intern</div>
                        <div class="ps-sub">Endava · Skopje</div>
                      </div>
                      <span class="ps-chip">Internship</span>
                    </div>
                    <div class="ps-card ps-dim">
                      <app-company-logo name="Seavus" [size]="26" />
                      <div>
                        <div class="ps-name">UX Intern</div>
                        <div class="ps-sub">Seavus · Remote</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="float-item float-front enter-2">
                <div class="bob bob-late">
                  <div class="mock-card mock-raised">
                    <span class="badge badge-accepted">Accepted</span>
                    <div class="mock-soft" style="margin-top: 6px;">Data Science Intern</div>
                  </div>
                </div>
              </div>

              <div class="float-item float-chip enter-3">
                <div class="bob bob-later">
                  <div class="mock-chip">
                    <app-icon name="check" [size]="13" />
                    Application sent
                  </div>
                </div>
              </div>
            </div>
          } @else {
            <div class="scene" @sceneSwap>
              <div class="float-item float-back enter-1">
                <div class="bob">
                  <div class="mock-card">
                    <div class="mock-row">
                      <app-company-logo name="Endava" [size]="40" />
                      <div>
                        <div class="mock-title">Backend Intern</div>
                        <div class="mock-soft">Endava · Skopje</div>
                      </div>
                    </div>
                    <div class="mock-badges">
                      <span class="badge badge-type">Internship</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="phone-wrap enter-0">
                <div class="phone">
                  <span class="phone-island"></span>
                  <div class="phone-screen">
                    <div class="ps-head">Applicants</div>
                    <div class="ps-sub-head">Backend Intern · 3 applications</div>
                    <div class="ps-card">
                      <span class="ps-avatar"><span class="person-ic woman"></span></span>
                      <div>
                        <div class="ps-name">Elena T.</div>
                        <div class="ps-sub">Angular · SQL · Git</div>
                      </div>
                      <span class="ps-chip ps-chip-green">Accepted</span>
                    </div>
                    <div class="ps-card">
                      <span class="ps-avatar av2"><span class="person-ic man"></span></span>
                      <div>
                        <div class="ps-name">Marko S.</div>
                        <div class="ps-sub">Python · Docker</div>
                      </div>
                      <span class="ps-chip ps-chip-amber">Pending</span>
                    </div>
                    <div class="ps-card ps-dim">
                      <span class="ps-avatar av3"><span class="person-ic woman"></span></span>
                      <div>
                        <div class="ps-name">Sara J.</div>
                        <div class="ps-sub">Figma · CSS</div>
                      </div>
                      <span class="ps-chip ps-chip-amber">Pending</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="float-item float-front enter-2">
                <div class="bob bob-late">
                  <div class="mock-card mock-raised">
                    <span class="badge badge-pending">3 new applicants</span>
                    <div class="mock-soft" style="margin-top: 6px;">Backend Intern</div>
                  </div>
                </div>
              </div>

              <div class="float-item float-chip enter-3">
                <div class="bob bob-later">
                  <div class="mock-chip">
                    <app-icon name="user" [size]="13" />
                    Profile viewed
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ===================== SECTION 1: MARQUEE WALL ===================== -->
    <section class="wall" aria-label="Categories and companies on Linker">
      <div class="wall-glow" aria-hidden="true"></div>
      @for (row of marqueeRows; track $index) {
        <div
          class="marquee wall-row"
          [class.wall-row-accent]="row.accent"
          [class.wall-row-tilt]="row.tilted"
        >
          <div
            class="marquee-track wall-track"
            [class.wall-track-reverse]="row.reverse"
            [style.animation-duration.s]="row.duration"
          >
            @for (dup of [0, 1]; track dup) {
              <span class="wall-seq" [attr.aria-hidden]="dup === 1 ? 'true' : null">
                @for (item of row.items; track $index) {
                  @switch (item.kind) {
                    @case ('word') {
                      <span class="wall-word" [class.wall-word-teal]="item.tone === 'teal'">{{ item.text }}</span>
                    }
                    @case ('logo') {
                      <span class="wall-logo"><img [src]="item.src" [alt]="item.alt" loading="lazy" /></span>
                    }
                    @case ('mark') {
                      <span class="wall-mark">{{ item.text }}</span>
                    }
                  }
                  <span class="wall-dot" aria-hidden="true">◆</span>
                }
              </span>
            }
          </div>
        </div>
      }
    </section>

    <!-- ================== SECTION 2: FOUR PILLARS ======================== -->
    <section class="band band-surface pillars-band">
      <div class="container">
        <div class="pillars-head" appReveal>
          <span class="eyebrow">How Linker works</span>
          <h2>Your whole internship journey,<br />one platform.</h2>
        </div>
        <div class="pillars">
          @for (pillar of pillars; track pillar.pill; let i = $index) {
            <div class="pillar" [class.pillar-offset]="pillar.offset" appReveal [revealDelay]="i * 70">
              <div class="pillar-pill">
                <span class="pill-badge" [class]="'pill-badge tint-' + pillar.tint">
                  <app-icon [name]="pillar.icon" [size]="13" />
                </span>
                {{ pillar.pill }}
              </div>
              <h3 class="pillar-headline">{{ pillar.headline }}</h3>
              <p class="pillar-desc">{{ pillar.description }}</p>
              <div
                class="pillar-mock"
                [class]="'pillar-mock mock-' + pillar.tint"
                [style.border-radius]="pillar.radius"
                [style.--tilt]="pillar.tilt + 'deg'"
              >
                @switch (pillar.tint) {
                  @case ('navy') {
                    <div class="pm-search"><app-icon name="search" [size]="12" /> frontend intern</div>
                    <div class="pm-line"><span class="pm-dot"></span> Frontend Intern · Skopje</div>
                    <div class="pm-line pm-dim"><span class="pm-dot"></span> UX Intern · Remote</div>
                  }
                  @case ('sky') {
                    <div class="pm-line">Cover letter attached</div>
                    <div class="pm-btn"><app-icon name="check" [size]="12" /> Application sent</div>
                  }
                  @case ('green') {
                    <div class="pm-line">Backend Intern <span class="pm-chip">Accepted</span></div>
                    <div class="pm-line">Data Intern <span class="pm-chip pm-chip-soft">Pending</span></div>
                  }
                  @case ('deep') {
                    <div class="pm-line"><span class="pm-avatar">E</span> Elena · FINKI</div>
                    <div class="pm-tags"><span>Angular</span><span>SQL</span><span>Git</span></div>
                  }
                }
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ========================= HOW IT STARTED ========================= -->
    <app-how-it-started />

    <!-- ============== SECTION 3: STATS + TRUST WALL + CTA ================ -->
    <section class="band band-brand stats-band" #statsSection>
      <div class="container">
        <div class="stats-grid" appReveal>
          @for (stat of stats; track stat.label; let i = $index) {
            <div class="stat">
              <span class="stat-value">
                @if (stat.value !== null) {
                  {{ displayedStats()[i] }}{{ stat.suffix }}
                } @else {
                  {{ stat.text }}
                }
              </span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
          }
        </div>

        <p class="wall-title">Students from every corner of campus</p>
        <ul class="faculty-wall" appReveal>
          @for (faculty of faculties; track faculty) {
            <li>{{ faculty }}</li>
          }
        </ul>

        <div class="stats-cta" appReveal>
          <h2 class="display cta-title">Ready to get linked?</h2>
          <div class="hero-ctas cta-center">
            <app-link-button variant="secondary" size="lg" routerLink="/register">
              Sign up as a student
              <app-icon name="arrow-right" [size]="17" />
            </app-link-button>
            <app-link-button variant="primary" size="lg" routerLink="/register" [queryParams]="{ as: 'company' }">
              Sign up as a company
            </app-link-button>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer band-surface">
      <div class="container footer-inner">
        <span class="footer-brand">Linker</span>
        <span class="footer-note">Built for students and the companies that hire them.</span>
      </div>
    </footer>
  `,
  styles: [
    `
      /* ------------------------------- hero ------------------------------ */
      /* position: relative anchors app-bg-decor; the grid sits above it.
         The app shell reserves --nav-clearance at the top for the floating nav;
         the hero cancels it with a negative margin so its decorated background
         bleeds up under the (translucent) bar, then adds it back as padding so
         the copy still clears the nav. No plain strip above the hero. */
      .hero {
        position: relative;
        margin-top: calc(-1 * var(--nav-clearance));
        padding: calc(var(--nav-clearance) + var(--space-3xl)) 0 var(--space-3xl);
        overflow: hidden;
      }
      .hero > .container, .hero .hero-grid { position: relative; z-index: 1; }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: var(--space-2xl);
        align-items: center;
      }

      .hero-sub {
        font-size: 1.15rem;
        color: var(--color-text-soft);
        max-width: 460px;
        margin: var(--space-md) 0 var(--space-lg);
      }

      .rotator {
        color: var(--color-primary);
        display: inline-block;
        min-width: 5.2ch;
      }

      .hero-ctas { display: flex; gap: var(--space-md); flex-wrap: wrap; }

      /* Top hero only: stack the two CTAs vertically instead of side by side. */
      .hero-ctas-stack { flex-direction: column; align-items: flex-start; }

      .hero-note {
        margin-top: var(--space-md);
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-soft);
      }

      .hero-visual {
        position: relative;
        min-height: 540px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .scene { position: absolute; inset: 0; }

      /* soft organic tint behind the whole composition */
      .hero-blob {
        position: absolute;
        top: 4%;
        left: 6%;
        width: 92%;
        height: 90%;
        background: var(--brand-tint); /* soft green tint of the brand */
        border-radius: 58% 42% 55% 45% / 48% 55% 45% 52%;
        transform: rotate(-6deg);
      }

      /* Soft radial glows over the blob, behind the phone (z2) and cards. */
      .hero-glow {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(56px);
      }

      /* Anchored to the top-right corner of the phone composition; never moves. */
      .hero-glow-fixed {
        top: -10%;
        right: -8%;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(62, 123, 79, 0.34), transparent 70%);
      }

      /* Trails the cursor anywhere over the hero. Position is driven by a rAF
         lerp in the component writing transform directly — compositor-only,
         so it stays smooth where a left/top transition would jank and restart
         on every mousemove. */
      /* Trails the cursor across the whole hero (direct child of .hero). Sits
         above the background decor but below the copy/visual (both z-index: 1). */
      .hero-glow-follow {
        left: 0;
        top: 0;
        width: 420px;
        height: 420px;
        z-index: 0;
        /* Centered on its own transform origin via negative margins so the JS
           transform is free to translate + deform without a trailing offset. */
        margin-left: -210px;
        margin-top: -210px;
        /* Resting spot before the first mousemove; jumps to the cursor on move. */
        transform: translate3d(400px, 260px, 0);
        background: radial-gradient(circle, rgba(43, 110, 58, 0.4), transparent 68%);
        will-change: transform;
      }

      /* ------------------------- iPhone frame --------------------------- */
      .phone-wrap {
        position: absolute;
        top: 3%;
        left: 50%;
        margin-left: -122px;
        z-index: 2;
      }

      .phone {
        position: relative;
        width: 244px;
        height: 500px;
        background: var(--color-foreground);
        border-radius: 42px;
        padding: 10px;
        box-shadow:
          0 24px 48px rgba(30, 27, 75, 0.28),
          0 6px 14px rgba(30, 27, 75, 0.18);
        transform: rotate(3deg);
      }

      /* side buttons */
      .phone::before,
      .phone::after {
        content: '';
        position: absolute;
        background: var(--color-foreground);
        border-radius: 3px;
      }

      .phone::before { right: -3px; top: 120px; width: 3px; height: 56px; }  /* power */
      .phone::after { left: -3px; top: 96px; width: 3px; height: 84px; }     /* volume */

      .phone-island {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 76px;
        height: 22px;
        background: var(--color-foreground);
        border-radius: 999px;
        z-index: 2;
      }

      .phone-screen {
        width: 100%;
        height: 100%;
        background: var(--color-background);
        border-radius: 32px;
        padding: 46px 12px 14px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ps-head {
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--color-foreground);
      }

      .ps-sub-head { font-size: 0.6875rem; color: var(--color-text-soft); font-weight: 600; margin-top: -4px; }

      .ps-search {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--color-text-soft);
      }

      .ps-card {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 10px;
      }

      .ps-card > div { flex: 1; min-width: 0; }
      .ps-dim { opacity: 0.6; }

      .ps-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        color: #fff;
        font-size: 0.6875rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .ps-avatar.av2 { background: linear-gradient(135deg, var(--color-secondary), var(--color-accent)); }
      .ps-avatar.av3 { background: linear-gradient(135deg, var(--color-accent), var(--color-primary)); }

      /* Gendered student silhouettes, tinted white via CSS mask so they sit
         cleanly inside the coloured avatar circles. */
      .person-ic {
        display: block;
        background-color: currentColor;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-size: contain;
        mask-size: contain;
      }
      .person-ic.man { -webkit-mask-image: url('/student.png'); mask-image: url('/student.png'); }
      .person-ic.woman { -webkit-mask-image: url('/woman.png'); mask-image: url('/woman.png'); }
      .ps-avatar .person-ic { width: 15px; height: 15px; }
      .avatar .person-ic { width: 22px; height: 22px; }

      .ps-name {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--color-foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ps-sub {
        font-size: 0.625rem;
        color: var(--color-text-soft);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ps-chip {
        font-size: 0.5625rem;
        font-weight: 700;
        background: var(--brand-tint);
        color: var(--brand-sage);
        border-radius: 999px;
        padding: 3px 8px;
        flex-shrink: 0;
      }

      .ps-chip-green { background: #DCFCE7; color: #166534; }
      .ps-chip-amber { background: #FEF3C7; color: #92400E; }

      /* --------------------- floating cards, layered -------------------- */
      .float-item { position: absolute; }

      .float-back {
        z-index: 1; /* partially hidden behind the phone */
        top: 12%;
        left: 50%;
        margin-left: -215px;
        transform: scale(0.94);
      }

      .float-back .mock-card { box-shadow: var(--shadow-md); }

      .float-front {
        z-index: 3; /* overlaps the phone's right edge */
        top: 55%;
        left: 50%;
        margin-left: 68px;
      }

      .float-chip {
        z-index: 3;
        top: 86%;
        left: 50%;
        margin-left: -170px;
      }

      .mock-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-md);
        box-shadow: var(--shadow-lg);
      }

      .mock-raised {
        box-shadow:
          0 18px 34px rgba(30, 27, 75, 0.2),
          0 4px 10px rgba(30, 27, 75, 0.12);
        transform: scale(1.03);
      }

      .mock-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--color-foreground);
        color: #fff;
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: 999px;
        padding: 8px 14px;
        box-shadow: var(--shadow-lg);
      }

      .mock-row { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); }
      .mock-title { font-weight: 700; font-size: 0.95rem; }
      .mock-soft { color: var(--color-text-soft); font-size: 0.8125rem; }
      .mock-badges { display: flex; gap: var(--space-xs); flex-wrap: wrap; }

      /* entrance: phone rises first, cards stagger in after */
      @keyframes rise {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: none; }
      }

      .enter-0 { animation: rise 360ms ease-out both; }
      .enter-1 { animation: rise 300ms 380ms ease-out both; }
      .enter-2 { animation: rise 300ms 470ms ease-out both; }
      .enter-3 { animation: rise 300ms 560ms ease-out both; }

      /* subtle idle bob once settled */
      @keyframes bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }

      .bob { animation: bob 3.6s ease-in-out 1s infinite; }
      .bob-late { animation-delay: 1.4s; animation-duration: 4s; }
      .bob-later { animation-delay: 1.8s; animation-duration: 3.4s; }

      @media (prefers-reduced-motion: reduce) {
        .enter-0, .enter-1, .enter-2, .enter-3 { animation: none; }
        .bob, .bob-late, .bob-later { animation: none; }
      }

      /* ================= SECTION 1: marquee wall ======================== */
      .wall {
        position: relative;
        padding: var(--space-2xl) 0;
        background: #f8f8fd; /* lightest chapter tint of --color-background */
        border-top: 1px solid var(--color-border);
        border-bottom: 1px solid var(--color-border);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
      }

      /* soft off-center violet glow — asymmetric on purpose */
      .wall-glow {
        position: absolute;
        top: -30%;
        left: 12%;
        width: 55%;
        height: 160%;
        background: radial-gradient(ellipse at center, rgba(46, 107, 58, 0.08), transparent 65%);
        pointer-events: none;
      }

      .wall-row { position: relative; }

      .wall-row-tilt { transform: rotate(-1.5deg); }

      .wall-track {
        display: inline-flex;
        align-items: center;
        animation-name: marquee-scroll;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
      }

      .wall-track-reverse { animation-direction: reverse; }

      .wall-seq { display: inline-flex; align-items: center; }

      .wall-word {
        font-size: clamp(2.6rem, 5.4vw, 4.2rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.025em;
        line-height: 1;
        color: var(--color-foreground);
        white-space: nowrap;
      }

      .wall-word-teal { color: var(--color-secondary); }

      /* accent row: heavier and larger than its siblings */
      .wall-row-accent .wall-word {
        font-size: clamp(3.4rem, 7vw, 6rem);
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .wall-mark {
        font-size: clamp(1.6rem, 3vw, 2.4rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: var(--color-primary);
        white-space: nowrap;
        border: 2px solid var(--color-border);
        border-radius: 14px;
        padding: 10px 22px;
        background: var(--color-surface);
      }

      .wall-logo {
        display: inline-flex;
        align-items: center;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        padding: 12px 22px;
      }

      .wall-logo img { height: 40px; width: auto; display: block; }

      .wall-row-accent .wall-logo img { height: 52px; }

      .wall-dot {
        color: var(--color-secondary);
        font-size: 0.9rem;
        margin: 0 var(--space-lg);
        opacity: 0.7;
      }

      @media (prefers-reduced-motion: reduce) {
        .wall-track { animation: none; }
      }

      /* ================= SECTION 2: four pillars ======================== */
      .pillars-band { background: var(--color-surface); }

      .pillars-head { max-width: 560px; margin-bottom: var(--space-2xl); }

      .pillars-head h2 {
        font-size: clamp(1.75rem, 3.4vw, 2.5rem);
        letter-spacing: -0.025em;
      }

      .pillars {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-lg);
        align-items: start;
      }

      /* the one deliberate grid break: second column rides higher */
      .pillar-offset { margin-top: calc(-1 * var(--space-lg)); }

      .pillar-pill {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        padding: 6px 14px 6px 6px;
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--color-foreground);
        margin-bottom: var(--space-md);
        background: var(--color-surface);
      }

      .pill-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        color: #fff;
        transition: transform 200ms ease;
      }

      /* small independent micro-animation, separate from any card motion */
      .pillar:hover .pill-badge { transform: rotate(-12deg) scale(1.15); }

      .tint-navy { background: var(--color-primary); }
      .tint-sky { background: var(--color-secondary); }
      .tint-green { background: var(--color-accent); }
      .tint-deep { background: var(--color-foreground); }

      .pillar-headline {
        font-size: 1.35rem;
        letter-spacing: -0.02em;
        margin-bottom: var(--space-xs);
      }

      .pillar-desc {
        color: var(--color-text-soft);
        font-size: 0.9rem;
        min-height: 3em;
      }

      .pillar-mock {
        padding: var(--space-lg) var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        color: #fff;
        transform: rotate(var(--tilt, 0deg));
        transition: transform 200ms ease, box-shadow 200ms ease;
        box-shadow: var(--shadow-md);
      }

      .pillar:hover .pillar-mock {
        transform: rotate(0deg) translateY(-4px);
        box-shadow: var(--shadow-lg);
      }

      .mock-navy { background: var(--color-primary); }
      .mock-sky { background: var(--color-secondary); }
      .mock-green { background: var(--color-accent); }
      .mock-deep { background: var(--color-foreground); }

      .pm-search,
      .pm-line {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        background: rgba(255, 255, 255, 0.14);
        border-radius: 10px;
        padding: 9px 12px;
        font-size: 0.8125rem;
        font-weight: 600;
      }

      .pm-search { background: rgba(255, 255, 255, 0.92); color: var(--color-foreground); }
      .pm-dim { opacity: 0.6; }
      .pm-dot { width: 7px; height: 7px; border-radius: 50%; background: #fff; flex-shrink: 0; }

      .pm-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-xs);
        background: #fff;
        color: var(--color-secondary);
        border-radius: 10px;
        padding: 10px;
        font-size: 0.8125rem;
        font-weight: 700;
      }

      .pm-chip {
        margin-left: auto;
        background: #fff;
        color: var(--color-accent);
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 0.6875rem;
        font-weight: 700;
      }

      .pm-chip-soft { background: rgba(255, 255, 255, 0.35); color: #fff; }

      .pm-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.25);
        font-size: 0.6875rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .pm-tags { display: flex; gap: var(--space-xs); flex-wrap: wrap; }

      .pm-tags span {
        background: rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        padding: 4px 11px;
        font-size: 0.75rem;
        font-weight: 600;
      }


      @media (max-width: 1023px) {
        .pillars { grid-template-columns: 1fr 1fr; }
        .pillar-offset { margin-top: 0; }
      }

      @media (max-width: 640px) {
        .pillars { grid-template-columns: 1fr; }
        .pillar-desc { min-height: 0; }
      }

      /* ============ SECTION 3: stats + trust wall + CTA ================== */
      .stats-band { position: relative; overflow: hidden; }

      /* faint grain so the dark band doesn't read as flat fill */
      .stats-band::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.025;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
      }

      .stats-band .container { position: relative; z-index: 1; }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-lg);
        text-align: center;
        margin-bottom: var(--space-2xl);
      }

      @media (max-width: 767px) {
        .stats-grid { grid-template-columns: 1fr 1fr; }
      }

      .stat-value {
        display: block;
        font-size: clamp(2.6rem, 5vw, 4rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.05;
        color: #fff;
      }

      .stat-label {
        display: block;
        margin-top: var(--space-xs);
        color: var(--brand-border); /* light sage, ~8:1 on the deep green band */
        font-size: 0.9rem;
        font-weight: 600;
      }

      .wall-title {
        text-align: center;
        color: rgba(183, 220, 192, 0.8);
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: var(--space-lg);
      }

      .faculty-wall {
        list-style: none;
        margin: 0 0 var(--space-2xl);
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-sm) var(--space-xl);
        max-width: 900px;
        margin-left: auto;
        margin-right: auto;
      }

      .faculty-wall li {
        color: rgba(255, 255, 255, 0.45);
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.01em;
        white-space: nowrap;
        transition: color 200ms ease;
      }

      .faculty-wall li:hover { color: rgba(255, 255, 255, 0.8); }

      .stats-cta {
        text-align: center;
        border-top: 1px solid rgba(255, 255, 255, 0.14);
        padding-top: var(--space-2xl);
      }

      .cta-title { margin-bottom: var(--space-lg); }

      .cta-center { justify-content: center; }

      /* ------------------------------ footer ----------------------------- */
      .footer { border-top: 1px solid var(--color-border); padding: var(--space-lg) 0; }

      .footer-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        flex-wrap: wrap;
      }

      .footer-brand { display: inline-flex; align-items: center; gap: var(--space-sm); font-weight: 700; }

      .footer-note { color: var(--color-text-soft); font-size: 0.875rem; }

      /* ----------------------------- responsive -------------------------- */
      @media (max-width: 1023px) {
        .hero-grid { grid-template-columns: 1fr; }
        .hero-visual { min-height: 540px; max-width: 480px; width: 100%; margin: 0 auto; }
      }

      @media (max-width: 767px) {
        .hero { padding: calc(var(--nav-clearance) + var(--space-2xl)) 0 var(--space-2xl); }
        .band { padding: var(--space-2xl) 0; }
        .wall { padding: var(--space-xl) 0; gap: var(--space-md); }
        .wall-logo img { height: 30px; }
        .wall-row-accent .wall-logo img { height: 36px; }
      }

      @media (max-width: 520px) {
        .hero-visual { min-height: 430px; }
        .scene { transform: scale(0.78); transform-origin: top center; }
        .float-back { display: none; }
        .float-chip { margin-left: -130px; }
      }
    `,
  ],
})
export class LandingComponent implements OnInit, OnDestroy {
  protected readonly marqueeRows = MARQUEE_ROWS;
  protected readonly pillars = PILLARS;
  protected readonly stats = STATS;
  protected readonly faculties = FACULTIES;

  private readonly statsSection = viewChild.required<ElementRef<HTMLElement>>('statsSection');
  private readonly heroSection = viewChild<ElementRef<HTMLElement>>('heroSection');
  private readonly host = inject(ElementRef);

  private wordIndex = signal(0);
  protected readonly word = signal(ROTATING_WORDS[0]);
  protected readonly scene = signal(0);
  protected readonly displayedStats = signal(STATS.map(() => 0));

  private timers: ReturnType<typeof setInterval>[] = [];
  private statsObserver: IntersectionObserver | null = null;
  private reducedMotion = false;

  ngOnInit(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.reducedMotion) {
      // Show final values immediately; skip all decorative rotation.
      this.displayedStats.set(STATS.map((s) => s.value ?? 0));
      return;
    }

    this.timers.push(
      setInterval(() => {
        this.wordIndex.update((i) => (i + 1) % ROTATING_WORDS.length);
        this.word.set(ROTATING_WORDS[this.wordIndex()]);
      }, 2600),
      setInterval(() => this.scene.update((s) => (s + 1) % 2), 5200),
    );

    // Count-up when the stats band scrolls into view, once.
    this.statsObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.statsObserver?.disconnect();
          this.runCountUp();
        }
      },
      { threshold: 0.25 },
    );
    this.statsObserver.observe(this.statsSection().nativeElement);
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearInterval);
    this.statsObserver?.disconnect();
    if (this.glowRaf !== null) {
      cancelAnimationFrame(this.glowRaf);
    }
  }

  /**
   * Records where the follow-glow should head; a rAF loop eases it there.
   * Everything happens outside change detection — mousemove only stores the
   * target, and the loop writes a compositor-only transform.
   */
  protected onHeroMove(event: MouseEvent): void {
    if (this.reducedMotion) {
      return; // Both glows stay put for reduced-motion users.
    }
    const hero = this.heroSection()?.nativeElement;
    if (!hero) {
      return;
    }
    const rect = hero.getBoundingClientRect();
    this.glowTarget = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (this.glowCurrent === null) {
      // First movement: start at the cursor instead of flying in from afar.
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
    const glow = this.heroSection()?.nativeElement.querySelector<HTMLElement>('.hero-glow-follow');
    const current = this.glowCurrent;
    if (!glow || !current) {
      this.glowRaf = null;
      return;
    }

    // Spring-damper toward the cursor. A little momentum (low stiffness, soft
    // damping) lets the blob catch up and settle organically rather than
    // tracking the pointer rigidly — that lag is what reads as "liquid".
    const stiffness = 0.055;
    const damping = 0.82;
    this.glowVel.x = (this.glowVel.x + (this.glowTarget.x - current.x) * stiffness) * damping;
    this.glowVel.y = (this.glowVel.y + (this.glowTarget.y - current.y) * stiffness) * damping;
    current.x += this.glowVel.x;
    current.y += this.glowVel.y;

    // Velocity-driven stretch: elongate along the direction of travel and pinch
    // across it (volume-preserving), so the droplet deforms as it flows.
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

  private runCountUp(): void {
    const durationMs = 1000;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      this.displayedStats.set(STATS.map((s) => Math.round((s.value ?? 0) * eased)));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }
}
