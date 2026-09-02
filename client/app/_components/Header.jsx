"use client";
import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButtons from "./AuthButtons";
import { useAuth } from "../_contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { User, Settings, LogOut } from "lucide-react";

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
		<header className="relative bg-slate-950/50 border-b border-slate-800/80 px-4 sm:px-8 py-4 backdrop-blur-md  top-0 z-50">
			<div className="flex items-center justify-between max-w-8xl mx-auto">
				<Logo />
				<div className="hidden md:block">
					<Navigation />
				</div>

				<div className="flex items-center gap-4">
					{loading ? (
						// Show a blur blank space
						<div className="w-24 h-6 bg-slate-800 rounded animate-pulse"></div>
					) : user ? (
						<div ref={dropdownRef} className="relative ">
							<button
								onClick={() => setIsDropdownOpen((open) => !open)}
								className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 hover:bg-slate-900 cursor-pointer"
							>
								<div className="text-right hidden sm:block">
									<p className="text-md font-semibold text-white leading-tight">
										{user.name}
									</p>
									<p className="text-sm font-semibold text-amber-200 leading-tight">
										🌟 Vip
									</p>
								</div>

								{user?.photo ? (
									<img
										src={user.photo}
										alt={user.name}
										className="md:h-12 md:w-12 h-10 w-10 rounded-full border border-slate-700 object-cover"
									/>
								) : (
									<div className="flex md:h-12 md:w-12 h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white ring-1 ring-slate-700 group-hover:ring-slate-500 transition">
										{user.name?.charAt(0).toUpperCase()}
									</div>
								)}
							</button>

							{/* DropdownList */}
							{isDropdownOpen && (
								<div className="absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl z-50">
									{/* User Info */}
									<div className="border-b border-slate-800 px-4 py-4">
										<p className="text-sm font-semibold text-white">
											{user.name}
										</p>

										<p className="mt-1 truncate text-xs text-slate-500">
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
											className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
										>
											<User size={18} />
											Hồ sơ
										</button>
									</div>
									{/* log out */}
									<div className="border-t border-slate-800 p-2">
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
