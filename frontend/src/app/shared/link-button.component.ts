import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

export type LinkButtonVariant = 'primary' | 'secondary' | 'standard' | 'standard-secondary';
export type LinkButtonSize = 'sm' | 'md' | 'lg';

/**
 * Single, app-wide button. A pressable 3D "press" effect (adapted from a
 * Uiverse.io design by Madflows, recoloured to Linker's forest green) sits on
 * a `::before` that fakes the extruded side of the key.
 *
 * Renders a real <button> normally, or an <a> when [routerLink] is supplied, so
 * navigation CTAs keep proper link semantics. Label comes from projected
 * content, so icons + text just work: `<app-link-button>…</app-link-button>`.
 */
@Component({
  selector: 'app-link-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet],
  host: {
    '[class.lb-block]': 'block()',
  },
  template: `
    <!-- Single projection slot, shared by both branches so the label never
         gets lost (two separate <ng-content> would only fill one). -->
    <ng-template #label><span class="lm-content"><ng-content></ng-content></span></ng-template>

    @if (routerLink() != null) {
      <a
        class="learn-more"
        [class]="classes()"
        [routerLink]="routerLink()"
        [queryParams]="queryParams()"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.tabindex]="disabled() ? -1 : null"
      >
        <ng-container [ngTemplateOutlet]="label" />
      </a>
    } @else {
      <button
        class="learn-more"
        [class]="classes()"
        [type]="type()"
        [disabled]="disabled()"
        (click)="pressed.emit($event)"
      >
        <ng-container [ngTemplateOutlet]="label" />
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        vertical-align: middle;
      }

      :host(.lb-block) {
        display: flex;
        width: 100%;
      }

      .learn-more {
        /* Per-variant palette, referenced by the shared rules below.
           Values derive from the forest-green MASTER.md palette. */
        --lm-face: var(--color-foreground);
        --lm-face-hover: #123018;
        --lm-side: var(--color-secondary);
        --lm-border: var(--color-primary);
        --lm-edge: #123018;
        --lm-text: #F4FAF5;

        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
        font-weight: 600;
        font-size: 1rem;
        letter-spacing: 0.03em;
        line-height: 1.1;
        text-transform: uppercase;
        text-decoration: none;
        color: var(--lm-text);
        padding: 1.15em 2em;
        cursor: pointer;
        background: var(--lm-face);
        border: 2px solid var(--lm-border);
        border-radius: 0.75em;
        outline-offset: 4px;
        transform-style: preserve-3d;
        transition: transform 150ms cubic-bezier(0, 0, 0.58, 1),
          background 150ms cubic-bezier(0, 0, 0.58, 1);
      }

      .learn-more::before {
        position: absolute;
        content: '';
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--lm-side);
        border-radius: inherit;
        box-shadow: 0 0 0 2px var(--lm-border), 0 0.625em 0 0 var(--lm-edge);
        transform: translate3d(0, 0.75em, -1em);
        transition: transform 150ms cubic-bezier(0, 0, 0.58, 1),
          box-shadow 150ms cubic-bezier(0, 0, 0.58, 1);
      }

      /* Projected label rides on the front face, above the extruded side. */
      .lm-content {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 0.55em;
      }

      .learn-more:hover {
        background: var(--lm-face-hover);
        transform: translate(0, 0.25em);
      }

      .learn-more:hover::before {
        box-shadow: 0 0 0 2px var(--lm-border), 0 0.5em 0 0 var(--lm-edge);
        transform: translate3d(0, 0.5em, -1em);
      }

      .learn-more:active {
        background: var(--lm-face-hover);
        transform: translate(0, 0.75em);
      }

      .learn-more:active::before {
        box-shadow: 0 0 0 2px var(--lm-border), 0 0 var(--lm-edge);
        transform: translate3d(0, 0, -1em);
      }

      /* ---- Secondary: light / outline using design tokens ---- */
      .learn-more.secondary {
        --lm-face: var(--color-muted);
        --lm-face-hover: #EAF6EC;
        --lm-side: var(--color-border);
        --lm-border: var(--color-border);
        --lm-edge: #B7DCC0;
        --lm-text: var(--color-foreground);
      }

      /* ---- Sizes (em padding scales the whole 3D key with font-size) ---- */
      .learn-more.sm {
        font-size: 0.78rem;
        padding: 1em 1.5em;
        border-radius: 0.6em;
      }

      .learn-more.lg {
        font-size: 1.1rem;
        padding: 1.2em 2.4em;
      }

      .learn-more.block {
        display: flex;
        width: 100%;
      }

      /* =====================================================================
         STANDARD variant — flat, border-bottom "press" in Linker's palette.
         A lighter treatment than the deep 3D CTAs; used everywhere except the
         four landing hero/closing CTAs. No extruded ::before side.
      ===================================================================== */
      .learn-more.standard {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border: none;
        border-bottom: 4px solid var(--brand-deep);
        border-radius: 0.5rem;
        padding: 0.55rem 1.5rem;
        font-size: 0.95rem;
        letter-spacing: normal;
        text-transform: none;
        transform: none;
        transform-style: flat;
        box-shadow: none;
        transition: filter 150ms ease, transform 150ms ease,
          border-bottom-width 150ms ease, background-color 150ms ease;
      }

      .learn-more.standard::before {
        content: none;
        display: none;
      }

      .learn-more.standard:hover {
        background: var(--color-primary);
        filter: brightness(1.1);
        transform: translateY(-1px);
        border-bottom-width: 6px;
      }

      .learn-more.standard:active {
        filter: brightness(0.9);
        transform: translateY(2px);
        border-bottom-width: 2px;
      }

      .learn-more.standard.sm {
        font-size: 0.82rem;
        padding: 0.4rem 1rem;
        border-radius: 0.45rem;
      }

      .learn-more.standard.lg {
        font-size: 1.05rem;
        padding: 0.7rem 1.9rem;
      }

      .learn-more.standard:disabled,
      .learn-more.standard.is-disabled {
        filter: none;
        transform: none;
        border-bottom-width: 4px;
      }

      /* =====================================================================
         STANDARD-SECONDARY — same flat border-bottom press mechanics as
         standard, but a lighter treatment (muted bg, foreground text/border)
         so it reads as clearly secondary next to a standard primary without
         looking disabled. Colours from design-system/linker/MASTER.md.
      ===================================================================== */
      .learn-more.standard-secondary {
        background: var(--color-muted);
        color: var(--color-foreground);
        border: 2px solid var(--color-foreground);
        border-bottom-width: 4px;
        border-radius: 0.5rem;
        padding: 0.55rem 1.5rem;
        font-size: 0.95rem;
        letter-spacing: normal;
        text-transform: none;
        transform: none;
        transform-style: flat;
        box-shadow: none;
        transition: filter 150ms ease, transform 150ms ease,
          border-bottom-width 150ms ease, background-color 150ms ease;
      }

      .learn-more.standard-secondary::before {
        content: none;
        display: none;
      }

      .learn-more.standard-secondary:hover {
        background: #EAF6EC;
        filter: brightness(1.02);
        transform: translateY(-1px);
        border-bottom-width: 6px;
      }

      .learn-more.standard-secondary:active {
        filter: brightness(0.96);
        transform: translateY(2px);
        border-bottom-width: 2px;
      }

      .learn-more.standard-secondary.sm {
        font-size: 0.82rem;
        padding: 0.4rem 1rem;
        border-radius: 0.45rem;
      }

      .learn-more.standard-secondary.lg {
        font-size: 1.05rem;
        padding: 0.7rem 1.9rem;
      }

      .learn-more.standard-secondary:disabled,
      .learn-more.standard-secondary.is-disabled {
        filter: none;
        transform: none;
        border-bottom-width: 4px;
      }

      /* ---- Disabled ---- */
      .learn-more:disabled,
      .learn-more.is-disabled {
        cursor: not-allowed;
        opacity: 0.5;
        pointer-events: none;
        transform: none;
      }

      .learn-more:disabled::before,
      .learn-more.is-disabled::before {
        transform: translate3d(0, 0.75em, -1em);
        box-shadow: 0 0 0 2px var(--lm-border), 0 0.625em 0 0 var(--lm-edge);
      }

      /* ---- Reduced motion: drop the 3D depth motion, keep colour only ---- */
      @media (prefers-reduced-motion: reduce) {
        .learn-more,
        .learn-more::before {
          transition: background-color 150ms ease;
        }

        .learn-more:hover,
        .learn-more:active {
          transform: none;
        }

        .learn-more:hover::before,
        .learn-more:active::before {
          transform: translate3d(0, 0.75em, -1em);
          box-shadow: 0 0 0 2px var(--lm-border), 0 0.625em 0 0 var(--lm-edge);
        }

        /* Flat variants: keep colour feedback, drop the lift/border motion. */
        .learn-more.standard:hover,
        .learn-more.standard:active,
        .learn-more.standard-secondary:hover,
        .learn-more.standard-secondary:active {
          transform: none;
          border-bottom-width: 4px;
        }
      }
    `,
  ],
})
export class LinkButtonComponent {
  // Flat "standard" is the app-wide default; the deep 3D primary/secondary are
  // reserved for the four landing hero/closing CTAs.
  readonly variant = input<LinkButtonVariant>('standard');
  readonly size = input<LinkButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly block = input(false, { transform: booleanAttribute });
  readonly routerLink = input<string | unknown[] | null>(null);
  readonly queryParams = input<Record<string, unknown> | null>(null);

  /** Emitted on click for <button> mode; router <a> navigates on its own. */
  readonly pressed = output<MouseEvent>();

  protected readonly classes = computed(() => {
    const parts: string[] = [this.variant(), this.size()];
    if (this.block()) parts.push('block');
    if (this.disabled() && this.routerLink() != null) parts.push('is-disabled');
    return parts.join(' ');
  });
}
