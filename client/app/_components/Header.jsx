"use client";
import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButtons from "./AuthButtons";
import { useState, useEffect } from "react";

function Header() {
	const [user, setUser] = useState(null);

	useEffect(() => {
		async function getMe() {
			const res = await fetch("/api/v1/users/me", {
				// send the authentication token along with this request
				credentials: "include",
			});

			if (res.ok) {
				const data = await res.json();
				setUser(data.data.user);
			}
		}

		getMe();
	}, []);

	return (
		<header className="relative bg-slate-950 border-b border-slate-800/80 px-4 sm:px-8 py-4 backdrop-blur-md sticky top-0 z-50">
			<div className="flex items-center justify-between max-w-7xl mx-auto">
				<Logo />
				<Navigation />
				<div className="hidden sm:block">
					{user ? (
						<span className="text-white text-2xl">👤 {user.name}</span>
					) : (
						<AuthButtons />
					)}
				</div>
			</div>
		</header>
	);
}

export default Header;
