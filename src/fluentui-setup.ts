import {
	provideFluentDesignSystem,
	fluentButton,
	fluentCard,
	fluentAnchor,
	fluentTextField,
	fluentTextArea,
	fluentProgressRing,
} from "@fluentui/web-components";
import { webLightTheme } from "@fluentui/tokens";

const designSystem = provideFluentDesignSystem();

designSystem.register(
	fluentButton(),
	fluentCard(),
	fluentAnchor(),
	fluentTextField(),
	fluentTextArea(),
	fluentProgressRing(),
);

const microsoftThemeOverrides: Record<string, string> = {
	fontFamilyBase:
		"'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
	fontFamilyStrong:
		"'Segoe UI Variable Display', 'Segoe UI Semibold', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
	fontFamilyMonospace:
		"'Cascadia Mono', 'Segoe UI Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
	colorBrandBackground: "#0067B8",
	colorBrandBackground2: "#0D3A7A",
	colorBrandBackgroundStatic: "#0067B8",
	colorBrandForeground1: "#0067B8",
	colorBrandForeground2: "#005A9E",
	colorBrandForegroundLink: "#0067B8",
	colorBrandForegroundLinkHover: "#005A9E",
	colorBrandForegroundLinkPressed: "#004B87",
	colorBrandStroke1: "#80B4E1",
	colorBrandStroke2: "#004B87",
	colorNeutralForeground1: "#1F1F1F",
	colorNeutralForeground2: "#4D4D4D",
	colorNeutralForeground3: "#6B7280",
	colorNeutralForeground4: "#8A96A3",
	colorNeutralForegroundDisabled: "#A1A1AA",
	colorNeutralForegroundInverted: "#FFFFFF",
	colorNeutralForegroundInvertedLink: "#CFE4F9",
	colorNeutralBackground1: "#FFFFFF",
	colorNeutralBackground2: "#F5F6F8",
	colorNeutralBackground3: "#EEF1F6",
	colorNeutralBackground4: "#E4E8EF",
	colorNeutralBackground5: "#D7DDE6",
	colorNeutralBackground6: "#FFFFFF",
	colorNeutralCardBackground: "#FFFFFF",
	colorNeutralStroke1: "#D0D7E2",
	colorNeutralStroke2: "#B7C2D0",
	colorNeutralStrokeAccessible: "#7A8699",
	colorNeutralForegroundOnBrand: "#FFFFFF",
	colorPaletteBlueBackground1: "#F0F6FC",
	colorPaletteBlueBackground2: "#DCEBFA",
	colorPaletteBlueForeground1: "#0F5BB5",
	colorPaletteBlueForeground2: "#0B4A93",
	colorPaletteBlueBorderActive: "#0067B8",
	colorPaletteGreenForeground1: "#107C10",
	colorPaletteGreenBackground2: "#E6F4EA",
	colorPaletteRedForeground1: "#A4262C",
	colorPaletteRedBackground2: "#FDE7EA",
	colorPaletteYellowForeground1: "#986F0B",
	colorPaletteYellowBackground2: "#FFF4CE",
	shadow4: "0 6px 24px rgba(15, 34, 58, 0.08)",
	shadow8: "0 12px 32px rgba(12, 23, 38, 0.12)",
	shadow16: "0 16px 48px rgba(12, 23, 38, 0.16)",
	spacingHorizontalXS: "12px",
	spacingHorizontalS: "20px",
	spacingHorizontalM: "32px",
	spacingHorizontalL: "48px",
	spacingHorizontalXL: "64px",
	spacingHorizontalXXL: "88px",
	spacingHorizontalXXXL: "120px",
	spacingVerticalXS: "12px",
	spacingVerticalS: "20px",
	spacingVerticalM: "32px",
	spacingVerticalL: "48px",
	spacingVerticalXL: "72px",
	spacingVerticalXXL: "96px",
	spacingVerticalXXXL: "128px",
	cornerRadiusSmall: "4px",
	cornerRadiusMedium: "8px",
	cornerRadiusLarge: "12px",
	controlCornerRadius: "4px",
	surfaceCornerRadius: "8px",
	fontSizeBase200: "14px",
	fontSizeBase300: "16px",
	fontSizeBase400: "18px",
	fontSizeHero700: "56px",
	fontSizeHero600: "48px",
	fontSizeHero500: "40px",
	lineHeightBase200: "22px",
	lineHeightBase300: "24px",
	lineHeightBase400: "28px",
	lineHeightHero600: "56px",
	lineHeightHero500: "48px",
};

if (typeof document !== "undefined") {
	const root = document.documentElement;

	Object.entries({ ...webLightTheme, ...microsoftThemeOverrides }).forEach(
		([key, value]) => {
			if (typeof value === "string") {
				root.style.setProperty(`--${key}`, value);
			}
		},
	);
}
