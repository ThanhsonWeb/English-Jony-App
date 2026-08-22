"use client";

import StudyHeatmap from "@/app/_components/StudyHeatmap";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useState } from "react";
import {
	Mail,
	CalendarDays,
	Pencil,
	Camera,
	Languages,
	Volume2,
	Moon,
	LogOut,
} from "lucide-react";

function Page() {
	const { user, setUser } = useAuth();
	const [isEditingName, setIsEditingName] = useState(false);
	const [newName, setNewName] = useState(user?.name || "");

	async function handleUpdateName() {
		try {
			const res = await fetch("/api/v1/users/updateMe", {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: newName,
				}),
			});

			if (!res.ok) return;

			const data = await res.json();

			setUser(data.data.user);
			setIsEditingName(false);
		} catch (error) {
			console.log(error);
		}
	}

	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-100">
			{/* Profile top */}
			<div className="mb-10 flex flex-col items-center gap-6 sm:flex-row">
				<div className="relative">
					{user?.photo ? (
						<img
							src={user.photo}
							alt={user.name}
							className="h-36 w-36 rounded-full border-4  object-cover"
						/>
					) : (
						<div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-blue-200 bg-slate-800 text-4xl font-bold">
							{user?.name?.charAt(0).toUpperCase()}
						</div>
					)}

					<button className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg">
						<Camera size={20} />
					</button>
				</div>
						
				<div className="mt-5 sm:mt-0">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold">{user?.name}</h1>
						<button
							onClick={() => setIsEditingName(true)}
							className="text-slate-400 hover:text-white cursor-pointer"
						>
							<Pencil size={18} />
						</button>
					</div>
					{isEditingName && (
						<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
							<div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
								<button
									onClick={() => setIsEditingName(false)}
									className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl text-slate-400 transition hover:bg-slate-700 hover:text-white"
								>
									✕
								</button>

								<h2 className="mb-6 text-center text-2xl font-bold text-white">
									Cập nhật tên của bạn
								</h2>

								<input
									type="text"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
								/>

								<button
									type="button"
									onClick={handleUpdateName}
									className="mx-auto mt-8 block rounded-2xl bg-blue-900 px-16 py-3 font-semibold text-white transition hover:bg-blue-800"
								>
									Lưu
								</button>
							</div>
						</div>
					)}

					<div className="mt-4 flex items-center gap-2 text-slate-300">
						<Mail size={18} />
						<span>{user?.email}</span>
					</div>

					<div className="mt-2 flex items-center gap-2 text-slate-300">
						<CalendarDays size={18} />
						<span>
							Ngày tham gia:{" "}
							{user?.createdAt
								? new Date(user.createdAt).toLocaleDateString("vi-VN")
								: "—"}
						</span>
					</div>
				</div>
			</div>

			<StudyHeatmap />

			{/* Settings */}
			<div className="mt-4 space-y-4">
				<div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
					<div className="flex items-center gap-4">
						<Languages className="text-blue-400" />
						<span className="font-medium">Ngôn ngữ hiển thị</span>
					</div>

					<button className="rounded-xl bg-gray-900 px-4 py-2 font-medium">
						🇻🇳 Tiếng Việt
					</button>
				</div>

				<div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
					<div className="flex items-center gap-4">
						<Volume2 className="text-blue-400" />
						<span className="font-medium">Hiệu ứng âm thanh</span>
					</div>

					<input type="range" className="w-32" />
				</div>

				<div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
					<div className="flex items-center gap-4">
						<Moon className="text-blue-400" />
						<span className="font-medium">Chế độ dark mode</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export default Page;
