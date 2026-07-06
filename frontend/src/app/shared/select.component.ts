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
import { IconComponent, IconName } from './icon.component';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Accessible custom dropdown — a styled replacement for a native <select> with a
 * consistent look, an animated panel, keyboard support and click-outside close.
 */
@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <div class="sel">
      <button
        type="button"
        class="sel-trigger"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel()"
        aria-haspopup="listbox"
      >
        @if (icon(); as ic) {
          <app-icon [name]="ic" [size]="16" />
        }
        <span class="sel-value">{{ selectedLabel() }}</span>
        <app-icon name="chevron-down" [size]="16" class="sel-chevron" [class.flip]="open()" />
      </button>

      @if (open()) {
        <div class="sel-panel" role="listbox">
          @for (opt of options(); track opt.value; let i = $index) {
            <button
              type="button"
              class="sel-option"
              role="option"
              [class.active]="opt.value === value()"
              [class.focused]="i === activeIndex()"
              [attr.aria-selected]="opt.value === value()"
              (click)="choose(opt.value)"
              (mouseenter)="activeIndex.set(i)"
            >
              <span>{{ opt.label }}</span>
              @if (opt.value === value()) {
                <app-icon name="check" [size]="15" />
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .sel { position: relative; width: 100%; }

      .sel-trigger {
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

      .sel-value { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sel-chevron { color: var(--color-text-soft); transition: transform 200ms ease; }
      .sel-chevron.flip { transform: rotate(180deg); }

      .sel-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        min-width: 180px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
        padding: 6px;
        z-index: 40;
        transform-origin: top;
        animation: sel-pop 140ms ease;
      }

      @keyframes sel-pop {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }

      .sel-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        width: 100%;
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        padding: 9px 12px;
        font-family: var(--font-sans);
        font-size: 0.9rem;
        color: var(--color-foreground);
        text-align: left;
      }

      .sel-option.focused { background: var(--color-muted); }
      .sel-option.active { color: var(--color-primary); font-weight: 600; }

      @media (prefers-reduced-motion: reduce) {
        .sel-panel { animation: none; }
        .sel-chevron { transition: none; }
      }
    `,
  ],
})
export class SelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<SelectOption[]>();
  readonly value = input('');
  readonly ariaLabel = input('');
  readonly icon = input<IconName | null>(null);
  readonly placeholder = input('Select…');
  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);

  protected readonly selectedLabel = computed(() => {
    const match = this.options().find((o) => o.value === this.value());
    return match ? match.label : this.placeholder();
  });

  protected toggle(event: Event): void {
    event.stopPropagation();
    const next = !this.open();
    this.open.set(next);
    if (next) {
      const idx = this.options().findIndex((o) => o.value === this.value());
      this.activeIndex.set(idx >= 0 ? idx : 0);
    }
  }

  protected choose(value: string): void {
    this.valueChange.emit(value);
    this.open.set(false);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      if ((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') && this.hasFocusWithin()) {
        event.preventDefault();
        this.open.set(true);
      }
      return;
    }

    const opts = this.options();
    switch (event.key) {
      case 'Escape':
        this.open.set(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((i) => Math.min(i + 1, opts.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.choose(opts[this.activeIndex()].value);
        break;
    }
  }

  private hasFocusWithin(): boolean {
    return this.host.nativeElement.contains(document.activeElement);
  }
}
