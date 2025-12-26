# Email Render Function (Node/TypeScript)

Standalone HTTP function (Firebase Functions v2, Node 20, TypeScript) that renders the TheCannon alert email HTML. Intended to replace the Next.js API route so the Python backend can call this service directly.

## Local development (functions-framework not needed now; use Firebase emulator)

```bash
cd email-render-function
yarn install
yarn build
# then run via Firebase emulator from repo root:
# firebase emulators:start --only functions,emailRenderer
# POST to http://localhost:5001/<project-id>/us-central1/renderEmail
```

## Deploy with Firebase (multi-codebase)

```bash
# from repo root
firebase deploy --only functions:renderEmail
```

After deploy, set `EMAIL_RENDER_URLS` in the Python environment to the deployed HTTPS endpoint (comma-separated if multiple).

