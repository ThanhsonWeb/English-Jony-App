"use client";

import { useAuth } from "@/app/_contexts/AuthContext";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getAuthErrorMessage } from "@/app/_lib/authErrorMessage";
import GoogleSignInButton from "@/app/_components/GoogleSignInButton";
import AuthOverlay from "@/app/_components/AuthOverlay";

function SignUpForm() {
	const t = useTranslations("Auth");
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
				setError(getAuthErrorMessage(data, t, "signupFailed"));
				return;
			}
			if (!res.ok) {
				setError(getAuthErrorMessage(data, t, "signupFailed"));
				return;
			}

			console.log(data);
			setUser(data.data.user);
			router.push("/wordlist");
		} catch (error) {
			setError(t("signupFailed"));
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
			setError(t("googleLoadFailed"));
		};

		document.body.appendChild(script);
	}, [googleClientId, t]);

	async function openGoogleSignIn() {
		if (!window.google) {
			setError(t("googleLoading"));
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
				setError(t("googleStartFailed"));
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
			setError(t("googleStartFailed"));
		}
	}

	return (
		<div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
			<AuthOverlay>
				<div className="relative z-10 flex flex-col bg-slate-900/60 backdrop-blur-md text-slate-100 w-full max-w-md p-8 rounded-2xl border border-slate-800/80 shadow-2xl">
					{/* Close Button */}
					<Link
						href="/"
						aria-label={t("close")}
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
							alt={t("logoAlt")}
							className="rounded-xl border border-slate-800 w-12 h-12 mb-2"
						/>
						<h1 className="text-3xl font-bold">{t("signup")}</h1>
						<p className="text-slate-400 text-sm">
							{t("hasAccount")}{" "}
							<Link
								href="/login"
								className="text-blue-400 hover:underline font-semibold"
							>
								{t("login")}
							</Link>
						</p>
					</div>

					<GoogleSignInButton
						onClick={openGoogleSignIn}
						disabled={!googleClientId}
						text={t("googleSignup")}
					/>

					{/* Divider (Optional) */}
					<div className="flex items-center gap-4 my-6 text-slate-500 text-xs">
						<div className="flex-1 h-px bg-slate-800"></div>
						{t("or")}
						<div className="flex-1 h-px bg-slate-800"></div>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						{(error || !googleClientId) && (
							<div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
								{error ||
									t("googleUnavailable")}
							</div>
						)}

						<div className="flex flex-col gap-1.5">
							<label htmlFor="signup-name" className="text-sm font-medium text-slate-300">
								{t("name")}
							</label>

							<input
								id="signup-name"
								name="name"
								autoComplete="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={t("namePlaceholder")}
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="signup-email" className="text-sm font-medium text-slate-300">
								{t("email")}
							</label>

							<input
								id="signup-email"
								name="email"
								autoComplete="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder={t("emailPlaceholder")}
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="signup-password" className="text-sm font-medium text-slate-300">
								{t("password")}
							</label>

							<input
								id="signup-password"
								name="password"
								autoComplete="new-password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="signup-password-confirm" className="text-sm font-medium text-slate-300">
								{t("passwordConfirm")}
							</label>

							<input
								id="signup-password-confirm"
								name="passwordConfirm"
								autoComplete="new-password"
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
							{t("signup")}
						</button>
					</form>
				</div>
			</AuthOverlay>
		</div>
	);
}

export default SignUpForm;
