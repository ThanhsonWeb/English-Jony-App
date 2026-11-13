"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";
import AuthButtons from "./AuthButtons";
import Logo from "./Logo";
import { useAuth } from "../_contexts/AuthContext";
import { useTranslations } from "next-intl";
import styles from "./Navigation.module.css";
import {
	BookOpen,
	Headphones,
	House,
	Languages,
	Menu,
	Trophy,
	X,
} from "lucide-react";

const desktopLinks = [
	{ key: "dialogue", href: "/dialogue", icon: Headphones },
	{ key: "wordlist", href: "/wordlist", icon: BookOpen },
	{ key: "rank", href: "/rank", icon: Trophy },
];

const mobileLinks = [
	{ key: "home", href: "/", icon: House },
	{ key: "dialogue", href: "/dialogue", icon: Headphones },
	{ key: "stories", href: "/dialogue?category=story", icon: BookOpen },
	{ key: "vocabulary", href: "/wordlist", icon: Languages },
	{ key: "rank", href: "/rank", icon: Trophy },
];

const navItemBase =
	"inline-flex items-center whitespace-nowrap border font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const navItemActive =
	"border-primary/25 bg-primary-soft text-brand-text shadow-sm shadow-primary/10 ring-1 ring-primary/10";
const navItemInactive =
	"border-transparent bg-transparent text-secondary hover:border-app hover:bg-hover hover:text-main";

function Navigation() {
	const t = useTranslations("Navigation");
	const pathname = usePathname();
	const activePathname = pathname.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef(null);
	const closeRef = useRef(null);
	const drawerRef = useRef(null);
	const { user } = useAuth();

	useEffect(() => {
		if (!isOpen) return undefined;

		const previousFocus = document.activeElement;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeRef.current?.focus();

		function handleKeyDown(event) {
			if (event.key === "Escape") {
				event.preventDefault();
				setIsOpen(false);
				return;
			}

			if (event.key !== "Tab") return;
			const focusable = drawerRef.current?.querySelectorAll(
				'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
			);
			if (!focusable?.length) {
				event.preventDefault();
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && (document.activeElement === first || !drawerRef.current?.contains(document.activeElement))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current?.contains(document.activeElement))) {
				event.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = previousOverflow;
			if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
		};
	}, [isOpen]);

	function closeDrawer() {
		setIsOpen(false);
	}

	return (
		<div className="relative">
			{/* Desktop navigation remains unchanged. */}
			<nav aria-label={t("desktopLabel")} className="hidden lg:block">
				<ul className="flex items-center gap-2">
					{desktopLinks.map(({ key, href, icon: Icon }) => {
						const isActive = activePathname === href || activePathname.startsWith(`${href}/`);
						return (
							<li key={key}>
								<Link
									href={href}
									aria-current={isActive ? "page" : undefined}
									className={`${navItemBase} gap-2 rounded-full px-3 py-2 text-base lg:px-3 xl:px-4 ${isActive ? navItemActive : navItemInactive}`}
								>
									<Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
									<span>{t(key)}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			<button
				ref={triggerRef}
				type="button"
				onClick={() => setIsOpen(true)}
				aria-label={t("openMenu")}
				aria-expanded={isOpen}
				aria-controls={isOpen ? "mobile-navigation-drawer" : undefined}
				aria-haspopup="dialog"
				className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-secondary transition hover:bg-hover hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
			>
				<Menu className="h-6 w-6" aria-hidden="true" />
			</button>

			{isOpen && createPortal(
				<div
					className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] lg:hidden"
					onClick={(event) => {
						if (event.target === event.currentTarget) closeDrawer();
					}}
				>
					<section
						ref={drawerRef}
						id="mobile-navigation-drawer"
						role="dialog"
						aria-modal="true"
						aria-labelledby="mobile-navigation-title"
						className={`${styles.drawerPanel} fixed inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] max-w-[85vw] flex-col border-r border-app bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-main shadow-2xl`}
					>
						<div className="mb-5 flex items-center justify-between border-b border-app pb-4">
							<h2 id="mobile-navigation-title" className="sr-only">
								{t("menuTitle")}
							</h2>
							<Logo mobileDrawer />
							<button
								ref={closeRef}
								type="button"
								onClick={closeDrawer}
								aria-label={t("closeMenu")}
								className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-secondary transition hover:bg-hover hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
							>
								<X className="h-5 w-5" aria-hidden="true" />
							</button>
						</div>

						<nav aria-label={t("mobileLabel")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
							{mobileLinks.map(({ key, href, icon: Icon }) => {
								const isActive = key === "home"
									? activePathname === "/"
									: key === "stories"
										? false
										: activePathname === href || activePathname.startsWith(`${href}/`);
								return (
									<Link
										key={key}
										href={href}
										onClick={closeDrawer}
										aria-current={isActive ? "page" : undefined}
										className={`flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive ? navItemActive : navItemInactive}`}
									>
										<Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
										<span>{t(key)}</span>
									</Link>
								);
							})}
						</nav>

						{!user && (
							<div className="mt-4 border-t border-app pt-4 sm:hidden">
								<AuthButtons onNavigate={closeDrawer} />
							</div>
						)}
					</section>
				</div>,
				document.body,
			)}
		</div>
	);
}

export default Navigation;
