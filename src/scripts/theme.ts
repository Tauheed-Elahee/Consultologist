type ThemeMode = "system" | "dark" | "light";

const STORAGE_KEY = "consultologist-theme";
const CYCLE: ThemeMode[] = ["system", "dark", "light"];

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const toggle = document.getElementById("theme-toggle");
const moonIcon = document.getElementById("theme-icon-moon");
const sunIcon = document.getElementById("theme-icon-sun");

function storedMode(): ThemeMode {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : "system";
}

function effectiveTheme(mode: ThemeMode): "dark" | "light" {
    if (mode === "system") {
        return prefersDark.matches ? "dark" : "light";
    }
    return mode;
}

function applyMode(mode: ThemeMode): void {
    if (mode === "system") {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem(STORAGE_KEY);
    } else {
        document.documentElement.dataset.theme = mode;
        localStorage.setItem(STORAGE_KEY, mode);
    }

    const dark = effectiveTheme(mode) === "dark";
    sunIcon?.toggleAttribute("hidden", !dark);
    moonIcon?.toggleAttribute("hidden", dark);
    toggle?.setAttribute(
        "title",
        `Theme: ${mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light"}`,
    );
}

toggle?.addEventListener("click", () => {
    const next = CYCLE[(CYCLE.indexOf(storedMode()) + 1) % CYCLE.length]!;
    applyMode(next);
});

prefersDark.addEventListener("change", () => applyMode(storedMode()));

applyMode(storedMode());

export {};
