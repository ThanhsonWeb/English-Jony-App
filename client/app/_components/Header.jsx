"use client";
import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButtons from "./AuthButtons";
import { useAuth } from "../_contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { User, LogOut } from "lucide-react";
import ThemeSelector from "./ThemeSelector";

function UserAvatar({ user }) {
	const [failedPhotoUrl, setFailedPhotoUrl] = useState(null);
	const photoUrl = typeof user?.photo === "string" ? user.photo.trim() : "";
	const showPhoto = photoUrl && failedPhotoUrl !== photoUrl;
	const initial = user?.name?.trim().charAt(0).toUpperCase() || "U";

	if (showPhoto) {
		return (
			<img
				src={photoUrl}
				alt={user.name || "Ảnh đại diện"}
				referrerPolicy="no-referrer"
				onError={() => setFailedPhotoUrl(photoUrl)}
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
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef(null);
	const router = useRouter();

	const { user, setUser, loading } = useAuth();
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
		const res = await fetch("/api/v1/auth/logout", {
			method: "POST",
			credentials: "include",
		});
		if (!res.ok) return;
		setUser(null);
		router.push("/");
	}

	return (
		<header className="relative top-0 z-50 border-b border-app bg-surface/90 px-4 py-4 backdrop-blur-md sm:px-8">
			<div className="flex items-center justify-between max-w-8xl mx-auto">
				<Logo />
				<div className="hidden md:block">
					<Navigation />
				</div>

				<div className="flex items-center gap-1 sm:gap-4">
					<ThemeSelector />
					{loading ? (
						// Show a blur blank space
						<div className="h-6 w-24 animate-pulse rounded bg-surface-muted"></div>
					) : user ? (
						<div ref={dropdownRef} className="relative ">
							<button
								onClick={() => setIsDropdownOpen((open) => !open)}
								className="group flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2 transition-all duration-200 hover:bg-surface-muted sm:px-3"
							>
								<div className="text-right hidden sm:block">
									<p className="text-md font-semibold leading-tight text-main">
										{user.name}
									</p>
									<p className="text-sm font-semibold text-amber-200 leading-tight">
										🌟 Vip
									</p>
								</div>

								<UserAvatar user={user} />
							</button>

							{/* DropdownList */}
							{isDropdownOpen && (
								<div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-app bg-surface shadow-2xl">
									{/* User Info */}
									<div className="border-b border-app px-4 py-4">
										<p className="text-sm font-semibold text-main">
											{user.name}
										</p>

										<p className="mt-1 truncate text-xs text-secondary">
											{user.email}
										</p>
									</div>
									{/* Profile & Settings */}
									<div className="p-2">
										<button
											onClick={() => {
												setIsDropdownOpen(false);
												router.push("/profile");
											}}
											className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-secondary hover:bg-surface-muted hover:text-main"
										>
											<User size={18} />
											Hồ sơ
										</button>
									</div>
									{/* log out */}
									<div className="border-t border-app p-2">
										<button
											onClick={handleLogout}
											className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
										>
											<LogOut size={18} />
											Đăng xuất
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
					{/* Mobile menu */}
					<div className="md:hidden">
						<Navigation />
					</div>
				</div>
			</div>
		</header>
	);
}

export default Header;
