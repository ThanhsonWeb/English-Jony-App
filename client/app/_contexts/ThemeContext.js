"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from "react";

const THEME_STORAGE_KEY = "studyjony-theme";
const THEME_CHANGE_EVENT = "studyjony-theme-change";
const VALID_THEMES = new Set(["light", "dark", "system"]);
const ThemeContext = createContext(null);

function getSavedTheme() {
	if (typeof window === "undefined") return "system";

	try {
		const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
		return VALID_THEMES.has(savedTheme) ? savedTheme : "system";
	} catch {
		return "system";
	}
}

function subscribeToTheme(callback) {
	window.addEventListener("storage", callback);
	window.addEventListener(THEME_CHANGE_EVENT, callback);

	return () => {
		window.removeEventListener("storage", callback);
		window.removeEventListener(THEME_CHANGE_EVENT, callback);
	};
}

function applyTheme(preference) {
	const resolvedTheme =
		preference === "system"
			? window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
			: preference;
	const root = document.documentElement;

	root.dataset.theme = resolvedTheme;
	root.dataset.themePreference = preference;
	root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }) {
	const theme = useSyncExternalStore(
		subscribeToTheme,
		getSavedTheme,
		() => "system",
	);

	useEffect(() => {
		applyTheme(theme);

		if (theme !== "system") return undefined;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleSystemThemeChange = () => applyTheme("system");
		mediaQuery.addEventListener("change", handleSystemThemeChange);

		return () => {
			mediaQuery.removeEventListener("change", handleSystemThemeChange);
		};
	}, [theme]);

	const value = useMemo(
		() => ({
			theme,
			setTheme(nextTheme) {
				if (!VALID_THEMES.has(nextTheme)) return;

				try {
					window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
				} catch {
					// The selected theme still applies for this page if storage is blocked.
				}
				applyTheme(nextTheme);
				window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
			},
		}),
		[theme],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error("useTheme must be used inside ThemeProvider");
	}

	return context;
}
