import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CompanyLogoComponent } from './company-logo.component';
import { IconComponent } from './icon.component';

export interface CompanyOption {
  name: string;
  count: number;
}

/**
 * Logo-rich company picker. A native <select> can't render images, so this is a
 * custom popover: a trigger showing the current selection and a panel listing
 * every company with its logo and open-role count.
 */
@Component({
  selector: 'app-company-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CompanyLogoComponent, IconComponent],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="cf">
      <button
        type="button"
        class="cf-trigger"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
      >
        @if (selected()) {
          <app-company-logo [name]="selected()" [size]="22" />
          <span class="cf-label">{{ selected() }}</span>
        } @else {
          <app-icon name="building" [size]="16" />
          <span class="cf-label muted">All companies</span>
        }
        <app-icon name="chevron-down" [size]="16" />
      </button>

      @if (open()) {
        <div class="cf-panel" role="listbox">
          <button type="button" class="cf-option" [class.active]="!selected()" (click)="choose('')">
            <span class="cf-dot"><app-icon name="building" [size]="14" /></span>
            <span class="cf-name">All companies</span>
            <span class="cf-count">{{ total() }}</span>
          </button>
          @for (company of companies(); track company.name) {
            <button
              type="button"
              class="cf-option"
              [class.active]="selected() === company.name"
              (click)="choose(company.name)"
            >
              <app-company-logo [name]="company.name" [size]="24" />
              <span class="cf-name">{{ company.name }}</span>
              <span class="cf-count">{{ company.count }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .cf { position: relative; width: 100%; }

      .cf-trigger {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        width: 100%;
        background: transparent;
        border: none;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 0.95rem;
        color: var(--color-foreground);
        padding: 12px 0;
      }

      .cf-label { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cf-label.muted { color: var(--color-text-soft); }

      .cf-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        min-width: 260px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg, 0 12px 32px rgba(15, 23, 42, 0.16));
        padding: 6px;
        z-index: 40;
        max-height: 340px;
        overflow-y: auto;
      }

      .cf-option {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        width: 100%;
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        padding: 8px 10px;
        font-family: var(--font-sans);
        font-size: 0.9rem;
        color: var(--color-foreground);
        text-align: left;
        transition: background-color 140ms ease;
      }

      .cf-option:hover { background: var(--color-muted); }
      .cf-option.active { background: rgba(29, 77, 36, 0.08); color: var(--color-primary); font-weight: 600; }

      .cf-dot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 8px;
        background: var(--color-muted);
        color: var(--color-text-soft);
        flex-shrink: 0;
      }

      .cf-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .cf-count {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-text-soft);
        background: var(--color-muted);
        border-radius: 999px;
        padding: 1px 8px;
      }
    `,
  ],
})
export class CompanyFilterComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly companies = input.required<CompanyOption[]>();
  readonly selected = input('');
  readonly selectedChange = output<string>();

  protected readonly open = signal(false);
  protected readonly total = computed(() => this.companies().reduce((sum, c) => sum + c.count, 0));

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  protected choose(name: string): void {
    this.selectedChange.emit(name);
    this.open.set(false);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }
}
