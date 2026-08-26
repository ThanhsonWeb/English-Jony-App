export const lessonData = {
	"office-introduction": {
		title: "Ngày đầu tiên tại văn phòng",
		tasks: [
			{
				id: "1",
				type: "listening",
				title: "Nghe đoạn hội thoại",
				description: "Nghe và đọc đoạn hội thoại giữa Maria và Tom.",
				scene: "/audio/office/bg.png",

				characters: {
					Maria: "/audio/office/maria.png",
					Tom: "/audio/office/tom.png",
				},

				dialogue: [
					{
						speaker: "Maria",
						text: "Hi, you must be Tom. I’m Maria, the product designer here.",
						audioUrl: "/audio/office/maria-01.mp3",
					},
					{
						speaker: "Tom",
						text: "Hi Maria, nice to meet you. Yeah, today’s my first day.",
						audioUrl: "/audio/office/tom-01.mp3",
					},
					{
						speaker: "Maria",
						text: "Welcome! How are you feeling so far?",
						audioUrl: "/audio/office/maria-02.mp3",
					},
					{
						speaker: "Tom",
						text: "Pretty good, just a little nervous.",
						audioUrl: "/audio/office/tom-02.mp3",
					},
					{
						speaker: "Maria",
						text: "Don’t worry. Everyone’s really friendly here.",
						audioUrl: "/audio/office/maria-03.mp3",
					},
					{
						speaker: "Tom",
						text: "That’s good to hear. Thanks for helping me out.",
						audioUrl: "/audio/office/tom-03.mp3",
					},
					{
						speaker: "Maria",
						text: "Of course. Let me show you around the office.",
						audioUrl: "/audio/office/maria-04.mp3",
					},
					{
						speaker: "Tom",
						text: "Sounds great. Let’s go.",
						audioUrl: "/audio/office/tom-04.mp3",
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
				question: "Maria vừa giới thiệu bản thân. Tom nên trả lời thế nào?",
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
