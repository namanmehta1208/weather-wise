import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

const config = {
  ...appConfig,
  providers: [...(appConfig.providers || []), provideHttpClient()],
};

bootstrapApplication(AppComponent, config).catch((err) => console.error(err));
