"use client";

import { useAuth } from "@/app/_contexts/AuthContext";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getAuthErrorMessage } from "@/app/_lib/authErrorMessage";
import GoogleSignInButton from "@/app/_components/GoogleSignInButton";
import AuthOverlay from "@/app/_components/AuthOverlay";

function LoginPage() {
	const t = useTranslations("Auth");
	const { setUser } = useAuth();
	const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
	const locale = useLocale();
	const searchParams = useSearchParams();
	const authError = searchParams.get("error");
	const callbackError =
		authError === "google_session_failed"
			? t("googleSessionFailed")
			: authError === "google_oauth_failed"
				? t("googleOAuthFailed")
				: "";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
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
				setError(getAuthErrorMessage(data, t, "loginFailed"));
				return;
			}

			if (data.status === "success") {
				setUser(data.data.user);
				router.push("/wordlist");
				return;
			}
			// console.log(data);
		} catch (error) {
			setError(t("loginFailed"));
			console.log(error);
		} finally {
			setIsLoading(false);
		}
	}
	return (
		<div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
			<AuthOverlay>
				<form
					onSubmit={handleSubmit}
					className="relative z-10 flex w-full max-w-md flex-col rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 text-slate-100 shadow-2xl backdrop-blur-xl sm:p-8"
				>
					{/* Close Button */}
					<Link
						href="/"
						aria-label={t("close")}
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
							alt={t("logoAlt")}
							className="h-14 w-14 rounded-2xl border border-slate-800"
						/>

						<h1 className="mt-4 text-2xl font-bold text-white">{t("login")}</h1>

						<p className="mt-1 text-sm text-slate-400">
							{t("loginSubtitle")} 🚀
						</p>
					</div>

					{/* Google */}
					<GoogleSignInButton
						onClick={openGoogleSignIn}
						disabled={!googleClientId}
						text={t("googleLogin")}
					/>

					{/* Divider */}
					<div className="my-6 flex items-center gap-4">
						<div className="h-px flex-1 bg-slate-800" />
						<span className="text-xs font-medium text-slate-500">{t("or")}</span>
						<div className="h-px flex-1 bg-slate-800" />
					</div>

					{/* Error */}
					{(error || callbackError || !googleClientId) && (
						<div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
							{error ||
								callbackError ||
								t("googleUnavailable")}
						</div>
					)}

					{/* Email */}
					<div className="mb-4 flex flex-col gap-1.5">
						<label htmlFor="login-email" className="text-sm font-medium text-slate-300">{t("email")}</label>

						<input
							id="login-email"
							name="email"
							autoComplete="username"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={t("emailPlaceholder")}
							className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
							required
						/>
					</div>

					{/* Password */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="login-password" className="text-sm font-medium text-slate-300">
							{t("password")}
						</label>

						<div className="relative">
							<input
								id="login-password"
								name="password"
								autoComplete="current-password"
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3.5 pr-12 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
								required
							/>
							<button
								type="button"
								onClick={() => setShowPassword((visible) => !visible)}
								aria-label={t(showPassword ? "hidePassword" : "showPassword")}
								aria-pressed={showPassword}
								className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-slate-400 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							>
								<svg
									aria-hidden="true"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									className="h-5 w-5"
								>
									{showPassword ? (
										<>
											<path d="M3 3l18 18" />
											<path d="M10.6 10.6a2 2 0 002.8 2.8" />
											<path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C4.2 7.5 2.9 9.5 2.5 12c1 2.8 4.5 7 9.5 7 1 0 1.9-.2 2.8-.5" />
										</>
									) : (
										<>
											<path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
											<circle cx="12" cy="12" r="3" />
										</>
									)}
								</svg>
							</button>
						</div>
					</div>

					{/* Submit */}
					<button
						type="submit"
						disabled={loading}
						className="mt-6 rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{t(loading ? "loggingIn" : "login")}
					</button>

					{/* Signup */}
					<p className="mt-5 text-center text-sm text-slate-400">
						{t("noAccount")}{" "}
						<Link
							href="/signup"
							className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
						>
							{t("signup")}
						</Link>
					</p>
				</form>
			</AuthOverlay>
		</div>
	);
}

export default LoginPage;
