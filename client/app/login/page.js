"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../_contexts/AuthContext";

function LoginPage() {
	const googleButtonRef = useRef(null);
	const { getMe } = useAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const router = useRouter();
	// load Google Sign-In system
	useEffect(() => {
		if (window.google) {
			window.google.accounts.id.initialize({
				client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
				callback: handleGoogleLogin,
			});

			window.google.accounts.id.renderButton(googleButtonRef.current, {
				theme: "outline",
				size: "large",
				width: 400,
			});

			return;
		}

		const script = document.createElement("script");
		script.src = "https://accounts.google.com/gsi/client";
		script.async = true;
		script.defer = true;

		script.onload = () => {
			window.google.accounts.id.initialize({
				client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
				callback: handleGoogleLogin,
			});

			window.google.accounts.id.renderButton(googleButtonRef.current, {
				theme: "outline",
				size: "large",
				width: 400,
			});
		};

		document.body.appendChild(script);
	}, []);

	async function handleSubmit(e) {
		e.preventDefault();
		try {
			setIsLoading(true);
			const res = await fetch("/api/v1/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				// 🍪 "Send my authentication cookie along with this request."
				credentials: "include",
				body: JSON.stringify({ email, password }),
			});

			const data = await res.json();
			// prod mode
			if (data.status === "fail") {
				setError(data.message);
				return;
			}

			if (data.status === "success") {
				await getMe();
				// Wait a tiny bit to ensure the bro
				setTimeout(() => {
					router.push("/wordlist");
				}, 100);

				return;
			}
			// console.log(data);
		} catch (error) {
			console.log(error);
		} finally {
			setIsLoading(false);
		}
	}
	// handle user after they click/sign in
	async function handleGoogleLogin(response) {
		console.log("Google response:", response);

		const res = await fetch("/api/v1/auth/google", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify({
				credential: response.credential,
			}),
		});

		const data = await res.json();

		console.log("Backend response:", data);

		if (!res.ok) {
			setError(data.message);
			return;
		}

		await getMe();
		router.push("/wordlist");
	}

	return (
		<div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
			<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
				<form
					onSubmit={handleSubmit}
					className="relative z-10 flex flex-col bg-slate-900/60 backdrop-blur-md text-slate-100 w-full max-w-md p-8 rounded-2xl border border-slate-800/80 shadow-2xl gap-4"
				>
					<div ref={googleButtonRef}></div>

					{/* Close Button */}
					<Link
						href="/"
						className="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl"
					>
						&times;
					</Link>

					<div className="flex items-center gap-4 mx-auto mb-3">
						<Image
							src="/lugo.png"
							height={48}
							width={48}
							quality={75}
							priority
							alt="English-Jony logo"
							className="rounded-xl border border-slate-800 w-12 h-12 "
						/>
					</div>

					{/* email */}
					<div className="flex flex-col gap-1">
						<label className="text-sm font-medium text-slate-300">Email</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="name@example.com"
							className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
							required
						/>
					</div>

					{error && (
						<div className=" text-sm text-red-400 rounded-xl">*{error}</div>
					)}

					{/* password */}
					<div className="flex flex-col gap-1">
						<label className="text-sm font-medium text-slate-300">
							Mật khẩu
						</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
							required
						/>
					</div>

					{/* submit button */}
					<button
						type="submit"
						className="mt-2 p-3.5 text-base font-semibold bg-blue-600 hover:bg-blue-500 rounded-xl text-white transition-all duration-200 shadow-lg shadow-blue-600/30 active:scale-[0.98]"
					>
						Đăng nhập
					</button>

					<p className="text-sm text-center text-slate-400 mt-2">
						Chưa có tài khoản?{" "}
						<Link
							href="/signup"
							className="text-blue-400 hover:underline font-semibold"
						>
							Đăng ký
						</Link>
					</p>
				</form>
			</div>
		</div>
	);
}

export default LoginPage;
