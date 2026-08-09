"use client";

import Button from "@/app/_components/Button";
import { useParams } from "next/navigation";
import { useEffect } from "react";

function Page() {
	const { topicId } = useParams();
	// GET ALL the word when TopicId onChange
	useEffect(() => {
		async function fetchData() {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/v1/vocab/`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				},
			);

			const data = await res.json();

			console.log(data);
		}

		fetchData();
	}, [topicId]);

	return (
		<div className="flex flex-col justify-center items-center w-2xl mx-auto  ">
			<h1 className="text-3xl font-semibold mt-5">Vocabulary List </h1>
			<div className="flex justify-between mt-6 w-full ">
				<input className="p-3 border" type="text" placeholder="search word  " />
				<div>
					<select className="p-3 border">
						<option value="all">Filter</option>
						<option value="all">All</option>
						<option value="to learned ">To Learn</option>
						<option value="learned">Learned</option>
					</select>

					<Button>+ Add new Word</Button>
				</div>
			</div>
			{/* list words */}
			<div className="flex justify-around text-2xl w-full">
				<h3>name</h3>
				<h3>Api</h3>
				<h3>Example</h3>
				<h3>pronoun</h3>
				<h3>Action</h3>
			</div>
		</div>
	);
}

export default Page;
