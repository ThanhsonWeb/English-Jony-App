import Link from "next/link";
export const metadata = {
	title: "Login",
};

function LoginPage() {
	return (
		// Page Wrapper with background image or dark backdrop
		<div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
			{/* Optional background glow shapes to make blur noticeable 🌟 */}
			<div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />
			<div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

			{/* Form Card with Glassmorphism (Backdrop Blur) 🔮 */}
			<form className="relative z-10 flex flex-col bg-slate-900/60 backdrop-blur-md text-slate-100 w-full max-w-md p-8 rounded-2xl border border-slate-800/80 shadow-2xl gap-4">
				<h2 className="text-2xl font-bold text-center mb-2">Welcome Back 👋</h2>
				{/* email */}
				<div className="flex flex-col gap-1">
					<label className="text-sm font-medium text-slate-300">Email</label>
					<input
						type="email"
						placeholder="name@example.com"
						className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
						required
					/>
				</div>
				{/* password */}
				<div className="flex flex-col gap-1">
					<label className="text-sm font-medium text-slate-300">Password</label>
					<input
						type="password"
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
					Sign In
				</button>

				<p className="text-sm text-center text-slate-400 mt-2">
					Don't have an account?{" "}
					<Link
						href="/signup"
						className="text-blue-400 hover:underline font-semibold"
					>
						Sign up
					</Link>
				</p>
			</form>
		</div>
	);
}

export default LoginPage;
