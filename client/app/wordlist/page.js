"use client";
import { useState, useEffect } from "react";
import Topic from "../_components/Topic";
import Button from "../_components/Button";

function Page() {
	const [isOpen, setIsOpen] = useState(false);
	const [topics, setTopics] = useState([]);
	const [newTopic, setNewTopic] = useState("");
	const [description, setDescription] = useState("");

	useEffect(() => {
		const fetchTopics = async () => {
			try {
				const res = await fetch("/api/v1/topics", {
					method: "GET",
					credentials: "include",
				});
				if (res.status === 401) {
					console.error("User is not authenticated");
					return;
				}
				const data = await res.json();
				setTopics(data.data.topics);
			} catch (error) {
				console.log(error);
			}
		};
		fetchTopics();
	}, []);

	async function handleSubmit(e) {
		e.preventDefault();
		try {
			const res = await fetch("/api/v1/topics", {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: newTopic, description }),
			});
			const data = await res.json();

			if (data.status === "success") {
				setTopics([...topics, data.data.topic]);
				setNewTopic("");
				setDescription("");
				setIsOpen(false);
			}
		} catch (error) {
			console.log(error);
		}
	}

	async function handleDelete(id) {
		if (!confirm("Are you sure you want to delete this topic?")) return;

		try {
			const res = await fetch(`/api/v1/topics/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (res.ok) {
				setTopics((prev) => prev.filter((topic) => topic._id !== id));
			}
		} catch (error) {
			console.log(error);
		}
	}

	async function handleFix(id, updatedName, updatedDescription) {
		try {
			const res = await fetch(`/api/v1/topics/${id}`, {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: updatedName,
					description: updatedDescription,
				}),
			});
			//update the UI instantly
			if (res.ok) {
				setTopics((prev) =>
					prev.map((topic) =>
						topic._id === id
							? { ...topic, name: updatedName, description: updatedDescription }
							: topic,
					),
				);
			}
		} catch (error) {
			console.log(error);
		}
	}

	return (
		<div className="min-h-[calc(100vh-80px)] bg-slate-950 px-4 sm:px-8 py-10">
			<div className="max-w-5xl mx-auto">
				<h2 className="font-semibold text-3xl text-center text-slate-100 mb-10">
					List of Topics
				</h2>
				<Button onClick={() => setIsOpen(!isOpen)} size="md">
					+ Tạo danh sách từ
				</Button>
				{/* form */}
				{isOpen && (
					<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
						<form
							onSubmit={handleSubmit}
							className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-8 flex flex-col gap-4"
						>
							<div className="flex items-center justify-between">
								<h4 className="text-xl font-bold text-slate-100">
									Tạo danh sách từ mới
								</h4>
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="text-slate-400 hover:text-white text-2xl cursor-pointer"
								>
									&times;
								</button>
							</div>

							<div className="flex flex-col gap-1">
								<label className="text-sm font-medium text-slate-300">
									Tiêu đề
								</label>
								<input
									type="text"
									placeholder="Nhập tiêu đề danh sách từ..."
									value={newTopic}
									onChange={(e) => setNewTopic(e.target.value)}
									className="border border-slate-700/80 bg-slate-950/50 p-3 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
									required
								/>
							</div>

							<div className="flex flex-col gap-1">
								<label className="text-sm font-medium text-slate-300">
									Ghi chú
								</label>
								<textarea
									placeholder="Nhập ghi chú hoặc mô tả..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
									className="border border-slate-700/80 bg-slate-950/50 p-3 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div className="flex gap-3 mt-2">
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="flex-1 p-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
								>
									Hủy
								</button>
								<Button type="submit">Create</Button>
							</div>
						</form>
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
					{topics.map((topic) => (
						<Topic
							key={topic._id}
							topic={topic}
							onDelete={handleDelete}
							onFix={handleFix}
							setIsOpen={setIsOpen}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export default Page;
