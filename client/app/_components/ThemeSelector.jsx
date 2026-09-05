"use client";

import { ChevronDown, MonitorCog, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/_contexts/ThemeContext";

const themeOptions = [
	{ value: "light", label: "Sáng" },
	{ value: "dark", label: "Tối" },
	{ value: "system", label: "Theo hệ thống" },
];

export default function ThemeSelector() {
	const { theme, setTheme } = useTheme();
	const ThemeIcon =
		theme === "light" ? Sun : theme === "dark" ? Moon : MonitorCog;
	const currentLabel =
		themeOptions.find((option) => option.value === theme)?.label ||
		"Theo hệ thống";

	return (
		<label className="relative block shrink-0" title={currentLabel}>
			<span className="sr-only">Chọn giao diện</span>
			<ThemeIcon
				aria-hidden="true"
				className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-secondary"
			/>
			<ChevronDown
				aria-hidden="true"
				className="pointer-events-none absolute right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-secondary sm:block"
			/>
			<select
				value={theme}
				onChange={(event) => setTheme(event.target.value)}
				aria-label="Chọn giao diện"
				className="h-10 w-10 cursor-pointer appearance-none rounded-xl border border-app bg-surface pl-9 pr-2 text-sm font-medium text-transparent outline-none transition hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-40 sm:pr-8 sm:text-main"
			>
				{themeOptions.map((option) => (
					<option className="bg-surface text-main" key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
