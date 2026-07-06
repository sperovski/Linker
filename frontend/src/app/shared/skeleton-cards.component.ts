import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Pulsing card-shaped placeholders shown while list data is loading. */
@Component({
  selector: 'app-skeleton-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid-cards" role="status" aria-label="Loading">
      @for (i of items(); track i) {
        <div class="card">
          <div class="skeleton" style="height: 14px; width: 40%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 22px; width: 80%; margin-bottom: 16px;"></div>
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <div class="skeleton" style="height: 24px; width: 90px; border-radius: 999px;"></div>
            <div class="skeleton" style="height: 24px; width: 70px; border-radius: 999px;"></div>
          </div>
          <div class="skeleton" style="height: 12px; width: 100%; margin-bottom: 8px;"></div>
          <div class="skeleton" style="height: 12px; width: 60%;"></div>
        </div>
      }
    </div>
  `,
})
export class SkeletonCardsComponent {
  readonly count = input(6);
  readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
