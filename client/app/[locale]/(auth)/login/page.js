"use client";

import { useAuth } from "@/app/_contexts/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import GoogleSignInButton from "@/app/_components/GoogleSignInButton";

function LoginPage() {
	const { getMe } = useAuth();
	const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
	const locale = useLocale();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const router = useRouter();

	// load Google Sign-In system
	useEffect(() => {
		if (!googleClientId) {
			return;
		}

		if (window.google) return;

		const script = document.createElement("script");
		script.src = "https://accounts.google.com/gsi/client";
		script.async = true;
		script.defer = true;

		script.onerror = () => {
			setError("Unable to load Google Sign-In. Please try again later.");
		};

		document.body.appendChild(script);
	}, [googleClientId]);

	async function openGoogleSignIn() {
		if (!window.google) {
			setError("Google Sign-In is still loading. Please try again.");
			return;
		}

		setError("");
		try {
			const response = await fetch(
				`/api/v1/auth/google/state?locale=${encodeURIComponent(locale)}`,
				{ credentials: "include" },
			);
			const data = await response.json();

			if (!response.ok) {
				setError(data.message || "Unable to start Google Sign-In.");
				return;
			}

			const codeClient = window.google.accounts.oauth2.initCodeClient({
				client_id: googleClientId,
				scope: "openid email profile",
				ux_mode: "redirect",
				redirect_uri: data.data.redirectUri,
				state: data.data.state,
			});
			codeClient.requestCode();
		} catch (error) {
			setError("Unable to start Google Sign-In. Please try again.");
		}
	}

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
	return (
		<div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
			<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
				<form
					onSubmit={handleSubmit}
					className="relative z-10 flex w-full max-w-md flex-col rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 text-slate-100 shadow-2xl backdrop-blur-xl sm:p-8"
				>
					{/* Close Button */}
					<Link
						href="/"
						className="absolute right-4 top-4 text-2xl text-slate-500 transition hover:text-white"
					>
						&times;
					</Link>

					{/* Logo + Title */}
					<div className="mb-6 flex flex-col items-center">
						<Image
							src="/lugo.png"
							height={56}
							width={56}
							quality={75}
							priority
							alt="English-Jony logo"
							className="h-14 w-14 rounded-2xl border border-slate-800"
						/>

						<h1 className="mt-4 text-2xl font-bold text-white">Đăng nhập</h1>

						<p className="mt-1 text-sm text-slate-400">
							Tiếp tục hành trình học tập của bạn 🚀
						</p>
					</div>

					{/* Google */}
					<GoogleSignInButton
						onClick={openGoogleSignIn}
						disabled={!googleClientId}
						text="Đăng nhập với Google"
					/>

					{/* Divider */}
					<div className="my-6 flex items-center gap-4">
						<div className="h-px flex-1 bg-slate-800" />
						<span className="text-xs font-medium text-slate-500">HOẶC</span>
						<div className="h-px flex-1 bg-slate-800" />
					</div>

					{/* Error */}
					{(error || !googleClientId) && (
						<div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
							{error ||
								"Google Sign-In is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID and redeploy the app."}
						</div>
					)}

					{/* Email */}
					<div className="mb-4 flex flex-col gap-1.5">
						<label className="text-sm font-medium text-slate-300">Email</label>

						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="name@example.com"
							className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
							required
						/>
					</div>

					{/* Password */}
					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium text-slate-300">
							Mật khẩu
						</label>

						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
							required
						/>
					</div>

					{/* Submit */}
					<button
						type="submit"
						disabled={loading}
						className="mt-6 rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? "Đang đăng nhập..." : "Đăng nhập"}
					</button>

					{/* Signup */}
					<p className="mt-5 text-center text-sm text-slate-400">
						Chưa có tài khoản?{" "}
						<Link
							href="/signup"
							className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
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
