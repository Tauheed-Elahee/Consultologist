# Architecture — Consultologist

## Current Stack

| Layer | Technology |
|---|---|
| Frontend | Blazor WebAssembly (.NET 10) |
| UI Components | Microsoft Fluent UI Blazor (`Microsoft.FluentUI.AspNetCore.Components` v4.14) |
| Hosting | Azure Static Web Apps |
| Backend (planned) | Azure Functions (integrated with SWA) |

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
