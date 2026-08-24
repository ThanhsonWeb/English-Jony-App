"use client";

import { useAuth } from "@/app/_contexts/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import GoogleSignInButton from "@/app/_components/GoogleSignInButton";

function SignUpForm() {
	const { setUser } = useAuth();
	const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
	const locale = useLocale();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [error, setError] = useState("");
	const router = useRouter();

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const res = await fetch("/api/v1/auth/signup", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				// 🍪 "Send my authentication cookie along with this request."
				credentials: "include",
				body: JSON.stringify({ name, email, password, passwordConfirm }),
			});
			const data = await res.json();

			if (data.status === "fail") {
				setError(data.message);
				return;
			}
			if (!res.ok) {
				setError(data.message);
				return;
			}

			console.log(data);
			setUser(data.data.user);
			router.push("/wordlist");
		} catch (error) {
			console.log(error);
		}
	};

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
				client_id: data.data.clientId,
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

	return (
		<div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
			<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
				<div className="relative z-10 flex flex-col bg-slate-900/60 backdrop-blur-md text-slate-100 w-full max-w-md p-8 rounded-2xl border border-slate-800/80 shadow-2xl">
					{/* Close Button */}
					<Link
						href="/"
						className="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl"
					>
						&times;
					</Link>

					<div className="flex flex-col items-center gap-2 mb-6">
						<Image
							src="/lugo.png"
							height={48}
							width={48}
							quality={75}
							alt="Logo"
							className="rounded-xl border border-slate-800 w-12 h-12 mb-2"
						/>
						<h1 className="text-3xl font-bold">Đăng ký</h1>
						<p className="text-slate-400 text-sm">
							Đã có tài khoản?
							<Link
								href="/login"
								className="text-blue-400 hover:underline font-semibold"
							>
								Đăng nhập
							</Link>
						</p>
					</div>

					<GoogleSignInButton
						onClick={openGoogleSignIn}
						disabled={!googleClientId}
						text="Đăng ký với Google"
					/>

					{/* Divider (Optional) */}
					<div className="flex items-center gap-4 my-6 text-slate-500 text-xs">
						<div className="flex-1 h-px bg-slate-800"></div>
						HOẶC
						<div className="flex-1 h-px bg-slate-800"></div>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						{(error || !googleClientId) && (
							<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
								{error ||
									"Google Sign-In is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID and redeploy the app."}
							</div>
						)}

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-medium text-slate-300">
								Tên người dùng
							</label>

							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="nhập tên của bạn ..."
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-medium text-slate-300">
								Email
							</label>

							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="name@example.com"
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
						</div>

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

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-medium text-slate-300">
								Xác nhận mật khẩu
							</label>

							<input
								type="password"
								value={passwordConfirm}
								onChange={(e) => setPasswordConfirm(e.target.value)}
								placeholder="••••••••"
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
						</div>

						<button
							type="submit"
							className="mt-2 rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.98] cursor-pointer"
						>
							Đăng ký
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

export default SignUpForm;
