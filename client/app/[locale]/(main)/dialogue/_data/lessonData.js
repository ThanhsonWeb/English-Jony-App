export const lessonData = {
	"office-introduction": {
		id: "office-introduction",
		title: "Ngày đầu tiên tại văn phòng",
		description:
			"Maria gặp Tom trong ngày đầu đi làm. Học cách giới thiệu bản thân và giao tiếp trong văn phòng.",
		level: "Beginner",
		duration: "25 phút",
		dialogues: [
			// meeting-tom
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
					// 1
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-01.mp3",
						transcript:
							"Hi, you must be Tom. I’m Maria, the product designer here.",

						sentenceBefore: "Hi, you must be",
						sentenceAfter: ". I’m Maria, the product designer here.",
						answer: "Tom",
					},

					// 2
					{
						id: "2",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn đáp án phù hợp nhất.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-01.mp3",
						transcript:
							"Hi, you must be Tom. I’m Maria, the product designer here.",

						question: "Maria làm công việc gì?",
						options: [
							"Product designer",
							"Software engineer",
							"Office manager",
						],
						answer: "Product designer",
					},

					// 3
					{
						id: "3",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-01.mp3",
						transcript:
							"Hi Maria, nice to meet you. Yeah, today’s my first day.",

						sentenceBefore: "Hi Maria, nice to",
						sentenceAfter: "you.",
						answer: "meet",
					},

					// 4
					{
						id: "4",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						instruction: "Nghe Tom và sắp xếp câu đúng thứ tự.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-01.mp3",
						transcript: "Nice to meet you.",

						words: ["meet", "you", "Nice", "to"],
						answer: ["Nice", "to", "meet", "you"],
					},

					// 5
					{
						id: "5",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-01.mp3",
						transcript:
							"Hi Maria, nice to meet you. Yeah, today’s my first day.",

						question: "Hôm nay là ngày gì đối với Tom?",
						options: [
							"Ngày đầu tiên đi làm",
							"Ngày cuối cùng đi làm",
							"Ngày nghỉ",
						],
						answer: "Ngày đầu tiên đi làm",
					},

					// 6
					{
						id: "6",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
						transcript: "Welcome! How are you feeling so far?",

						sentenceBefore: "How are you",
						sentenceAfter: "so far?",
						answer: "feeling",
					},

					// 7
					{
						id: "7",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn ý đúng.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
						transcript: "Welcome! How are you feeling so far?",

						question: "Maria đang hỏi Tom điều gì?",
						options: [
							"Tom cảm thấy thế nào",
							"Tom sống ở đâu",
							"Tom bao nhiêu tuổi",
						],
						answer: "Tom cảm thấy thế nào",
					},

					// 8
					{
						id: "8",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						instruction: "Nghe Maria và sắp xếp câu đúng thứ tự.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
						transcript: "How are you feeling so far?",

						words: ["feeling", "are", "so", "you", "How", "far"],
						answer: ["How", "are", "you", "feeling", "so", "far"],
					},

					// 9
					{
						id: "9",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-02.mp3",
						transcript: "Pretty good, just a little nervous.",

						sentenceBefore: "Pretty good, just a little",
						sentenceAfter: ".",
						answer: "nervous",
					},

					// 10
					{
						id: "10",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-02.mp3",
						transcript: "Pretty good, just a little nervous.",

						question: "Tom đang cảm thấy thế nào?",
						options: [
							"Khá ổn nhưng hơi lo lắng",
							"Rất tức giận",
							"Rất buồn ngủ",
						],
						answer: "Khá ổn nhưng hơi lo lắng",
					},

					// 11
					{
						id: "11",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
						transcript: "Don’t worry. Everyone’s really friendly here.",

						sentenceBefore: "Don’t",
						sentenceAfter: ". Everyone’s really friendly here.",
						answer: "worry",
					},

					// 12
					{
						id: "12",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn ý đúng.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
						transcript: "Don’t worry. Everyone’s really friendly here.",

						question: "Maria nói mọi người trong công ty như thế nào?",
						options: ["Rất thân thiện", "Rất nghiêm khắc", "Rất yên lặng"],
						answer: "Rất thân thiện",
					},

					// 13
					{
						id: "13",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						instruction: "Nghe Maria và sắp xếp câu đúng thứ tự.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
						transcript: "Everyone’s really friendly here.",

						words: ["friendly", "here", "really", "Everyone’s"],
						answer: ["Everyone’s", "really", "friendly", "here"],
					},

					// 14
					{
						id: "14",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-03.mp3",
						transcript: "That’s good to hear. Thanks for helping me out.",

						sentenceBefore: "That’s good to",
						sentenceAfter: ". Thanks for helping me out.",
						answer: "hear",
					},

					// 15
					{
						id: "15",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-03.mp3",
						transcript: "That’s good to hear. Thanks for helping me out.",

						question: "Tom đang làm gì?",
						options: ["Cảm ơn Maria", "Mời Maria ăn trưa", "Hỏi Maria một câu"],
						answer: "Cảm ơn Maria",
					},

					// 16
					{
						id: "16",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
						transcript: "Of course. Let me show you around the office.",

						sentenceBefore: "Let me show you around the",
						sentenceAfter: ".",
						answer: "office",
					},

					// 17
					{
						id: "17",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn đáp án đúng.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
						transcript: "Of course. Let me show you around the office.",

						question: "Maria đề nghị làm gì?",
						options: [
							"Dẫn Tom tham quan văn phòng",
							"Đưa Tom về nhà",
							"Mời Tom uống cà phê",
						],
						answer: "Dẫn Tom tham quan văn phòng",
					},

					// 18
					{
						id: "18",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						instruction: "Nghe Maria và sắp xếp câu đúng thứ tự.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
						transcript: "Let me show you around the office.",

						words: ["around", "you", "office", "show", "the", "Let", "me"],
						answer: ["Let", "me", "show", "you", "around", "the", "office"],
					},

					// 19
					{
						id: "19",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-04.mp3",
						transcript: "Sounds great. Let’s go.",

						sentenceBefore: "Sounds",
						sentenceAfter: ". Let’s go.",
						answer: "great",
					},

					// 20
					{
						id: "20",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án phù hợp nhất.",

						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-04.mp3",
						transcript: "Sounds great. Let’s go.",

						question: "Tom phản ứng thế nào với lời đề nghị của Maria?",
						options: ["Anh ấy đồng ý", "Anh ấy từ chối", "Anh ấy không hiểu"],
						answer: "Anh ấy đồng ý",
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
