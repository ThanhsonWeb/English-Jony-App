"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import AuthButtons from "./AuthButtons";
import { useAuth } from "../_contexts/AuthContext";
import { useTranslations } from "next-intl";
import {
	Menu,
	X,
	Headphones,
	BookOpen,
	PenLine,
	Languages,
	Trophy,
} from "lucide-react";

const navLinks = [
	{ key: "dialogue", href: "/dialogue", icon: Headphones },
	// { key: "vocabulary", href: "/vocabulary", icon: Languages },
	{ key: "wordlist", href: "/wordlist", icon: BookOpen },
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
	const [openPathname, setOpenPathname] = useState(null);
	const isOpen = openPathname === pathname;
	const { user } = useAuth();
	return (
		<nav className="relative">
			{/* Desktop Navigation */}
			<ul className="hidden items-center gap-2 lg:flex">
				{navLinks.map((link) => {
					const Icon = link.icon;
					const isActive =
						activePathname === link.href ||
						activePathname.startsWith(`${link.href}/`);

					return (
						<li key={link.key}>
							<Link
								href={link.href}
								aria-current={isActive ? "page" : undefined}
								className={`${navItemBase} gap-2 rounded-full px-3 py-2 text-base lg:px-3 xl:px-4 ${
									isActive
										? navItemActive
										: navItemInactive
								}`}
							>
								<Icon className="h-[18px] w-[18px] shrink-0" />
								<span>{t(link.key)}</span>
							</Link>
						</li>
					);
				})}
			</ul>

			{/* Mobile Menu Button */}
			<button
				onClick={() => setOpenPathname(isOpen ? null : pathname)}
				className="p-2 text-secondary hover:text-main lg:hidden"
				aria-label="Toggle menu"
			>
				{isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
			</button>

			{/* Mobile Dropdown Menu */}
			{isOpen && (
				<div className="fixed inset-x-0 top-[73px] z-50 flex flex-col gap-5 border-b border-app bg-surface p-6 shadow-2xl lg:hidden">
					{navLinks.map((link) => {
						const Icon = link.icon;
						const isActive =
							activePathname === link.href ||
							activePathname.startsWith(`${link.href}/`);

						return (
							<Link
								key={link.key}
								href={link.href}
								onClick={() => setOpenPathname(null)}
								aria-current={isActive ? "page" : undefined}
								className={`${navItemBase} w-full gap-3 rounded-2xl px-4 py-3 text-lg ${
									isActive
										? `${navItemActive} font-semibold`
										: navItemInactive
								}`}
							>
								<Icon className="w-5 h-5" />
								<span>{t(link.key)}</span>
							</Link>
						);
					})}

					{/* Auth Buttons inside mobile dropdown 🔑 */}
					{!user && (
						<div className="flex flex-col gap-3 border-t border-app pt-4 sm:hidden">
							<AuthButtons />
						</div>
					)}
				</div>
			)}
		</nav>
	);
}

export default Navigation;
