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
