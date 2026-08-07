"use client";
import { useState, useEffect } from "react";

function Page() {
	const [topics, setTopics] = useState([]);

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

	return (
		<div>
			<h2>List of Topics</h2>
			{topics.map((topic) => (
				<div key={topic._id}>
					<h2>{topic.name}</h2>
				</div>
			))}
		</div>
	);
}

export default Page;
