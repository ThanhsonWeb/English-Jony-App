"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButtons from "./AuthButtons";
import { useAuth } from "../_contexts/AuthContext";
import {
	Menu,
	X,
	Headphones,
	BookOpen,
	PenLine,
	Languages,
} from "lucide-react";

const navLinks = [
	// { name: "Luyện viết", href: "/writing", icon: PenLine },
	{ name: "Hội thoại", href: "/dialogue", icon: Headphones },
	{ name: "Từ vựng", href: "/vocabulary", icon: Languages },
	{ name: "Sổ tay", href: "/wordlist", icon: BookOpen },
];

function Navigation() {
	const pathname = usePathname();
	const activePathname = pathname.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
	const [isOpen, setIsOpen] = useState(false);
	const { user } = useAuth();
	useEffect(() => {
		setIsOpen(false);
	}, [pathname]);
	return (
		<nav className="relative">
			{/* Desktop Navigation */}
			<ul className="hidden items-center gap-3 md:flex">
				{navLinks.map((link) => {
					const Icon = link.icon;
					const isActive =
						activePathname === link.href ||
						activePathname.startsWith(`${link.href}/`);

					return (
						<li key={link.name}>
							<Link
								href={link.href}
								className={`relative inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-lg font-medium transition-all duration-200 ${
									isActive
										? "border-slate-700/70 bg-slate-900/85 text-white shadow-[0_8px_24px_-14px_rgba(59,130,246,0.8)]"
										: "border-transparent text-slate-300 hover:bg-slate-900/50 hover:text-white"
								} after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:origin-left after:rounded-full after:bg-blue-400 after:shadow-[0_0_10px_rgba(96,165,250,0.9)] after:transition-transform after:duration-300 after:ease-out ${
									isActive ? "after:scale-x-100" : "after:scale-x-0"
								}`}
							>
								<Icon className="w-5 h-5" />
								<span>{link.name}</span>
							</Link>
						</li>
					);
				})}
			</ul>

			{/* Mobile Menu Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="md:hidden text-slate-300 hover:text-white p-2"
				aria-label="Toggle menu"
			>
				{isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
			</button>

			{/* Mobile Dropdown Menu */}
			{isOpen && (
				<div className="fixed inset-x-0 top-[73px] bg-slate-950 border-b border-slate-800 p-6 flex flex-col gap-5 md:hidden z-50 shadow-2xl">
					{navLinks.map((link) => {
						const Icon = link.icon;
						const isActive =
							activePathname === link.href ||
							activePathname.startsWith(`${link.href}/`);

						return (
							<Link
								key={link.name}
								href={link.href}
								onClick={() => setIsOpen(false)}
								className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-lg font-medium transition-all ${
									isActive
										? "border-blue-500/20 bg-blue-500/10 font-semibold text-blue-300"
										: "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
								}`}
							>
								<Icon className="w-5 h-5" />
								<span>{link.name}</span>
							</Link>
						);
					})}

					{/* Auth Buttons inside mobile dropdown 🔑 */}
					{!user && (
						<div className="pt-4 border-t border-slate-800 flex flex-col gap-3 sm:hidden">
							<AuthButtons />
						</div>
					)}
				</div>
			)}
		</nav>
	);
}

export default Navigation;
