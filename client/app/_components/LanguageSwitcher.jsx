"use client";

import { Check, ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

const languages = [
	{ locale: "vi", shortLabel: "VI", label: "Tiếng Việt", flag: "🇻🇳" },
	{ locale: "en", shortLabel: "EN", label: "English", flag: "🇺🇸" },
];

export default function LanguageSwitcher({ variant = "compact" }) {
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const containerRef = useRef(null);
	const [isOpen, setIsOpen] = useState(false);
	const currentLanguage =
		languages.find((language) => language.locale === locale) || languages[0];
	const isSettingsVariant = variant === "settings";

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

	function changeLanguage(nextLocale) {
		setIsOpen(false);
		if (nextLocale === locale) return;

		const query = searchParams.toString();
		const href = query ? `${pathname}?${query}` : pathname;
		router.replace(href, { locale: nextLocale });
	}

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-label={locale === "vi" ? "Chọn ngôn ngữ" : "Choose language"}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				className={`flex items-center font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 ${
					isSettingsVariant
						? "h-12 min-w-40 gap-2.5 rounded-2xl border border-primary bg-primary px-3.5 text-white shadow-lg shadow-primary/15 hover:brightness-95"
						: "h-10 gap-1.5 rounded-xl border border-app bg-surface px-2.5 text-sm text-main hover:border-primary/50 focus-visible:border-primary"
				}`}
			>
				<span
					aria-hidden="true"
					className={
						isSettingsVariant
							? "grid h-8 w-8 place-items-center rounded-full bg-white/15 text-lg"
							: ""
					}
				>
					{currentLanguage.flag}
				</span>
				<span className={isSettingsVariant ? "flex-1 text-left" : ""}>
					{isSettingsVariant
						? currentLanguage.label
						: currentLanguage.shortLabel}
				</span>
				<ChevronDown
					aria-hidden="true"
					className={`h-3.5 w-3.5 transition ${
						isSettingsVariant ? "text-white/80" : "text-secondary"
					} ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<div
					role="menu"
					className={`absolute right-0 top-full z-[60] mt-2 overflow-hidden border border-app bg-surface p-1.5 shadow-xl ${
						isSettingsVariant ? "w-56 rounded-2xl" : "w-44 rounded-xl"
					}`}
				>
					{languages.map((language) => {
						const isActive = language.locale === locale;

						return (
							<button
								type="button"
								role="menuitemradio"
								aria-checked={isActive}
								key={language.locale}
								onClick={() => changeLanguage(language.locale)}
								className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
									isActive
										? "bg-primary-soft font-semibold text-primary"
										: "text-secondary hover:bg-surface-muted hover:text-main"
								}`}
							>
								<span
									aria-hidden="true"
									className={
										isSettingsVariant
											? "grid h-8 w-8 place-items-center rounded-full bg-surface-muted text-lg"
											: ""
									}
								>
									{language.flag}
								</span>
								<span className="flex-1">{language.label}</span>
								{isActive && <Check aria-hidden="true" className="h-4 w-4" />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
