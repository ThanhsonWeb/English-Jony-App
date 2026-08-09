"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function SignUpForm() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [error, setError] = useState("");
	const router = useRouter();

	const handleSubmit = async (e) => {
		e.preventDefault();
		// Add your fetch to localhost:5000/register here later
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/signup`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ name, email, password, passwordConfirm }),
				},
			);
			const data = await res.json();

			if (data.status === "fail") {
				setError(data.message);
				return;
			}

			console.log(data);
			localStorage.setItem("token", data.token);
			router.push("/vocabulary"); // Add redirect
		} catch (error) {
			console.log(error);
		}
	};

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
						<h1 className="text-3xl font-bold">Sign Up</h1>
						<p className="text-slate-400 text-sm">
							Already have an account?
							<Link
								href="/login"
								className="text-blue-400 hover:underline font-semibold"
							>
								Sign In
							</Link>
						</p>
					</div>
	
					{/* sign up with google .... */}
	
					{/* Divider (Optional) */}
					<div className="flex items-center gap-4 mb-6 text-slate-500 text-xs">
						<div className="flex-1 h-px bg-slate-800"></div>
						OR
						<div className="flex-1 h-px bg-slate-800"></div>
					</div>
			
					{/* Form */}
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						{error && (
							<div className=" text-sm text-red-400 rounded-xl">*{error}</div>
						)}
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Full name"
							className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
							required
						/>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Email Address"
							className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
							required
						/>
	
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Password"
							className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
							required
						/>
						<input
							type="password"
							value={passwordConfirm}
							onChange={(e) => setPasswordConfirm(e.target.value)}
							placeholder="PasswordConfirm"
							className="border border-slate-700/80 bg-slate-950/50 p-3.5 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
							required
						/>
						<button
							type="submit"
							className="mt-2 p-3.5 text-base font-semibold bg-blue-700 hover:bg-blue-600 rounded-xl text-white transition-all duration-200 shadow-lg shadow-blue-600/30 cursor-pointer "
						>
							Sign Up
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

export default SignUpForm;
