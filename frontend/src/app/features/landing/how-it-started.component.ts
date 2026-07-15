import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../shared/reveal.directive';

interface Milestone {
  date: string;
  title: string;
  body: string;
}

const MILESTONES: Milestone[] = [
  {
    date: 'Sept 2024',
    title: 'The idea',
    body:
      'The job sites we knew either had almost nothing for students or asked for hours and ' +
      'experience that no student actually has. Employers who just needed a young part-timer ' +
      'for a few hours a week had nowhere good to post, and some ended up taping printed ads ' +
      'to walls. LINKER started as an answer to that gap.',
  },
  {
    date: 'Nov 2024',
    title: 'First public reveal',
    body:
      'We showed LINKER for the first time on 18 November 2024 at Laboratorium, during an ' +
      "event the University Student Assembly at UKIM held around International Students' Day. " +
      'At that point it was about eight students from different faculties and an early demo. ' +
      'The job ads were running on a Discord server while the website was still being built.',
  },
  {
    date: 'April 2026',
    title: 'Students build it together',
    body:
      'To turn the demo into a real product, we ran a two-day hackathon called Linker on ' +
      '18-19 April 2026, where about 45 students worked on the platform together. Everyone ' +
      'who took part contributed, taking some of their own ideas and building them into ' +
      'LINKER. This was the moment it grew from a Discord-based demo into a platform that ' +
      'students built together.',
  },
  {
    date: 'Today',
    title: 'A full platform',
    body:
      'LINKER is now a full web platform built with Angular and .NET. Students can browse ' +
      'internships, see how well they match a role from their skills, and apply in a few clicks.',
  },
];

@Component({
  selector: 'app-how-it-started',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RevealDirective],
  template: `
    <section class="band origin" aria-labelledby="origin-heading">
      <div class="container">
        <header class="origin-intro" appReveal>
          <span class="eyebrow">How it started</span>
          <h2 id="origin-heading" class="origin-title">From an idea to a platform students built</h2>
          <p class="origin-lead">
            The short version of how LINKER went from an idea to a platform that students
            built together.
          </p>
        </header>

        <ol class="timeline">
          @for (m of milestones; track m.title; let i = $index) {
            <li class="milestone" [class.is-right]="i % 2 === 1">
              <span class="dot" aria-hidden="true"></span>
              <article class="m-card" appReveal [revealDelay]="i * 80">
                <span class="m-date">{{ m.date }}</span>
                <h3 class="m-title">{{ m.title }}</h3>
                <p class="m-body">{{ m.body }}</p>
              </article>
            </li>
          }
        </ol>

        <footer class="origin-cta" appReveal>
          <p class="origin-closing">
            That is how far it has come. If you are a student looking for a first real role,
            the next step is yours.
          </p>
          <a routerLink="/internships" class="btn btn-primary">Browse internships</a>
        </footer>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Soft botanical wash so white milestone cards read against the band. */
      .origin {
        background: var(--brand-wash);
      }

      /* ------------------------------ intro ------------------------------ */
      .origin-intro {
        max-width: 640px;
        margin: 0 auto var(--space-3xl);
        text-align: center;
      }

      /* h2 already inherits --font-display + --brand-deep from global styles. */
      .origin-title {
        font-size: clamp(1.75rem, 3.5vw, 2.25rem);
        margin: 0 0 var(--space-sm);
      }

      .origin-lead {
        margin: 0;
        color: var(--color-text-soft);
        font-size: 1.0625rem;
        line-height: 1.7;
      }

      /* ---------------------------- timeline ----------------------------- */
      .timeline {
        --dot-size: 16px;
        list-style: none;
        position: relative;
        max-width: 960px;
        margin: 0 auto;
        padding: 0;
      }

      /* The connecting spine down the centre. */
      .timeline::before {
        content: '';
        position: absolute;
        top: 6px;
        bottom: 6px;
        left: 50%;
        width: 2px;
        transform: translateX(-50%);
        background: var(--brand-border);
      }

      .milestone {
        position: relative;
        width: 50%;
        box-sizing: border-box;
        padding-bottom: var(--space-2xl);
      }
      .milestone:last-child {
        padding-bottom: 0;
      }

      /* Left column sits in the left half, card flush toward the centre line. */
      .milestone:not(.is-right) {
        left: 0;
        padding-right: var(--space-2xl);
      }
      /* Right column is pushed into the right half. */
      .milestone.is-right {
        left: 50%;
        padding-left: var(--space-2xl);
      }

      .dot {
        position: absolute;
        top: 8px;
        width: var(--dot-size);
        height: var(--dot-size);
        border-radius: 50%;
        background: var(--brand);
        /* The wash-coloured halo masks the spine passing behind the dot. */
        box-shadow: 0 0 0 4px var(--brand-wash);
        z-index: 1;
      }
      .milestone:not(.is-right) .dot {
        right: calc(var(--dot-size) / -2);
      }
      .milestone.is-right .dot {
        left: calc(var(--dot-size) / -2);
      }

      .m-card {
        background: var(--color-surface);
        border: 1px solid var(--brand-border);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        box-shadow: var(--shadow-sm);
        text-align: left;
      }

      .m-date {
        display: block;
        margin-bottom: var(--space-xs);
        color: var(--brand-sage);
        font-size: 0.8125rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .m-title {
        font-family: var(--font-display);
        color: var(--brand-deep);
        font-size: 1.25rem;
        margin: 0 0 var(--space-sm);
      }

      .m-body {
        margin: 0;
        color: var(--color-text-soft);
        font-size: 0.9375rem;
        line-height: 1.7;
      }

      /* ------------------------------ CTA -------------------------------- */
      .origin-cta {
        margin-top: var(--space-3xl);
        text-align: center;
      }

      .origin-closing {
        max-width: 560px;
        margin: 0 auto var(--space-lg);
        color: var(--color-text-soft);
        font-size: 1.0625rem;
        line-height: 1.7;
      }

      /* --------------------- stacked layout on mobile -------------------- */
      @media (max-width: 767px) {
        .timeline {
          max-width: 480px;
        }
        .timeline::before {
          left: 7px;
          transform: none;
        }
        .milestone,
        .milestone.is-right {
          width: 100%;
          left: 0;
          padding-left: calc(var(--space-xl) + 8px);
          padding-right: 0;
        }
        .milestone:not(.is-right) .dot,
        .milestone.is-right .dot {
          left: 0;
          right: auto;
        }
      }

      /* Reveal fade/slide is handled by [appReveal], which already no-ops
         under prefers-reduced-motion. This is a belt-and-braces fallback. */
      @media (prefers-reduced-motion: reduce) {
        .m-card {
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `,
  ],
})
export class HowItStartedComponent {
  protected readonly milestones = MILESTONES;
}
