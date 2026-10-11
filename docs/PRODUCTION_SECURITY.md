# Production security requirements

This is a static browser app. Build with Node 24 or later and the committed npm lockfile. Serve the production `dist` directory over HTTPS, with a restrictive Content Security Policy, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. Allow microphone access only from the application origin via Permissions-Policy and user consent. Do not run the Vite development server as a production public service.

Audio processing is local to the browser. Re-evaluate consent/data retention and the CSP before adding analytics, remote audio upload, third-party scripts or external backends.
