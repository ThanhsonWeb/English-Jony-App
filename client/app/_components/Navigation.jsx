"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
	// { name: "Luyện viết", href: "/writing", icon: PenLine },
	{ key: "dialogue", href: "/dialogue", icon: Headphones },
	// { key: "vocabulary", href: "/vocabulary", icon: Languages },
	{ key: "wordlist", href: "/wordlist", icon: BookOpen },
	{ key: "rank", href: "/rank", icon: Trophy },
];

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
			<ul className="hidden items-center gap-1 md:flex">
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
								className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-lg font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out ${
									isActive
										? "border-primary/25 bg-active text-brand-text shadow-[0_4px_14px_var(--sj-shadow-color)]"
										: "border-transparent text-secondary hover:border-app hover:bg-hover hover:text-main"
								}`}
							>
								<Icon className="w-5 h-5" />
								<span>{t(link.key)}</span>
							</Link>
						</li>
					);
				})}
			</ul>

			{/* Mobile Menu Button */}
			<button
				onClick={() => setOpenPathname(isOpen ? null : pathname)}
				className="p-2 text-secondary hover:text-main md:hidden"
				aria-label="Toggle menu"
			>
				{isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
			</button>

			{/* Mobile Dropdown Menu */}
			{isOpen && (
				<div className="fixed inset-x-0 top-[73px] z-50 flex flex-col gap-5 border-b border-app bg-surface p-6 shadow-2xl md:hidden">
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
								className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-lg font-medium transition-[color,background-color,border-color,box-shadow] duration-200 ease-out ${
									isActive
										? "border-primary/25 bg-active font-semibold text-brand-text shadow-[0_4px_14px_var(--sj-shadow-color)]"
										: "border-transparent text-secondary hover:border-app hover:bg-hover hover:text-main"
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
