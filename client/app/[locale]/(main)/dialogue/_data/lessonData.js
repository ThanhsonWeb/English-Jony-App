export const lessonData = {
	"office-introduction": {
		title: "Ngày đầu tiên tại văn phòng",
		tasks: [
			{
				id: "1",
				type: "listening",
				title: "Nghe đoạn hội thoại",
				description: "Nghe và đọc đoạn hội thoại giữa Maria và Tom.",
				dialogue: [
					{
						speaker: "Maria",
						text: "Hello. You're the new graphic designer, right?",
					},
					{
						speaker: "Tom",
						text: "Yes, that's right. My name is Tom.",
					},
				],
			},
			{
				id: "2",
				type: "fillBlank",
				title: "Điền từ còn thiếu",
				sentenceBefore: "Hello.",
				sentenceAfter: "the new graphic designer, right?",
				answer: "you're",
			},
			{
				id: "3",
				type: "multipleChoice",
				title: "Chọn câu phù hợp",
				question:
					"Maria vừa giới thiệu bản thân. Tom nên trả lời thế nào?",
				options: [
					"Nice to meet you.",
					"How old are you?",
					"Where is the bathroom?",
				],
				answer: "Nice to meet you.",
			},
			{
				id: "4",
				type: "arrangeWords",
				title: "Sắp xếp câu",
				words: ["you", "meet", "Nice", "to"],
				answer: ["Nice", "to", "meet", "you"],
			},
			{
				id: "5",
				type: "review",
				title: "Ôn lại hội thoại",
				dialogue: [
					{
						speaker: "Maria",
						text: "Hello. You're the new graphic designer, right?",
					},
					{
						speaker: "Tom",
						text: "Yes, that's right. My name is Tom.",
					},
					{
						speaker: "Maria",
						text: "Nice to meet you, Tom. I'm Maria.",
					},
				],
			},
		],
	},
};