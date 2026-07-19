import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { ToastContainerComponent } from './shared/toast-container.component';
import { VerifyBannerComponent } from './shared/verify-banner.component';
import { routeFade } from './shared/animations';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, ToastContainerComponent, VerifyBannerComponent],
  animations: [routeFade],
  // The header is a fixed floating island (out of flow), so the shell reserves
  // matching space at the top instead of a spacer element.
  styles: [
    `
      :host {
        display: block;
        padding-top: var(--nav-clearance);
      }
    `,
  ],
  template: `
    <app-header />
    <app-verify-banner />
    <main [@routeFade]="routeKey(outlet)">
      <router-outlet #outlet="outlet" />
    </main>
    <app-toast-container />
  `,
})
export class App {
  protected routeKey(outlet: RouterOutlet): string {
    return outlet.isActivated ? (outlet.activatedRoute.snapshot.routeConfig?.path ?? '') : '';
  }
}
