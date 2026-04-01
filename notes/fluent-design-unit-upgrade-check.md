# Check `--design-unit` Default on FluentUI Upgrade

`wwwroot/css/app.css` declares:

```css
@property --design-unit {
    syntax: '<number>';
    inherits: false;
    initial-value: 4;
}

fluent-card {
    --design-unit: 8;
}
```

The `initial-value: 4` matches the FAST design token default in `Microsoft.FluentUI.AspNetCore.Components` v4.14.0, confirmed at:

```js
g("design-unit").withDefault(4)
```

in `Microsoft.FluentUI.AspNetCore.Components.lib.module.js`.

## Why this matters

`@property` with `inherits: false` stops `--design-unit` from cascading into child components inside `FluentCard`, so they keep reading `4` (from `initial-value`) while the card itself uses `8` for its own padding via the library's scoped rule `calc(var(--design-unit) * 5px)`.

If `initial-value` drifts from the library default, child components (`FluentTextField`, `FluentButton`, etc.) will compute incorrect sizes.

## After upgrading `Microsoft.FluentUI.AspNetCore.Components`

1. Find the new `lib.module.js` in the NuGet cache:
   ```
   ~/.nuget/packages/microsoft.fluentui.aspnetcore.components/<version>/staticwebassets/
   ```
2. Search for `"design-unit"` and confirm `.withDefault(4)` hasn't changed.
3. If the default has changed, update `initial-value` in `wwwroot/css/app.css` to match.
