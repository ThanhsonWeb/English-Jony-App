"use client";

import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

import { applyTheme, getThemePreference, THEME_STORAGE_KEY, THEME_VALUES } from "@/app/_lib/theme.mjs";
import { useAuth } from "@/app/_contexts/AuthContext";

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
	const { user, setUser, loading } = useAuth();
	const guestTheme = useSyncExternalStore(
		subscribeToTheme,
		getSavedTheme,
		() => "system",
	);
	const theme = getThemePreference(user, guestTheme);
	const userId = user?._id || user?.id || null;
	const activeAccount = useRef({ id: null, generation: 0 });
	const saveQueue = useRef(Promise.resolve());
	const latestSelection = useRef(0);
	const [saveError, setSaveError] = useState(null);

	useLayoutEffect(() => {
		if (activeAccount.current.id !== userId) {
			activeAccount.current = {
				id: userId,
				generation: activeAccount.current.generation + 1,
			};
		}
		if (!loading) applyTheme(theme);
	}, [loading, theme, userId]);

	useEffect(() => {
		if (loading || theme !== "system") return undefined;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleSystemThemeChange = () => applyTheme("system");
		mediaQuery.addEventListener("change", handleSystemThemeChange);

		return () => {
			mediaQuery.removeEventListener("change", handleSystemThemeChange);
		};
	}, [loading, theme]);

	const value = useMemo(
		() => ({
			theme,
			saveFailed: saveError?.id === userId,
			setTheme(nextTheme) {
				if (!VALID_THEMES.has(nextTheme)) return;
				setSaveError(null);
				applyTheme(nextTheme);

				if (userId) {
					const account = { ...activeAccount.current };
					const selection = ++latestSelection.current;
					setUser((currentUser) =>
						(currentUser?._id || currentUser?.id) === userId
							? { ...currentUser, theme: nextTheme }
							: currentUser,
					);
					saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
						if (activeAccount.current.generation !== account.generation) return;
						const response = await fetch("/api/v1/users/theme", {
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							credentials: "include",
							body: JSON.stringify({ theme: nextTheme, expectedUserId: userId }),
						});
						if (!response.ok) throw new Error("Could not save theme");
						if (activeAccount.current.generation === account.generation &&
							latestSelection.current === selection) setSaveError(null);
					}).catch(() => {
						if (activeAccount.current.generation === account.generation &&
							latestSelection.current === selection) {
							setSaveError(account);
						}
					});
					return;
				}

				try {
					window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
					temporaryTheme = null;
				} catch {
					temporaryTheme = nextTheme;
				}
				window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
			},
		}),
		[theme, saveError, setUser, userId],
	);

	return (
		<ThemeContext.Provider value={value}>
			<div className={loading ? "contents invisible" : "contents"}>{children}</div>
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error("useTheme must be used inside ThemeProvider");
	}

	return context;
}
