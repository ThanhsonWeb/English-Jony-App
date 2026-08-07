"use client";
import { useState, useEffect } from "react";
import Topic from "../_components/Topic";

function Page() {
	const [isOpen, setIsOpen] = useState(false); 
	const [topics, setTopics] = useState([]);
	const [newTopic, setNewTopic] = useState("");

	useEffect(() => {
		const fetchTopics = async () => {
			console.log("Fetching topics..."); // Check if this logs
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/v1/topics`,
					{
						headers: {
							Authorization: `Bearer ${localStorage.getItem("token")}`,
						},
					},
				);
				const data = await res.json();
				console.log(data); // Check what data comes back
				setTopics(data.data.topics);
			} catch (error) {
				console.log(error); // Check if there's an error
			}
		};
		fetchTopics();
	}, []);


	// page.jsx
	return (
		<div className="min-h-[calc(100vh-80px)] bg-slate-950 px-4 sm:px-8 py-10">
			<div className="max-w-5xl mx-auto">
				<h2 className="font-semibold text-3xl text-slate-100 mb-10">
					List of Topics
				</h2>
				<button className="bg-blue-700 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors mb-10">
					+ Add New Topic
				</button>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{topics.map((topic) => (
						<Topic key={topic._id} topic={topic} />
					))}
				</div>
			</div>
		</div>
	);
}

export default Page;
