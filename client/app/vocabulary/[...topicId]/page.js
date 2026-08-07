async function page({ params }) {
	const { topicId } = await params;

	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/api/v1/vocab/${topicId}`,
	);
	const data = res.json();



	return <div>hello</div>;
}

export default page;
