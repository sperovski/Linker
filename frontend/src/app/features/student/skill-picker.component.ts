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
import { SkillResponse } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

interface SkillGroup {
  category: string;
  skills: SkillResponse[];
}

/**
 * Searchable multi-select for the skill taxonomy (150+ options): a typeahead
 * filters the catalogue, results stay grouped by category, and selected skills
 * render as removable tags. A plain <select> stops being usable at this size.
 */
@Component({
  selector: 'app-skill-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="tags">
      @for (skill of selected(); track skill.id) {
        <span class="tag">
          {{ skill.name }}
          <button type="button" (click)="removed.emit(skill)" [attr.aria-label]="'Remove ' + skill.name">
            <app-icon name="x" [size]="13" />
          </button>
        </span>
      } @empty {
        <span class="soft">No skills added yet. Search below to add some.</span>
      }
    </div>

    <div class="picker" (focusout)="onFocusOut($event)">
      <div class="search-box" [class.open]="open()">
        <app-icon name="search" [size]="16" class="search-ic" />
        <input
          type="text"
          role="combobox"
          [attr.aria-expanded]="open()"
          aria-label="Search skills"
          placeholder="Search skills, e.g. Angular, Excel, German…"
          [value]="query()"
          (input)="onQuery($event)"
          (focus)="open.set(true)"
          (keydown.escape)="open.set(false)"
          (keydown.enter)="$event.preventDefault(); addFirstMatch()"
        />
        @if (query()) {
          <button type="button" class="clear" (click)="clear()" aria-label="Clear search">
            <app-icon name="x" [size]="14" />
          </button>
        }
      </div>

      @if (open()) {
        <div class="dropdown" role="listbox">
          @for (group of filteredGroups(); track group.category) {
            <div class="group">
              <div class="group-head">{{ group.category }}</div>
              @for (skill of group.skills; track skill.id) {
                <button
                  type="button"
                  class="option"
                  role="option"
                  [attr.aria-selected]="false"
                  (click)="pick(skill)"
                >
                  <span>{{ skill.name }}</span>
                  <app-icon name="plus" [size]="14" />
                </button>
              }
            </div>
          } @empty {
            <div class="no-match">
              @if (query()) {
                No skill matches “{{ query() }}”.
              } @else {
                All catalogue skills are already on your profile.
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .soft { color: var(--color-text-soft); font-size: 0.9rem; }

      .picker { position: relative; }

      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md, 8px);
        background: var(--color-surface);
        padding: 0 12px;
        transition: border-color 200ms ease, box-shadow 200ms ease;
      }

      .search-box:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(29, 77, 36, 0.13);
      }

      .search-ic { color: var(--color-text-soft); flex-shrink: 0; }

      .search-box input {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        background: transparent;
        padding: 11px 0;
        font-size: 0.95rem;
        color: var(--color-foreground);
        font-family: inherit;
      }

      .clear {
        display: inline-flex;
        border: none;
        background: transparent;
        color: var(--color-text-soft);
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: color 150ms ease;
      }

      .clear:hover { color: var(--color-foreground); }

      .dropdown {
        position: absolute;
        z-index: 30;
        inset-inline: 0;
        top: calc(100% + 6px);
        max-height: 320px;
        overflow-y: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-lg);
      }

      .group-head {
        position: sticky;
        top: 0;
        padding: 8px 14px 6px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-soft);
        background: var(--color-muted);
      }

      .option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 9px 14px;
        border: none;
        background: transparent;
        font-size: 0.92rem;
        font-family: inherit;
        color: var(--color-foreground);
        cursor: pointer;
        text-align: left;
        transition: background 150ms ease;
      }

      .option app-icon { color: var(--color-text-soft); opacity: 0; transition: opacity 150ms ease; }
      .option:hover, .option:focus-visible { background: var(--color-muted); }
      .option:hover app-icon, .option:focus-visible app-icon { opacity: 1; }

      .no-match { padding: var(--space-md); color: var(--color-text-soft); font-size: 0.9rem; }
    `,
  ],
})
export class SkillPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Full catalogue (all categories). */
  readonly allSkills = input.required<SkillResponse[]>();
  /** Skills already on the profile — excluded from the dropdown. */
  readonly selected = input.required<SkillResponse[]>();

  readonly added = output<SkillResponse>();
  readonly removed = output<SkillResponse>();

  protected readonly query = signal('');
  protected readonly open = signal(false);

  protected readonly filteredGroups = computed<SkillGroup[]>(() => {
    const owned = new Set(this.selected().map((s) => s.id));
    const term = this.query().trim().toLowerCase();

    const groups = new Map<string, SkillResponse[]>();
    for (const skill of this.allSkills()) {
      if (owned.has(skill.id)) continue;
      if (term && !skill.name.toLowerCase().includes(term)) continue;
      const list = groups.get(skill.category) ?? [];
      list.push(skill);
      groups.set(skill.category, list);
    }

    return [...groups.entries()].map(([category, skills]) => ({ category, skills }));
  });

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  protected pick(skill: SkillResponse): void {
    this.added.emit(skill);
    this.query.set('');
  }

  protected addFirstMatch(): void {
    const first = this.filteredGroups()[0]?.skills[0];
    if (first && this.query().trim()) {
      this.pick(first);
    }
  }

  protected clear(): void {
    this.query.set('');
  }

  /** Close only when focus leaves the whole picker (input and options). */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) {
      this.open.set(false);
    }
  }
}
