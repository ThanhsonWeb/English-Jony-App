const askingForDirections = {
	courseId: "asking-for-directions",

	level: "beginner",

	characters: ["Ben", "Emma"],

	dialogues: [
		{
			dialogueId: "finding-the-bus-stop",
			title: "Tìm trạm xe buýt ",
			thumbnail:
				"/dialogue/asking-for-directions/thumbnails/finding-the-bus-stop.png",
			situation: "Ben hỏi Emma cách đi đến trạm xe buýt gần nhất.",
		},
		{
			dialogueId: "going-to-the-supermarket",
			title: "Đi đến siêu thị",
			thumbnail:
				"/dialogue/asking-for-directions/thumbnails/going-to-the-supermarket.png",
			situation: "Ben hỏi Emma cách đi đến một siêu thị gần đó.",
		},
		{
			dialogueId: "finding-the-train-station",
			title: "Tìm ga tàu",
			thumbnail:
				"/dialogue/asking-for-directions/thumbnails/finding-the-train-station.png",
			situation: "Ben hỏi Emma cách đi đến ga tàu.",
		},
		{
			dialogueId: "finding-a-cafe",
			title: "Tìm quán cà phê",

			situation:
				"Buổi tối, Ben đang trên đường đến gặp Emma tại một quán cà phê. Emma đã ở quán, còn Ben đang ở ngoài đường và không tìm thấy quán nên gọi cho Emma để hỏi đường.",

			thumbnail:
				"/dialogue/asking-for-directions/thumbnails/finding-a-cafe.png",

			scenes: {
				Ben: "/dialogue/asking-for-directions/finding-a-cafe/bg-ben.png",
				Emma: "/dialogue/asking-for-directions/finding-a-cafe/bg-emma.png",
			},
		},
		{
			dialogueId: "finding-the-restroom",
			title: "Tìm nhà vệ sinh",
			thumbnail:
				"/dialogue/asking-for-directions/thumbnails/finding-the-restroom.png",
			situation: "Ben hỏi Emma nhà vệ sinh gần nhất ở đâu.",
		},
	],
};

export default askingForDirections;
