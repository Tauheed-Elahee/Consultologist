# Site Improvements — Make Consultologist Look Like fluentui-blazor.net

## Visual Comparison

| | Framework site (fluentui-blazor.net) | Your site (Consultologist) |
|---|---|---|
| Header | White, Microsoft logo, search bar, GitHub icon, theme toggle | Solid blue bar, plain text |
| Nav | Collapsible `FluentNavGroup` sections with icons | Flat `FluentNavLink` list |
| Theming | `FluentDesignTheme` with light/dark mode | No theme component |
| CSS baseline | `reboot.css` loads correctly | `reboot.css` returns 404 (broken) |

---

## Issues & Fixes (in order)

### 1. `reboot.css` 404 on Azure Static Web Apps (BLOCKING)
**Problem:** `_content/Microsoft.FluentUI.AspNetCore.Components/css/reboot.css` fails to load.
Azure SWA's fallback routing intercepts `_content/...` paths and tries to serve `index.html`
instead of the actual static file.

**Fix:** Add a `staticwebapp.config.json` to `wwwroot/` with a route rule that excludes
`_content/`, `_framework/`, and `_blazor/` from the SPA fallback.

---

### 2. Add `FluentDesignTheme` component
**Problem:** Without `<FluentDesignTheme>`, Fluent UI components use raw default styles
with no design token wiring — no light/dark mode, no proper colour palette.

**Fix:** Add `<FluentDesignTheme>` to `App.razor` or `MainLayout.razor`:
```razor
<FluentDesignTheme Mode="DesignThemeModes.System" StorageName="theme" />
```

---

### 3. Rebuild the header
**Problem:** `<FluentHeader>` currently holds only plain text.

**Fix:** Add a logo/app name on the left, a `<FluentSpacer>`, and a theme-toggle button
on the right using `<FluentButton IconStart="..." />`.

---

### 4. Upgrade the nav sidebar
**Problem:** All nav links are flat with no grouping.

**Fix:** Wrap related links in `<FluentNavGroup>` with a `Title` and `Icon` to get
collapsible sections matching the framework site's sidebar style.
