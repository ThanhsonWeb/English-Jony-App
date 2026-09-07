"use client";

import { MonitorCog, Moon, Sun } from "lucide-react";
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
		<label
			className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-app bg-surface text-secondary transition hover:border-primary/50 hover:text-main focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
			title={currentLabel}
		>
			<span className="sr-only">Chọn giao diện</span>
			<ThemeIcon
				aria-hidden="true"
				className="pointer-events-none h-4.5 w-4.5"
			/>
			<select
				value={theme}
				onChange={(event) => setTheme(event.target.value)}
				aria-label="Chọn giao diện"
				className="absolute inset-0 cursor-pointer opacity-0"
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
