import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { themeScript, THEME_VALUES } from "../app/_lib/theme.mjs";

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

function luminance(hex) {
	const rgb = hex.match(/[\da-f]{2}/gi).map(value => {
		const channel = parseInt(value, 16) / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test("body, muted and teal text meet 4.5:1 across palette surfaces", () => {
	const css = readFileSync(new URL("../app/_styles/globals.css", import.meta.url), "utf8");
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
