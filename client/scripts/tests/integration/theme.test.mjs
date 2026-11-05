import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { getThemePreference, themeScript, THEME_VALUES } from "../../../app/_lib/theme.mjs";

function bootstrap(saved, prefersDark, blocked = false) {
	const root = { dataset: {}, style: {} };
	vm.runInNewContext(themeScript, {
		document: { documentElement: root },
		window: { matchMedia: () => ({ matches: prefersDark }) },
		localStorage: { getItem() {
			if (blocked) throw new Error("Storage unavailable");
			return saved;
		} },
	});
	return root;
}

test("all saved preferences survive bootstrap under either OS setting", () => {
	for (const preference of THEME_VALUES) {
		for (const prefersDark of [false, true]) {
			const root = bootstrap(preference, prefersDark);
			const resolved = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
			assert.equal(root.dataset.theme, resolved);
			assert.equal(root.dataset.themePreference, preference);
			assert.equal(root.style.colorScheme, ["dark", "black"].includes(resolved) ? "dark" : "light");
		}
	}
});

test("missing, invalid and inaccessible storage still resolve the OS before paint", () => {
	for (const saved of [null, "invalid"]) {
		for (const dark of [false, true]) {
			for (const blocked of [false, true]) {
				const root = bootstrap(saved, dark, blocked);
				assert.equal(root.dataset.theme, dark ? "dark" : "light");
				assert.equal(root.dataset.themePreference, "system");
			}
		}
	}
});

test("account theme follows the signed-in user and guests keep their local preference", () => {
	const guestTheme = "cream";
	const userA = { _id: "a", theme: "dark" };
	const userB = { _id: "b", theme: "light" };

	assert.equal(getThemePreference(userA, guestTheme), "dark");
	assert.equal(getThemePreference(null, guestTheme), "cream");
	assert.equal(getThemePreference(userB, guestTheme), "light");
	assert.equal(getThemePreference(userA, guestTheme), "dark");
	assert.equal(getThemePreference({ _id: "legacy" }, guestTheme), "system");
});

function luminance(hex) {
	const rgb = hex.match(/[\da-f]{2}/gi).map(value => {
		const channel = parseInt(value, 16) / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrastRatio(first, second) {
	const lighter = Math.max(luminance(first), luminance(second));
	const darker = Math.min(luminance(first), luminance(second));
	return (lighter + 0.05) / (darker + 0.05);
}

test("body, muted and teal text meet 4.5:1 across palette surfaces", () => {
	const css = readFileSync(new URL("../../../app/_styles/globals.css", import.meta.url), "utf8");
	const blocks = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
	for (const theme of THEME_VALUES.filter(value => value !== "system")) {
		const tokens = {};
		for (const [, selector, body] of blocks) {
			if (selector.includes(":root,") || (selector.trim().startsWith("html[data-theme=") && selector.includes(`[data-theme="${theme}"]`))) {
				for (const [, key, value] of body.matchAll(/--sj-([\w-]+):\s*(#[\da-f]{6});/g)) tokens[key] = value;
			}
		}
		for (const foreground of ["text", "text-secondary", "text-muted", "brand-text"]) {
			for (const background of ["page", "surface", "surface-muted", "elevated", "input"]) {
				const a = luminance(tokens[foreground]);
				const b = luminance(tokens[background]);
				const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				assert.ok(contrast >= 4.5, `${theme}: ${foreground} on ${background}: ${contrast.toFixed(2)}`);
			}
		}
	}
});

test("dark solid action fills and hover fills keep white text AA without changing light fills", () => {
	const css = readFileSync(new URL("../../../app/_styles/globals.css", import.meta.url), "utf8");
	const darkPalette = css.match(/:root,\s*html\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
	const lightPalette = css.match(/html\[data-theme="light"\],\s*html\[data-theme="cream"\]\s*\{([^}]+)\}/)?.[1];
	assert.ok(darkPalette, "dark palette tokens are defined");
	assert.ok(lightPalette, "light palette tokens are defined");
	const token = (palette, name) => palette.match(new RegExp(`--sj-${name}:\\s*(#[\\da-f]{6})`))?.[1];
	const darkPrimary = token(darkPalette, "primary");
	const darkHover = token(darkPalette, "primary-hover");
	assert.ok(contrastRatio("#ffffff", darkPrimary) >= 4.5, "dark primary action text contrast");
	assert.ok(contrastRatio("#ffffff", darkHover) >= 4.5, "dark action hover text contrast");
	assert.equal(token(lightPalette, "primary"), "#08756b");
	assert.equal(token(lightPalette, "primary-hover"), "#06665d");

	const darkCompatibility = css.slice(
		css.indexOf("/* Legacy brand-color utilities use the single teal primary in dark mode. */"),
		css.indexOf("@keyframes mini-dictionary-enter"),
	);
	assert.match(darkCompatibility, /background-color: var\(--sj-primary\) !important;/);
	assert.match(darkCompatibility, /\[class~="hover:bg-blue-800"\]:hover/);
	assert.match(darkCompatibility, /background-color: var\(--sj-primary-hover\) !important;/);
	assert.match(darkCompatibility, /--tw-gradient-from: var\(--sj-primary\) !important;/);
	assert.match(darkCompatibility, /--tw-gradient-to: var\(--sj-primary-hover\) !important;/);
});
