export const lessonData = {
	"office-introduction": {
		id: "office-introduction",
		title: "Ngày đầu tiên tại văn phòng",
		description:
			"Maria gặp Tom trong ngày đầu đi làm. Học cách giới thiệu bản thân và giao tiếp trong văn phòng.",
		level: "Beginner",
		duration: "25 phút",
		dialogues: [
			{
				id: "meeting-tom",
				title: "Maria gặp Tom",
				description: "Maria làm quen với Tom trong ngày đầu tiên tại công ty.",
				scene: "/dialogue/office-introduction/shared/bg.png",
				characters: {
					Maria: "/dialogue/office-introduction/shared/maria.png",
					Tom: "/dialogue/office-introduction/shared/tom.png",
				},
				dialogue: [
					{
						speaker: "Maria",
						text: "Hi, you must be Tom. I’m Maria, the product designer here.",
						translation:
							"Chào, bạn chắc là Tom. Tôi là Maria, nhà thiết kế sản phẩm ở đây.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-01.mp3",
					},
					{
						speaker: "Tom",
						text: "Hi Maria, nice to meet you. Yeah, today’s my first day.",
						translation:
							"Chào Maria, rất vui được gặp bạn. Vâng, hôm nay là ngày đầu tiên tôi đi làm.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-01.mp3",
					},
					{
						speaker: "Maria",
						text: "Welcome! How are you feeling so far?",
						translation: "Chào mừng bạn! Đến giờ bạn cảm thấy thế nào?",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
					},
					{
						speaker: "Tom",
						text: "Pretty good, just a little nervous.",
						translation: "Khá ổn, chỉ hơi lo lắng một chút.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-02.mp3",
					},
					{
						speaker: "Maria",
						text: "Don’t worry. Everyone’s really friendly here.",
						translation: "Đừng lo. Mọi người ở đây đều rất thân thiện.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
					},
					{
						speaker: "Tom",
						text: "That’s good to hear. Thanks for helping me out.",
						translation: "Nghe vậy thật tốt. Cảm ơn bạn đã giúp đỡ tôi.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-03.mp3",
					},
					{
						speaker: "Maria",
						text: "Of course. Let me show you around the office.",
						translation:
							"Tất nhiên rồi. Để tôi dẫn bạn đi tham quan văn phòng.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
					},
					{
						speaker: "Tom",
						text: "Sounds great. Let’s go.",
						translation: "Tuyệt đấy. Đi thôi.",
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-04.mp3",
					},
				],
				tasks: [
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						sentenceBefore: "Hello.",
						sentenceAfter: "the new graphic designer, right?",
						answer: "you're",
					},
					{
						id: "2",
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
						id: "3",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						words: ["you", "meet", "Nice", "to"],
						answer: ["Nice", "to", "meet", "you"],
					},
					{
						id: "4",
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
			{
				id: "office-tour",
				title: "Tham quan văn phòng",
				description: "Tom giới thiệu Maria về các khu vực trong văn phòng.",
				tasks: [],
			},
			{
				id: "meet-coworkers",
				title: "Gặp đồng nghiệp mới",
				description: "Maria gặp và làm quen với các đồng nghiệp khác.",
				tasks: [],
			},
			{
				id: "talk-about-work",
				title: "Hỏi về công việc",
				description: "Maria và Tom nói về công việc và nhiệm vụ.",
				tasks: [],
			},
			{
				id: "lunch-break",
				title: "Giờ nghỉ trưa",
				description: "Maria và Tom cùng ăn trưa và trò chuyện.",
				tasks: [],
			},
		],
	},
};
