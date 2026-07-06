import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { companyGradient, companyLogo, companyLogoCover } from './company-logo';

/**
 * Company avatar: shows the real logo on a clean white tile when one is bundled,
 * otherwise a deterministically-coloured initial. Drop-in replacement for the
 * old `.avatar` letter circles.
 */
@Component({
  selector: 'app-company-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (logoSrc() && !failed()) {
      <span
        class="tile"
        [class.cover]="cover()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.borderRadius.px]="radius()"
      >
        <img [src]="logoSrc()" [alt]="name()" loading="lazy" (error)="failed.set(true)" />
      </span>
    } @else {
      <span
        class="fallback"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.borderRadius.px]="radius()"
        [style.fontSize.px]="size() * 0.4"
        [style.background]="gradient()"
        aria-hidden="true"
      >
        {{ initial() }}
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-shrink: 0; line-height: 0; }

      .tile {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        border: 1px solid var(--color-border);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
        overflow: hidden;
      }

      .tile img {
        width: 78%;
        height: 78%;
        object-fit: contain;
      }

      /* Full-bleed square marks fill the tile with no padding. */
      .tile.cover { border: none; padding: 0; }
      .tile.cover img { width: 100%; height: 100%; object-fit: cover; }

      .fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 700;
      }
    `,
  ],
})
export class CompanyLogoComponent {
  readonly name = input.required<string>();
  readonly size = input(40);

  protected readonly failed = signal(false);
  protected readonly logoSrc = computed(() => companyLogo(this.name()));
  protected readonly cover = computed(() => companyLogoCover(this.name()));
  protected readonly gradient = computed(() => companyGradient(this.name()));
  protected readonly radius = computed(() => (this.size() >= 52 ? 16 : this.size() <= 30 ? 9 : 12));
  protected readonly initial = computed(() => (this.name()?.charAt(0) ?? '?').toUpperCase());
}
