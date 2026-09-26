import { bootstrapApplication } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then((ref) => {
    // GitHub Pages deep links: 404.html redirects /app/<path> to /app/?r=<path>.
    const params = new URLSearchParams(location.search);
    const redirect = params.get('r');
    if (redirect && redirect.startsWith('/')) {
      history.replaceState(null, '', location.pathname);
      void ref.injector.get(Router).navigateByUrl(redirect);
    }
  })
  .catch((err) => console.error(err));
