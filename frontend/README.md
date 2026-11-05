# Utsab web application

The repository root contains only `frontend/` and `backend/` (plus Git's internal `.git/`). Each application has its own package manifest, lockfile, dependencies, environment file, and build.

## Local setup

First complete [the backend setup](../backend/README.md), then run these commands from `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The API proxy uses `API_URL`; realtime connections use `NEXT_PUBLIC_SOCKET_URL`. Both default to http://localhost:4000 locally.

The public landing page is `/`. Sign in at `/login`, create an account at `/signup`, and open the host workspace at `/dashboard`. The professional landing CTA opens vendor registration. Occasion links carry the selected type through sign-in and open the matching event creation form. Signed-in users can return home using the Utsab logo.

Wedding, birthday, anniversary, corporate, conference, engagement, Gaye Holud, reception, baby shower, graduation, reunion, community, and general events have editable budget/guest defaults. New workspaces can include an occasion-specific checklist, exact budget allocations, and an optional schedule in Asia/Dhaka time. Changing an existing event's occasion preserves its plans. See [event templates](../backend/docs/EVENT_TYPES.md).

Demo host: `host@utsab.local`, vendor: `vendor@utsab.local`, administrator: `admin@utsab.local`. All use `UtsabDemo2027!`. Demo data is only for local/disposable environments.

```powershell
npm run build
npm start
npx playwright install chromium
# With both servers and a seeded disposable database running:
npm run test:e2e
```

Browser output stays inside `frontend/artifacts/` and `frontend/test-results/`. Fonts remain at least 14px. Motion respects the operating system's reduced-motion setting.

Open **Planning studio** for host tools or **Business suite** for vendor CRM and operations. `Ctrl/⌘ K` opens the command menu. Event selection is preserved per account in the current browser tab. The advanced routes and supported workflows are described in [the feature matrix](../backend/docs/ADVANCED_SCOPE.md).

See [the API reference](../backend/docs/API.md), [operations](../backend/docs/OPERATIONS.md), and [the original specification](../backend/Project_spec.md). Live payment and messaging delivery credentials are environment-specific; sandbox payments do not move real money.
