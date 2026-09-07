"use client";

import { Check, MonitorCog, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/_contexts/ThemeContext";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const themeOptions = [
	{ value: "light", labelKey: "light", Icon: Sun },
	{ value: "dark", labelKey: "dark", Icon: Moon },
	{ value: "system", labelKey: "system", Icon: MonitorCog },
];

export default function ThemeSelector() {
	const { theme, setTheme } = useTheme();
	const t = useTranslations("Theme");
	const containerRef = useRef(null);
	const [isOpen, setIsOpen] = useState(false);
	const ThemeIcon =
		theme === "light" ? Sun : theme === "dark" ? Moon : MonitorCog;
	const currentOption =
		themeOptions.find((option) => option.value === theme) || themeOptions[2];
	const currentLabel = t(currentOption.labelKey);

	useEffect(() => {
		if (!isOpen) return undefined;

		function handlePointerDown(event) {
			if (!containerRef.current?.contains(event.target)) setIsOpen(false);
		}

		function handleKeyDown(event) {
			if (event.key === "Escape") setIsOpen(false);
		}

		document.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-label={t("choose")}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				title={currentLabel}
				className="flex h-10 w-10 items-center justify-center rounded-xl border border-app bg-surface text-secondary outline-none transition hover:border-primary/50 hover:text-main focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
			>
				<ThemeIcon aria-hidden="true" className="h-[18px] w-[18px]" />
			</button>

			{isOpen && (
				<div
					role="menu"
					aria-label={t("choose")}
					className="absolute right-0 top-full z-[60] mt-2 w-48 overflow-hidden rounded-xl border border-app bg-surface p-1.5 shadow-xl"
				>
					{themeOptions.map((option) => {
						const OptionIcon = option.Icon;
						const isActive = theme === option.value;

						return (
							<button
								type="button"
								role="menuitemradio"
								aria-checked={isActive}
								key={option.value}
								onClick={() => {
									setTheme(option.value);
									setIsOpen(false);
								}}
								className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
									isActive
										? "bg-primary-soft font-semibold text-primary"
										: "text-secondary hover:bg-surface-muted hover:text-main"
								}`}
							>
								<OptionIcon aria-hidden="true" className="h-[18px] w-[18px]" />
								<span className="flex-1">{t(option.labelKey)}</span>
								{isActive && <Check aria-hidden="true" className="h-4 w-4" />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
