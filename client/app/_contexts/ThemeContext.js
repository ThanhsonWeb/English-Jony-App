"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from "react";

import { applyTheme, THEME_STORAGE_KEY, THEME_VALUES } from "@/app/_lib/theme.mjs";

let temporaryTheme = null;
const THEME_CHANGE_EVENT = "studyjony-theme-change";
const VALID_THEMES = new Set(THEME_VALUES);
const ThemeContext = createContext(null);

function getSavedTheme() {
	if (typeof window === "undefined") return "system";
	if (temporaryTheme) return temporaryTheme;

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

export function ThemeProvider({ children }) {
	const theme = useSyncExternalStore(
		subscribeToTheme,
		getSavedTheme,
		() => "system",
	);

	useEffect(() => {
		// Hydration starts with system; apply the actual saved preference.
		const preference = getSavedTheme();
		applyTheme(preference);

		if (preference !== "system") return undefined;

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
					temporaryTheme = null;
				} catch {
					temporaryTheme = nextTheme;
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
