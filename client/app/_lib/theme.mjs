export const THEME_STORAGE_KEY = "studyjony-theme";
export const THEME_VALUES = ["light", "cream", "dark", "black", "system"];

// Self-contained so the same function can run before React and during updates.
export function applyTheme(preference) {
	const resolved = preference === "system"
		? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
		: preference;
	const root = document.documentElement;
	root.dataset.theme = resolved;
	root.dataset.themePreference = preference;
	root.style.colorScheme = resolved === "dark" || resolved === "black" ? "dark" : "light";
}

export const themeScript = `(() => {
	let preference = "system";
	try {
		const saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
		if (${JSON.stringify(THEME_VALUES)}.includes(saved)) preference = saved;
	} catch {}
	(${applyTheme.toString()})(preference);
})();`;
