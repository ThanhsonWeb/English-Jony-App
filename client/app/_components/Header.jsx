"use client";
import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButtons from "./AuthButtons";
import { useAuth } from "../_contexts/AuthContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import { User, LogOut, MessageSquareText, ChevronDown } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "next-intl";
import { resolveAvatarUrl } from "../_lib/resolveAvatarUrl";
import { useLeaderboardResource } from "../_lib/useStudyResources";

function UserAvatar({ user, avatarAlt }) {
	const [failedPhotoUrls, setFailedPhotoUrls] = useState([]);
	const photoUrl = resolveAvatarUrl(user, failedPhotoUrls);
	const initial = user?.name?.trim().charAt(0).toUpperCase() || "U";

	if (photoUrl) {
		return (
			<img
				src={photoUrl}
				alt={user.name || avatarAlt}
				referrerPolicy="no-referrer"
				onError={() => setFailedPhotoUrls((urls) => [...urls, photoUrl])}
				className="h-10 w-10 shrink-0 rounded-full border border-app object-cover md:h-12 md:w-12"
			/>
		);
	}

	return (
		<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white ring-1 ring-app transition group-hover:ring-primary/40 md:h-12 md:w-12">
			{initial}
		</div>
	);
}

function Header() {
	const t = useTranslations("Header");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef(null);
	const router = useRouter();
	const pathname = usePathname();
	const isWordlist = pathname.replace(/^\/(en|vi)(?=\/|$)/, "") === "/wordlist";

	const { user, logout, loading } = useAuth();
	const { data: leaderboard } = useLeaderboardResource(user?._id || user?.id, "all", "current", isDropdownOpen && !loading && Boolean(user), 1);
	const progress = leaderboard?.currentUser;
	// handleClickOutside
	useEffect(() => {
		function handleClickOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsDropdownOpen(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	async function handleLogout() {
		if (await logout()) router.push("/");
	}

	return (
		<header
			className={`sticky top-0 z-50 w-full border-b border-app bg-surface/95 px-4 py-1 backdrop-blur-xl sm:px-6 lg:px-4 xl:px-8${isWordlist ? " max-md:min-h-[60px] max-md:px-3" : ""}`}
		>
			<div className="mx-auto grid max-w-8xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
				{/* Mobile menu */}
				<div className="flex items-center gap-3">
					<div className="lg:hidden">
						<Navigation key={`mobile-${pathname}`} />
					</div>
					<Logo wordlistMobile={isWordlist} />
				</div>
				<div className="hidden justify-center lg:flex">
					<Navigation key={`desktop-${pathname}`} />
				</div>

				<div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 sm:gap-2 xl:gap-3 lg:col-start-3">
					<LanguageSwitcher />
					<ThemeSelector borderless />
					{loading ? (
						// Show a blur blank space
						<div className="h-6 w-24 animate-pulse rounded bg-surface-muted"></div>
					) : user ? (
						<div ref={dropdownRef} className="relative flex items-center gap-1">
							<button
								type="button"
								onClick={() => setIsDropdownOpen((open) => !open)}
								aria-label={t("accountMenu", { name: user.name })}
								aria-expanded={isDropdownOpen}
								aria-controls={isDropdownOpen ? "header-account-menu" : undefined}
								className="group flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 transition-colors duration-200 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 xl:gap-3"
							>
								<UserAvatar user={user} avatarAlt={t("avatar")} />
								<div className="hidden min-w-0 sm:block">
									<p className="max-w-20 truncate whitespace-nowrap text-md font-semibold leading-tight text-main sm:max-w-24 xl:max-w-none">
										{user.name}
									</p>
									<p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-500"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />{t("online")}</p>
								</div>
								<ChevronDown size={14} aria-hidden="true" className={`hidden text-slate-400 transition-transform duration-200 motion-reduce:transition-none sm:block ${isDropdownOpen ? "rotate-180" : ""}`} />
							</button>

							{/* DropdownList */}
							{isDropdownOpen && (
								<div id="header-account-menu" className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-app bg-surface shadow-2xl">
									{/* User Info */}
									<div className="border-b border-app px-4 py-4">
										<p className="text-sm font-semibold text-main">
											{user.name}
										</p>

										<p className="mt-1 truncate text-xs text-secondary">
											{user.email}
										</p>
											{(Number.isFinite(progress?.level) || Number.isFinite(progress?.streakDays)) && <div className="mt-2 flex items-center gap-2">{Number.isFinite(progress?.level) && <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-500">Lv. {progress.level}</span>}{Number.isFinite(progress?.streakDays) && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">🔥 {t("streakDays", { count: progress.streakDays })}</span>}</div>}
									</div>
									{/* Profile & Settings */}
									<div className="p-2">
										<button
											onClick={() => {
												setIsDropdownOpen(false);
												router.push("/profile");
											}}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-surface-muted hover:text-main"
										>
											<User size={18} />
											{t("profile")}
										</button>
										{user.role === "admin" && (
											<button
												onClick={() => {
													setIsDropdownOpen(false);
													router.push("/admin/feedback");
												}}
													className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-surface-muted hover:text-main"
											>
												<MessageSquareText size={18} aria-hidden="true" />
												{t("adminFeedback")}
											</button>
										)}
									</div>
									{/* log out */}
									<div className="border-t border-app p-2">
										<button
											onClick={handleLogout}
											className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-rose-500/10 hover:text-rose-400"
										>
											<LogOut size={18} />
											{t("logout")}
										</button>
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="hidden sm:block">
							<AuthButtons />
						</div>
					)}
				</div>
			</div>
		</header>
	);
}

export default Header;
