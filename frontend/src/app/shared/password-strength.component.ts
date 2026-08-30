import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MIN_PASSWORD_LENGTH, countCharacterClasses, passwordStrength } from './password-policy';

/**
 * Meter plus a live checklist under a new-password field. It reads the same
 * rules the server enforces, so what turns green here is what will be accepted
 * — the point is to stop people discovering the policy through rejections.
 */
@Component({
  selector: 'app-password-strength',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (password()) {
      <div class="meter-wrap">
        <div class="meter" role="img" [attr.aria-label]="'Password strength: ' + strength()">
          @for (step of [1, 2, 3, 4]; track step) {
            <span class="seg" [class.on]="filled() >= step" [class]="'seg ' + (filled() >= step ? 'on ' + strength() : '')"></span>
          }
        </div>
        <span class="label" [class]="'label ' + strength()">{{ labelText() }}</span>
      </div>

      <ul class="rules">
        <li [class.met]="longEnough()">At least {{ minLength }} characters</li>
        <li [class.met]="enoughClasses()">Mixes 3 of: lowercase, uppercase, numbers, symbols</li>
        <li [class.met]="notPredictable()">Not a common or predictable password</li>
      </ul>
    }
  `,
  styles: [
    `
      :host { display: block; margin-top: 8px; }

      .meter-wrap {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .meter {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        flex: 1;
      }

      .seg {
        height: 4px;
        border-radius: 999px;
        background: var(--color-border);
        transition: background 160ms ease;
      }

      .seg.weak { background: #dc2626; }
      .seg.fair { background: #f59e0b; }
      .seg.good { background: #3b82f6; }
      .seg.strong { background: #16a34a; }

      .label {
        font-size: 0.75rem;
        font-weight: 700;
        min-width: 44px;
        text-align: right;
      }

      .label.weak { color: #dc2626; }
      .label.fair { color: #b45309; }
      .label.good { color: #2563eb; }
      .label.strong { color: #15803d; }

      .rules {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
        display: grid;
        gap: 3px;
      }

      .rules li {
        font-size: 0.75rem;
        color: var(--color-text-soft);
        padding-left: 18px;
        position: relative;
      }

      .rules li::before {
        content: '○';
        position: absolute;
        left: 0;
      }

      .rules li.met {
        color: #15803d;
      }

      .rules li.met::before {
        content: '✓';
        font-weight: 700;
      }
    `,
  ],
})
export class PasswordStrengthComponent {
  readonly password = input.required<string>();

  protected readonly minLength = MIN_PASSWORD_LENGTH;

  protected readonly strength = computed(() => passwordStrength(this.password()));

  protected readonly filled = computed(() => {
    switch (this.strength()) {
      case 'weak': return 1;
      case 'fair': return 2;
      case 'good': return 3;
      case 'strong': return 4;
      default: return 0;
    }
  });

  protected readonly labelText = computed(() => {
    const value = this.strength();
    return value === 'empty' ? '' : value.charAt(0).toUpperCase() + value.slice(1);
  });

  protected readonly longEnough = computed(() => this.password().length >= MIN_PASSWORD_LENGTH);
  protected readonly enoughClasses = computed(() => countCharacterClasses(this.password()) >= 3);

  /**
   * "Not predictable" is shown as met once the password clears every rule other
   * than the two listed above — otherwise the checklist would claim a common
   * password is fine merely because it is long and mixed.
   */
  protected readonly notPredictable = computed(
    () => this.strength() !== 'weak' && this.strength() !== 'empty',
  );
}
