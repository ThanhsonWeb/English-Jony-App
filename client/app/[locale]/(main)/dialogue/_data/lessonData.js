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
				scene: "/dialogue/office-introduction/meeting-tom/bg.png",
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
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'Trong "You must be Tom", "must be" mang nghĩa phỏng đoán: chắc bạn là Tom.',
								"Cách nói này dùng khi bạn khá chắc về điều mình đoán.",
							],
						},
						grammar: {
							title: "must be",
							explanation:
								'“must be” dùng để đưa ra một phỏng đoán mà người nói khá chắc chắn.',
							example: "You must be tired. = Chắc bạn mệt rồi.",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-01.mp3",
						transcript:
							"Hi, you must be Tom. I’m Maria, the product designer here.",
						sentenceBefore: "Hi, you must be ",
						sentenceAfter: ". I’m Maria, the product designer here.",
						answer: "Tom",
					},
					{
						id: "2",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"I’m" là dạng rút gọn của "I am".',
								'"I’m + tên/nghề nghiệp" thường dùng để giới thiệu bản thân.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-01.mp3",
						transcript:
							"Hi, you must be Tom. I’m Maria, the product designer here.",
						sentenceBefore: "Hi, you must be Tom. I’m Maria, the ",
						sentenceAfter: " designer here.",
						answer: "product",
					},
					{
						id: "3",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"product designer" nghĩa là nhà thiết kế sản phẩm.',
								'"I’m" là cách nói ngắn gọn và tự nhiên của "I am".',
							],
						},
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
					{
						id: "4",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"Nice to meet you" là cách tự nhiên để nói khi gặp ai đó lần đầu.',
								"Bạn thường dùng câu này ngay sau khi giới thiệu tên.",
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-01.mp3",
						transcript:
							"Hi Maria, nice to meet you. Yeah, today’s my first day.",
						sentenceBefore: "Hi Maria, nice to ",
						sentenceAfter: " you. Yeah, today’s my first day.",
						answer: "meet",
					},
					{
						id: "5",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"today’s" là dạng rút gọn của "today is".',
								'"my first day" nghĩa là ngày đầu tiên của tôi.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-01.mp3",
						transcript:
							"Hi Maria, nice to meet you. Yeah, today’s my first day.",
						sentenceBefore: "Hi Maria, nice to meet you. Yeah, today’s my ",
						sentenceAfter: " day.",
						answer: "first",
					},
					{
						id: "6",
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
					{
						id: "7",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"today’s" là dạng rút gọn của "today is".',
								'"Today’s my first day" thường dùng khi mới bắt đầu đi học hoặc đi làm.',
							],
						},
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
							"Ngày thứ hai đi làm",
							"Ngày nghỉ",
						],
						answer: "Ngày đầu tiên đi làm",
					},
					{
						id: "8",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"How are you feeling?" dùng để hỏi trạng thái hoặc cảm xúc hiện tại.',
								'"feeling" ở đây nói về cảm giác của một người.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
						transcript: "Welcome! How are you feeling so far?",
						sentenceBefore: "Welcome! How are you ",
						sentenceAfter: " so far?",
						answer: "feeling",
					},
					{
						id: "9",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"so far" nghĩa là cho đến lúc này.',
								"Cụm này thường nói về một trải nghiệm vẫn đang diễn ra.",
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
						transcript: "Welcome! How are you feeling so far?",
						sentenceBefore: "Welcome! How are you feeling so ",
						sentenceAfter: "?",
						answer: "far",
					},
					{
						id: "10",
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
					{
						id: "11",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"so far" nghĩa là cho đến lúc này.',
								"Cụm này nói về một trải nghiệm vẫn đang diễn ra.",
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-02.mp3",
						transcript: "Welcome! How are you feeling so far?",
						question: "Trong câu này, “so far” có nghĩa là gì?",
						options: [
							"Cho đến lúc này",
							"Từ rất lâu trước đây",
							"Vào ngày mai",
						],
						answer: "Cho đến lúc này",
					},
					{
						id: "12",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"a little" giúp diễn tả một cảm xúc ở mức độ nhẹ.',
								'"nervous" nghĩa là lo lắng hoặc hồi hộp.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-02.mp3",
						transcript: "Pretty good, just a little nervous.",
						sentenceBefore: "Pretty good, just a little ",
						sentenceAfter: ".",
						answer: "nervous",
					},
					{
						id: "13",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"a little + tính từ" diễn tả một trạng thái ở mức độ nhẹ.',
								'"a little nervous" nghĩa là hơi lo lắng.',
							],
						},
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
							"Hoàn toàn bình tĩnh",
							"Khá mệt và buồn",
						],
						answer: "Khá ổn nhưng hơi lo lắng",
					},
					{
						id: "14",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'Trong câu này, "pretty" có nghĩa là khá.',
								'Nó không mang nghĩa xinh đẹp trong cụm "Pretty good".',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-02.mp3",
						transcript: "Pretty good, just a little nervous.",
						question: "Trong “Pretty good”, từ “pretty” có nghĩa là gì?",
						options: ["Khá", "Xinh đẹp", "Hoàn toàn"],
						answer: "Khá",
					},
					{
						id: "15",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"Don’t" là dạng rút gọn của "do not".',
								'"Don’t worry" là cách rất phổ biến để trấn an ai đó.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
						transcript: "Don’t worry. Everyone’s really friendly here.",
						sentenceBefore: "Don’t ",
						sentenceAfter: ". Everyone’s really friendly here.",
						answer: "worry",
					},
					{
						id: "16",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"Everyone’s" ở đây là dạng rút gọn của "everyone is".',
								'"really friendly" nghĩa là rất thân thiện.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
						transcript: "Don’t worry. Everyone’s really friendly here.",
						sentenceBefore: "Don’t worry. Everyone’s really ",
						sentenceAfter: " here.",
						answer: "friendly",
					},
					{
						id: "17",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"Everyone’s" là dạng rút gọn của "everyone is" trong câu này.',
								'"friendly" dùng để nói một người thân thiện, dễ gần.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-03.mp3",
						transcript: "Don’t worry. Everyone’s really friendly here.",
						question: "Maria nói mọi người trong công ty như thế nào?",
						options: ["Rất thân thiện", "Khá nghiêm khắc", "Hơi xa cách"],
						answer: "Rất thân thiện",
					},
					{
						id: "18",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"That’s" là dạng rút gọn của "That is".',
								'"That’s good to hear" là cách tự nhiên để phản hồi khi nghe điều tích cực.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-03.mp3",
						transcript: "That’s good to hear. Thanks for helping me out.",
						sentenceBefore: "That’s good to ",
						sentenceAfter: ". Thanks for helping me out.",
						answer: "hear",
					},
					{
						id: "19",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Tom và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"Thanks for + động từ-ing" dùng để cảm ơn ai đó vì một việc.',
								'"Thanks for helping me out" là lời cảm ơn thân thiện, tự nhiên.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-03.mp3",
						transcript: "That’s good to hear. Thanks for helping me out.",
						sentenceBefore: "That’s good to hear. Thanks for ",
						sentenceAfter: " me out.",
						answer: "helping",
					},
					{
						id: "20",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Tom và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"help someone out" nghĩa là giúp ai đó khi họ cần.',
								"Đây là cách nói thân thiện trong hội thoại hằng ngày.",
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/tom-03.mp3",
						transcript: "That’s good to hear. Thanks for helping me out.",
						question: "Trong câu này, “helping me out” có nghĩa là gì?",
						options: ["Giúp đỡ tôi", "Chờ tôi", "Gọi cho tôi"],
						answer: "Giúp đỡ tôi",
					},
					{
						id: "21",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"show someone around" nghĩa là dẫn ai đó đi tham quan.',
								'"office" nghĩa là văn phòng hoặc nơi làm việc.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
						transcript: "Of course. Let me show you around the office.",
						sentenceBefore: "Of course. Let me show you around the ",
						sentenceAfter: ".",
						answer: "office",
					},
					{
						id: "22",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: [
								'"Let me + động từ" dùng khi bạn đề nghị làm gì cho người khác.',
								'"Let me show you around" là lời đề nghị dẫn ai đó đi tham quan.',
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
						transcript: "Of course. Let me show you around the office.",
						sentenceBefore: "Of course. Let me ",
						sentenceAfter: " you around the office.",
						answer: "show",
					},
					{
						id: "23",
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
					{
						id: "24",
						type: "multipleChoice",
						title: "Chọn câu phù hợp",
						instruction: "Nghe Maria và chọn đáp án đúng.",
						tip: {
							title: "Mẹo",
							lines: [
								'"show you around" nghĩa là dẫn bạn đi tham quan một nơi.',
								"Đây là lời đề nghị thân thiện dành cho người mới.",
							],
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meeting-tom/audio/maria-04.mp3",
						transcript: "Of course. Let me show you around the office.",
						question: "Trong câu này, “show you around” có nghĩa là gì?",
						options: [
							"Dẫn bạn đi tham quan",
							"Chờ bạn ở bên ngoài",
							"Chỉ đường cho bạn về nhà",
						],
						answer: "Dẫn bạn đi tham quan",
					},
					{
						id: "25",
						type: "dialogueCloze",
						title: "Ôn tập hội thoại",
						instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",

						lines: [
							{
								speaker: "Maria",
								parts: [
									"Hi, you must be ",
									{ blank: "Tom", id: "1" },
									". I’m Maria, the product designer here.",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Hi Maria, nice to ",
									{ blank: "meet", id: "2" },
									" you. Yeah, today’s my first day.",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"Welcome! How are you ",
									{ blank: "feeling", id: "3" },
									" so far?",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Pretty good, just a little ",
									{ blank: "nervous", id: "4" },
									".",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"Don’t ",
									{ blank: "worry", id: "5" },
									". Everyone’s really friendly here.",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"That’s good to ",
									{ blank: "hear", id: "6" },
									". Thanks for helping me out.",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"Of course. Let me show you around the ",
									{ blank: "office", id: "7" },
									".",
								],
							},
							{
								speaker: "Tom",
								parts: ["Sounds ", { blank: "great", id: "8" }, ". Let’s go."],
							},
						],
					},
				],
			},
			// meeting-coworkers
			{
				id: "meet-coworkers",
				title: "Gặp đồng nghiệp mới",
				description:
					"Maria giới thiệu Tom với Anna, một đồng nghiệp trong nhóm.",
				scene: "/dialogue/office-introduction/meet-coworkers/bg.png",
				characters: {
					Maria: "/dialogue/office-introduction/shared/maria.png",
					Anna: "/dialogue/office-introduction/shared/anna.png",
					Tom: "/dialogue/office-introduction/shared/tom.png",
				},

				dialogue: [
					{
						speaker: "Maria",
						text: "Tom, let me introduce you to Anna. She’s a frontend developer on our team.",
						translation:
							"Tom, để tôi giới thiệu cậu với Anna. Cô ấy là lập trình viên frontend trong nhóm của chúng ta.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/maria-01.mp3",
					},
					{
						speaker: "Tom",
						text: "Hi Anna, nice to meet you. I’m Tom, the new graphic designer.",
						translation:
							"Chào Anna, rất vui được gặp bạn. Tôi là Tom, nhà thiết kế đồ họa mới.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-01.mp3",
					},
					{
						speaker: "Anna",
						text: "Nice to meet you too, Tom. Welcome to the team!",
						translation:
							"Tôi cũng rất vui được gặp bạn, Tom. Chào mừng bạn đến với nhóm!",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-01.mp3",
					},
					{
						speaker: "Tom",
						text: "Thanks! How long have you been working here?",
						translation: "Cảm ơn! Bạn đã làm việc ở đây bao lâu rồi?",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-02.mp3",
					},
					{
						speaker: "Anna",
						text: "About two years. What kind of projects do you usually work on?",
						translation: "Khoảng hai năm. Bạn thường làm những loại dự án nào?",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-02.mp3",
					},
					{
						speaker: "Tom",
						text: "Mostly website and app designs.",
						translation: "Chủ yếu là thiết kế website và ứng dụng.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-03.mp3",
					},
					{
						speaker: "Anna",
						text: "Nice. I work on the frontend, so we’ll probably work together a lot.",
						translation:
							"Hay đấy. Tôi làm frontend, nên có lẽ chúng ta sẽ làm việc cùng nhau khá nhiều.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-03.mp3",
					},
					{
						speaker: "Tom",
						text: "That sounds great. I’m looking forward to it.",
						translation: "Nghe tuyệt đấy. Tôi rất mong chờ điều đó.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-04.mp3",
					},
					{
						speaker: "Anna",
						text: "If you need any help, just let me know.",
						translation: "Nếu bạn cần giúp gì thì cứ nói với tôi nhé.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-04.mp3",
					},
					{
						speaker: "Tom",
						text: "I will. Thanks, Anna.",
						translation: "Tôi sẽ làm vậy. Cảm ơn Anna.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-05.mp3",
					},
					{
						speaker: "Maria",
						text: "Alright, let’s go meet the rest of the team.",
						translation:
							"Được rồi, chúng ta đi gặp những người còn lại trong nhóm nhé.",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/maria-02.mp3",
					},
					{
						speaker: "Tom",
						text: "Sounds good. Let’s go!",
						translation: "Được đấy. Đi thôi!",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-06.mp3",
					},
				],

				tasks: [
					// 1 — Fill Blank
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Maria và điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: ['Cấu trúc "let me + động từ" dùng khi đề nghị tự mình làm điều gì.'],
						},
						grammar: {
							title: "let me + động từ",
							explanation:
								'“Let me + động từ” dùng khi người nói đề nghị tự mình làm điều gì đó.',
							example: "Let me help you. = Để tôi giúp bạn.",
						},
						speaker: "Maria",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/maria-01.mp3",
						transcript:
							"Tom, let me introduce you to Anna. She’s a frontend developer on our team.",
						sentenceBefore: "Tom, let me",
						sentenceAfter: "you to Anna.",
						answer: "introduce",
					},

					// 2 — Fill Blank
					{
						id: "2",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Tom và hoàn thành câu.",
						tip: {
							title: "Mẹo",
							lines: ['"Nice to meet you" là lời chào tự nhiên khi gặp ai đó lần đầu.'],
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-01.mp3",
						transcript:
							"Hi Anna, nice to meet you. I’m Tom, the new graphic designer.",
						sentenceBefore: "Nice to",
						sentenceAfter: "you.",
						answer: "meet",
					},

					// 3 — Multiple Choice
					{
						id: "3",
						type: "multipleChoice",
						title: "Bạn nghe được gì?",
						question: "Tom làm công việc gì?",
						tip: {
							title: "Mẹo",
							lines: ['Cụm đứng sau "I’m Tom, the new..." cho biết nghề nghiệp của Tom.'],
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-01.mp3",
						transcript:
							"Hi Anna, nice to meet you. I’m Tom, the new graphic designer.",
						options: [
							"Graphic designer",
							"Frontend developer",
							"Product manager",
						],
						answer: "Graphic designer",
					},

					// 4 — Multiple Choice
					{
						id: "4",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Anna nói gì để chào đón Tom?",
						tip: {
							title: "Mẹo",
							lines: ['Tìm câu có từ "welcome", thường dùng để chào đón người mới.'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-01.mp3",
						transcript: "Nice to meet you too, Tom. Welcome to the team!",
						options: [
							"Welcome to the team!",
							"See you tomorrow!",
							"Have a nice weekend!",
						],
						answer: "Welcome to the team!",
					},

					// 5 — Fill Blank
					{
						id: "5",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu chào đón.",
						tip: {
							title: "Mẹo",
							lines: ['"Welcome to the..." thường đi với tên một nhóm, nơi hoặc tổ chức.'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-01.mp3",
						transcript: "Nice to meet you too, Tom. Welcome to the team!",
						sentenceBefore: "Welcome to the",
						sentenceAfter: "!",
						answer: "team",
					},

					// 6 — Arrange Words
					{
						id: "6",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành một câu hỏi đúng.",
						tip: {
							title: "Mẹo",
							lines: ['Câu hỏi về khoảng thời gian bắt đầu bằng "How long", sau đó là "have you been + V-ing".'],
						},
						grammar: {
							title: "How long have you been + V-ing?",
							explanation:
								"Cấu trúc này hỏi một hành động đã kéo dài bao lâu và vẫn còn tiếp diễn.",
							example: "How long have you been studying English? = Bạn đã học tiếng Anh bao lâu rồi?",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-02.mp3",
						transcript: "Thanks! How long have you been working here?",
						words: ["How", "long", "have", "you", "been", "working", "here"],
						answer: "How long have you been working here?",
					},

					// 7 — Multiple Choice
					{
						id: "7",
						type: "multipleChoice",
						title: "Hiểu hội thoại",
						question: "Tom đang hỏi Anna điều gì?",
						tip: {
							title: "Mẹo",
							lines: ['"How long" hỏi về khoảng thời gian một việc đã kéo dài.'],
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-02.mp3",
						transcript: "Thanks! How long have you been working here?",
						options: [
							"Cô ấy đã làm ở đây bao lâu",
							"Cô ấy sống ở đâu",
							"Cô ấy bao nhiêu tuổi",
						],
						answer: "Cô ấy đã làm ở đây bao lâu",
					},

					// 8 — Multiple Choice
					{
						id: "8",
						type: "multipleChoice",
						title: "Chọn câu trả lời đúng",
						question: "Anna đã làm ở công ty bao lâu?",
						tip: {
							title: "Mẹo",
							lines: ['Câu trả lời mở đầu bằng "About" cho biết một khoảng thời gian gần đúng.'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-02.mp3",
						transcript:
							"About two years. What kind of projects do you usually work on?",
						options: [
							"About two years",
							"About two months",
							"About five years",
						],
						answer: "About two years",
					},

					// 9 — Fill Blank
					{
						id: "9",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe và hoàn thành câu hỏi.",
						tip: {
							title: "Mẹo",
							lines: ['"What kind of..." dùng để hỏi về loại hoặc dạng của một sự vật.'],
						},
						grammar: {
							title: "What kind of + danh từ...?",
							explanation:
								'“What kind of” dùng để hỏi về loại hoặc dạng của một người hay sự vật.',
							example: "What kind of music do you like? = Bạn thích loại nhạc nào?",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-02.mp3",
						transcript:
							"About two years. What kind of projects do you usually work on?",
						sentenceBefore: "What kind of",
						sentenceAfter: "do you usually work on?",
						answer: "projects",
					},

					// 10 — Fill Blank
					{
						id: "10",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Tom thường làm loại công việc nào?",
						tip: {
							title: "Mẹo",
							lines: ['Sau "website and app" cần một danh từ số nhiều chỉ sản phẩm thiết kế.'],
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-03.mp3",
						transcript: "Mostly website and app designs.",
						sentenceBefore: "Mostly website and app",
						sentenceAfter: ".",
						answer: "designs",
					},

					// 11 — Multiple Choice
					{
						id: "11",
						type: "multipleChoice",
						title: "Hiểu ý nghĩa",
						question: "Tom thường làm việc với gì?",
						tip: {
							title: "Mẹo",
							lines: ['Từ "mostly" giới thiệu những thứ Tom làm phần lớn thời gian.'],
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-03.mp3",
						transcript: "Mostly website and app designs.",
						options: [
							"Website và app",
							"Video và âm nhạc",
							"Tài chính và kế toán",
						],
						answer: "Website và app",
					},

					// 12 — Multiple Choice
					{
						id: "12",
						type: "multipleChoice",
						title: "Hiểu hội thoại",
						question: "Anna làm việc ở mảng nào?",
						tip: {
							title: "Mẹo",
							lines: ['Anna nói trực tiếp lĩnh vực của mình sau cụm "I work on the...".'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-03.mp3",
						transcript:
							"Nice. I work on the frontend, so we’ll probably work together a lot.",
						options: ["Frontend", "Graphic design", "Marketing"],
						answer: "Frontend",
					},

					// 13 — Fill Blank
					{
						id: "13",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu của Anna.",
						tip: {
							title: "Mẹo",
							lines: ['"Work together" nghĩa là cùng nhau làm việc hoặc hợp tác.'],
						},
						grammar: {
							title: "will probably + động từ",
							explanation:
								'“will probably” diễn tả một việc có khả năng cao sẽ xảy ra trong tương lai.',
							example: "We’ll probably finish today. = Có lẽ hôm nay chúng ta sẽ hoàn thành.",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-03.mp3",
						transcript:
							"Nice. I work on the frontend, so we’ll probably work together a lot.",
						sentenceBefore: "We’ll probably work",
						sentenceAfter: "a lot.",
						answer: "together",
					},

					// 14 — Arrange Words
					{
						id: "14",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Tạo lại câu Tom vừa nói.",
						tip: {
							title: "Mẹo",
							lines: ['Cụm cố định là "look forward to + danh từ/đại từ", nghĩa là mong chờ điều gì.'],
						},
						grammar: {
							title: "look forward to + danh từ/V-ing",
							explanation:
								'“look forward to” dùng để nói rằng bạn đang mong chờ một điều sắp tới.',
							example: "I look forward to meeting you. = Tôi mong được gặp bạn.",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-04.mp3",
						transcript: "That sounds great. I’m looking forward to it.",
						words: ["I'm", "looking", "forward", "to", "it"],
						answer: "I'm looking forward to it.",
					},

					// 15 — Fill Blank
					{
						id: "15",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành cụm từ hữu ích này.",
						tip: {
							title: "Mẹo",
							lines: ['Trong "look forward to", từ ở giữa mang nghĩa hướng về phía trước.'],
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-04.mp3",
						transcript: "That sounds great. I’m looking forward to it.",
						sentenceBefore: "I’m looking",
						sentenceAfter: "to it.",
						answer: "forward",
					},

					// 16 — Fill Blank
					{
						id: "16",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe lại và điền từ.",
						tip: {
							title: "Mẹo",
							lines: ['"That sounds + tính từ" dùng để phản hồi một ý tưởng hoặc kế hoạch.'],
						},
						grammar: {
							title: "That sounds + tính từ",
							explanation:
								"Cấu trúc này dùng để đưa ra phản ứng về điều bạn vừa nghe.",
							example: "That sounds interesting. = Nghe có vẻ thú vị đấy.",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-04.mp3",
						transcript: "That sounds great. I’m looking forward to it.",
						sentenceBefore: "That sounds",
						sentenceAfter: ".",
						answer: "great",
					},

					// 17 — Multiple Choice
					{
						id: "17",
						type: "multipleChoice",
						title: "Hiểu cụm từ",
						question: `“I'm looking forward to it.” gần nghĩa nhất với câu nào?`,
						tip: {
							title: "Mẹo",
							lines: ['"Look forward to" diễn tả cảm giác vui và mong đợi điều sắp xảy ra.'],
						},
						options: [
							"Tôi rất mong chờ điều đó.",
							"Tôi không thích điều đó.",
							"Tôi đã quên điều đó.",
						],
						answer: "Tôi rất mong chờ điều đó.",
					},

					// 18 — Multiple Choice
					{
						id: "18",
						type: "multipleChoice",
						title: "Chọn phản hồi tự nhiên",
						question: `Một đồng nghiệp nói: “We'll probably work together a lot.” Bạn có thể trả lời thế nào?`,
						tip: {
							title: "Mẹo",
							lines: ['Chọn câu phản hồi tích cực và phù hợp với một kế hoạch hợp tác.'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-03.mp3",
						transcript:
							"Nice. I work on the frontend, so we’ll probably work together a lot.",
						options: [
							"That sounds great.",
							"I don't know where it is.",
							"I worked yesterday.",
						],
						answer: "That sounds great.",
					},

					// 19 — Fill Blank
					{
						id: "19",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Anna đề nghị giúp Tom. Điền từ còn thiếu.",
						tip: {
							title: "Mẹo",
							lines: ['"Need any..." thường đi với danh từ chỉ sự giúp đỡ hoặc hỗ trợ.'],
						},
						grammar: {
							title: "If + hiện tại, mệnh lệnh",
							explanation:
								"Cấu trúc này nêu một điều kiện rồi đưa ra lời đề nghị hoặc chỉ dẫn.",
							example: "If you need me, call me. = Nếu bạn cần tôi, hãy gọi cho tôi.",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-04.mp3",
						transcript: "If you need any help, just let me know.",
						sentenceBefore: "If you need any",
						sentenceAfter: ", just let me know.",
						answer: "help",
					},

					// 20 — Fill Blank
					{
						id: "20",
						type: "fillBlank",
						title: "Điền cụm từ",
						question: "Hoàn thành cách nói tự nhiên của Anna.",
						tip: {
							title: "Mẹo",
							lines: ['"Let me know" là cách tự nhiên để nói "hãy cho tôi biết".'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-04.mp3",
						transcript: "If you need any help, just let me know.",
						sentenceBefore: "Just let me",
						sentenceAfter: ".",
						answer: "know",
					},

					// 21 — Multiple Choice
					{
						id: "21",
						type: "multipleChoice",
						title: "Hiểu ý nghĩa",
						question: `Anna nói “Just let me know.” Ý của cô ấy là gì?`,
						tip: {
							title: "Mẹo",
							lines: ['Trong ngữ cảnh này, Anna đang mời Tom chủ động nói khi cần hỗ trợ.'],
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-04.mp3",
						transcript: "If you need any help, just let me know.",
						options: [
							"Hãy nói với tôi nếu bạn cần gì.",
							"Hãy rời khỏi văn phòng.",
							"Hãy gọi cho quản lý.",
						],
						answer: "Hãy nói với tôi nếu bạn cần gì.",
					},

					// 22 — Arrange Words
					{
						id: "22",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành câu hoàn chỉnh.",
						tip: {
							title: "Mẹo",
							lines: ['Mệnh đề điều kiện bắt đầu bằng "If", sau đó là lời đề nghị "just let me know".'],
						},
						grammar: {
							title: "If + hiện tại, mệnh lệnh",
							explanation:
								"Có thể dùng hiện tại đơn sau “if” và một câu mệnh lệnh để đưa ra lời đề nghị.",
							example: "If you have questions, ask me. = Nếu bạn có câu hỏi, hãy hỏi tôi.",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/anna-04.mp3",
						transcript: "If you need any help, just let me know.",
						words: [
							"If",
							"you",
							"need",
							"any",
							"help",
							"just",
							"let",
							"me",
							"know",
						],
						answer: "If you need any help, just let me know.",
					},

					// 23 — Multiple Choice
					{
						id: "23",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Maria muốn làm gì tiếp theo?",
						tip: {
							title: "Mẹo",
							lines: ['"The rest of the team" nghĩa là những thành viên còn lại trong nhóm.'],
						},
						speaker: "Maria",
						character: {
							name: "Maria",
							image: "/dialogue/office-introduction/shared/maria.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/maria-02.mp3",
						transcript: "Alright, let’s go meet the rest of the team.",
						options: [
							"Đi gặp những thành viên còn lại",
							"Đi ăn trưa",
							"Đi về nhà",
						],
						answer: "Đi gặp những thành viên còn lại",
					},

					// 24 — Fill Blank
					{
						id: "24",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu cuối của Tom.",
						tip: {
							title: "Mẹo",
							lines: ['"Sounds good" là câu phản hồi ngắn gọn để đồng ý với một kế hoạch.'],
						},
						grammar: {
							title: "Sounds + tính từ",
							explanation:
								'“Sounds + tính từ” là cách nói ngắn của “That sounds + tính từ”.',
							example: "Sounds perfect. = Nghe hoàn hảo đấy.",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						scene: "/dialogue/office-introduction/shared/bg.png",
						audioUrl:
							"/dialogue/office-introduction/meet-coworkers/audio/tom-06.mp3",
						transcript: "Sounds good. Let’s go!",
						sentenceBefore: "Sounds",
						sentenceAfter: ". Let’s go!",
						answer: "good",
					},

					{
						id: "25",
						type: "dialogueCloze",
						title: "Ôn tập hội thoại",
						instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",

						lines: [
							{
								speaker: "Maria",
								parts: [
									"Tom, let me ",
									{ blank: "introduce", id: "1" },
									" you to Anna. She’s a frontend developer on our team.",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Hi Anna, nice to ",
									{ blank: "meet", id: "2" },
									" you. I’m Tom, the new graphic designer.",
								],
							},
							{
								speaker: "Anna",
								parts: [
									"Nice to meet you too, Tom. ",
									{ blank: "Welcome", id: "3" },
									" to the team!",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Thanks! How long have you been ",
									{ blank: "working", id: "4" },
									" here?",
								],
							},
							{
								speaker: "Anna",
								parts: [
									"About two years. What kind of ",
									{ blank: "projects", id: "5" },
									" do you usually work on?",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Mostly website and app ",
									{ blank: "designs", id: "6" },
									".",
								],
							},
							{
								speaker: "Anna",
								parts: [
									"Nice. I work on the ",
									{ blank: "frontend", id: "7" },
									", so we’ll probably work together a lot.",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"That sounds great. I’m looking ",
									{ blank: "forward", id: "8" },
									" to it.",
								],
							},
							{
								speaker: "Anna",
								parts: [
									"If you need any ",
									{ blank: "help", id: "9" },
									", just let me know.",
								],
							},
							{
								speaker: "Tom",
								parts: ["I will. ", { blank: "Thanks", id: "10" }, ", Anna."],
							},
							{
								speaker: "Maria",
								parts: [
									"Alright, let’s go meet the ",
									{ blank: "rest", id: "11" },
									" of the team.",
								],
							},
							{
								speaker: "Tom",
								parts: ["Sounds ", { blank: "good", id: "12" }, ". Let’s go!"],
							},
						],
					},
				],
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
