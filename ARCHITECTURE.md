# Architecture — Consultologist

## Current Stack

| Layer | Technology |
|---|---|
| Frontend | Astro (static site generation, TypeScript) |
| Styling | Hand-written CSS with Fluent-compatible design tokens (`src/styles/tokens.css`) |
| Hosting | Azure Static Web Apps |
| Backend | Azure Functions (.NET 9 isolated, integrated with SWA) — contact form email via Azure Communication Services |

---

## Azure Static Web Apps + Azure Functions vs Azure App Service

For a Blazor WASM + API backend, **SWA + Functions is the right fit**:
- The app runs entirely in the browser
- Functions handle API calls
- Generous free tier
- Built-in staging environments (preview URL per PR)
- Free managed TLS + custom domains
- Built-in auth (AAD, GitHub, Google, etc.)

### Where SWA + Functions falls short vs App Service

| Capability | App Service | SWA + Functions |
|---|---|---|
| Long-running processes | Yes | No — Functions have execution time limits |
| WebSockets | Yes | No |
| Background jobs / timers | Yes | Timer trigger only (limited) |
| Full ASP.NET Core middleware pipeline | Yes | No |
| VNet integration | Yes (Standard+) | Enterprise tier only |
| Persistent disk/file system | Yes | No |
| SignalR hosting | Yes | No |
| Custom Docker containers | Yes | No |

### When to migrate to App Service or Container Apps
- Server-side rendering is required
- Persistent connections (WebSockets, SignalR)
- Long-running background jobs
- Full ASP.NET Core middleware control
