import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { ToastContainerComponent } from './shared/toast-container.component';
import { routeFade } from './shared/animations';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, ToastContainerComponent],
  animations: [routeFade],
  template: `
    <app-header />
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
