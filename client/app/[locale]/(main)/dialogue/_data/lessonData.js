const officeCharacterImages = {
	Maria: "/dialogue/office-introduction/shared/maria.png",
	Tom: "/dialogue/office-introduction/shared/tom.png",
};

function lunchBreakTaskMedia(speaker, appearance) {
	return {
		speaker,
		character: {
			name: speaker,
			image: officeCharacterImages[speaker],
		},
		audioUrl: `/dialogue/office-introduction/lunch-break/audio/${speaker.toLowerCase()}-${String(appearance).padStart(2, "0")}.mp3`,
	};
}

function orderDialogueTasks(tasks, orderedTaskIds) {
	return orderedTaskIds.map((taskId, index) => ({
		...tasks.find((task) => task.id === taskId),
		id: String(index + 1),
	}));
}

const weekendCampingCharacterImages = {
	Leo: "/dialogue/weekend-camping/shared/leo.png",
	Mia: "/dialogue/weekend-camping/shared/mia.png",
};

function settingUpTentTaskMedia(speaker, appearance) {
	return {
		speaker,
		scene: "/dialogue/weekend-camping/setting-up-the-tent/bg.png",
		character: {
			name: speaker,
			image: weekendCampingCharacterImages[speaker],
		},
		audioUrl: `/dialogue/weekend-camping/setting-up-the-tent/audio/${speaker.toLowerCase()}-${String(appearance).padStart(2, "0")}.mp3`,
	};
}
const startingCampfireTaskMedia = (speaker, audioIndex) => ({
	scene: "/dialogue/weekend-camping/starting-a-campfire/bg.png",
	character: {
		name: speaker,
		image: weekendCampingCharacterImages[speaker],
	},
	audioUrl: `/dialogue/weekend-camping/starting-a-campfire/audio/${speaker.toLowerCase()}-${String(
		audioIndex,
	).padStart(2, "0")}.mp3`,
});

export const lessonData = {
	"office-introduction": {
		id: "office-introduction",
		heroImage: "/dialogue/office-introduction/shared/bg.png",
		title: "Ngày đầu tiên tại văn phòng",
		description:
			"Maria gặp Tom trong ngày đầu đi làm. Học cách giới thiệu bản thân và giao tiếp trong văn phòng.",
		level: "beginner",
		duration: "25 phút",
		dialogues: [
			// meeting-tom
			{
				id: "meeting-tom",
				thumbnail: "/dialogue/office-introduction/thumbnails/meeting-tem.png",
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
				usefulWords: [
					{
						word: "product designer",
						pronunciation: "/ˈprɒdʌkt dɪˈzaɪnə(r)/",
						translation: "nhà thiết kế sản phẩm",
						example: "I’m Maria, the product designer here.",
					},
					{
						word: "first day",
						pronunciation: "/fɜːrst deɪ/",
						translation: "ngày đầu tiên",
						example: "Today’s my first day.",
					},
					{
						word: "so far",
						pronunciation: "/səʊ fɑːr/",
						translation: "cho đến lúc này",
						example: "How are you feeling so far?",
					},
					{
						word: "nervous",
						pronunciation: "/ˈnɜːrvəs/",
						translation: "lo lắng, hồi hộp",
						example: "Pretty good, just a little nervous.",
					},
					{
						word: "Don’t worry",
						translation: "Đừng lo",
						example: "Don’t worry. Everyone’s really friendly here.",
					},
					{
						word: "That’s good to hear",
						translation: "Nghe vậy thật tốt",
						example: "That’s good to hear.",
					},
					{
						word: "helping me out",
						translation: "giúp đỡ tôi",
						example: "Thanks for helping me out.",
					},
					{
						word: "show you around",
						translation: "dẫn bạn đi tham quan",
						example: "Let me show you around the office.",
					},
				],
				tasks: [
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Maria và điền từ còn thiếu.",
						grammar: {
							title: "must be",
							explanation:
								"“must be” dùng để đưa ra một phỏng đoán mà người nói khá chắc chắn.",
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
						grammar: {
							title: "Nice to meet you",
							explanation:
								"Cụm này dùng khi bạn gặp một người lần đầu và muốn nói rằng bạn rất vui được làm quen.",
							example: "Nice to meet you, Anna. = Rất vui được gặp bạn, Anna.",
						},
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
						grammar: {
							title: "How are you feeling?",
							explanation:
								"Câu hỏi này dùng để hỏi cảm xúc hoặc trạng thái của một người ở hiện tại.",
							example:
								"How are you feeling today? = Hôm nay bạn cảm thấy thế nào?",
						},
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
						grammar: {
							title: "Thanks for + V-ing",
							explanation:
								"Dùng “Thanks for” với động từ thêm -ing để cảm ơn ai đó vì một hành động.",
							example: "Thanks for waiting. = Cảm ơn bạn đã chờ.",
						},
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
				thumbnail:
					"/dialogue/office-introduction/thumbnails/meet-coworkers.png",
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

				usefulWords: [
					{
						word: "introduce",
						pronunciation: "/ˌɪntrəˈduːs/",
						translation: "giới thiệu",
						example: "Let me introduce you to Anna.",
					},
					{
						word: "frontend developer",
						translation: "lập trình viên frontend",
						example: "She’s a frontend developer on our team.",
					},
					{
						word: "Welcome to the team",
						translation: "Chào mừng bạn đến với nhóm",
						example: "Welcome to the team!",
					},
					{
						word: "How long",
						pronunciation: "/haʊ lɔːŋ/",
						translation: "bao lâu",
						example: "How long have you been working here?",
					},
					{
						word: "work on",
						translation: "làm, thực hiện",
						example: "What kind of projects do you usually work on?",
					},
					{
						word: "work together",
						translation: "làm việc cùng nhau",
						example: "We’ll probably work together a lot.",
					},
					{
						word: "looking forward to",
						pronunciation: "/lʊk ˈfɔːrwərd tuː/",
						translation: "mong chờ",
						example: "I’m looking forward to it.",
					},
					{
						word: "let me know",
						translation: "hãy cho tôi biết",
						example: "If you need any help, just let me know.",
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
							lines: [
								'Cấu trúc "let me + động từ" dùng khi đề nghị tự mình làm điều gì.',
							],
						},
						grammar: {
							title: "let me + động từ",
							explanation:
								"“Let me + động từ” dùng khi người nói đề nghị tự mình làm điều gì đó.",
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
							lines: [
								'"Nice to meet you" là lời chào tự nhiên khi gặp ai đó lần đầu.',
							],
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
							lines: [
								'Cụm đứng sau "I’m Tom, the new..." cho biết nghề nghiệp của Tom.',
							],
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
							lines: [
								'Tìm câu có từ "welcome", thường dùng để chào đón người mới.',
							],
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
							lines: [
								'"Welcome to the..." thường đi với tên một nhóm, nơi hoặc tổ chức.',
							],
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
							lines: [
								'Câu hỏi về khoảng thời gian bắt đầu bằng "How long", sau đó là "have you been + V-ing".',
							],
						},
						grammar: {
							title: "How long have you been + V-ing?",
							explanation:
								"Cấu trúc này hỏi một hành động đã kéo dài bao lâu và vẫn còn tiếp diễn.",
							example:
								"How long have you been studying English? = Bạn đã học tiếng Anh bao lâu rồi?",
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
							lines: [
								'"How long" hỏi về khoảng thời gian một việc đã kéo dài.',
							],
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
							lines: [
								'Câu trả lời mở đầu bằng "About" cho biết một khoảng thời gian gần đúng.',
							],
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
							lines: [
								'"What kind of..." dùng để hỏi về loại hoặc dạng của một sự vật.',
							],
						},
						grammar: {
							title: "What kind of + danh từ...?",
							explanation:
								"“What kind of” dùng để hỏi về loại hoặc dạng của một người hay sự vật.",
							example:
								"What kind of music do you like? = Bạn thích loại nhạc nào?",
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
							lines: [
								'Sau "website and app" cần một danh từ số nhiều chỉ sản phẩm thiết kế.',
							],
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
							lines: [
								'Từ "mostly" giới thiệu những thứ Tom làm phần lớn thời gian.',
							],
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
							lines: [
								'Anna nói trực tiếp lĩnh vực của mình sau cụm "I work on the...".',
							],
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
							lines: [
								'"Work together" nghĩa là cùng nhau làm việc hoặc hợp tác.',
							],
						},
						grammar: {
							title: "will probably + động từ",
							explanation:
								"“will probably” diễn tả một việc có khả năng cao sẽ xảy ra trong tương lai.",
							example:
								"We’ll probably finish today. = Có lẽ hôm nay chúng ta sẽ hoàn thành.",
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
							lines: [
								'Cụm cố định là "look forward to + danh từ/đại từ", nghĩa là mong chờ điều gì.',
							],
						},
						grammar: {
							title: "look forward to + danh từ/V-ing",
							explanation:
								"“look forward to” dùng để nói rằng bạn đang mong chờ một điều sắp tới.",
							example:
								"I look forward to meeting you. = Tôi mong được gặp bạn.",
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
							lines: [
								'Trong "look forward to", từ ở giữa mang nghĩa hướng về phía trước.',
							],
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
							lines: [
								'"That sounds + tính từ" dùng để phản hồi một ý tưởng hoặc kế hoạch.',
							],
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
							lines: [
								'"Look forward to" diễn tả cảm giác vui và mong đợi điều sắp xảy ra.',
							],
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
							lines: [
								"Chọn câu phản hồi tích cực và phù hợp với một kế hoạch hợp tác.",
							],
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
							lines: [
								'"Need any..." thường đi với danh từ chỉ sự giúp đỡ hoặc hỗ trợ.',
							],
						},
						grammar: {
							title: "If + hiện tại, mệnh lệnh",
							explanation:
								"Cấu trúc này nêu một điều kiện rồi đưa ra lời đề nghị hoặc chỉ dẫn.",
							example:
								"If you need me, call me. = Nếu bạn cần tôi, hãy gọi cho tôi.",
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
							lines: [
								'"Let me know" là cách tự nhiên để nói "hãy cho tôi biết".',
							],
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
							lines: [
								"Trong ngữ cảnh này, Anna đang mời Tom chủ động nói khi cần hỗ trợ.",
							],
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
							lines: [
								'Mệnh đề điều kiện bắt đầu bằng "If", sau đó là lời đề nghị "just let me know".',
							],
						},
						grammar: {
							title: "If + hiện tại, mệnh lệnh",
							explanation:
								"Có thể dùng hiện tại đơn sau “if” và một câu mệnh lệnh để đưa ra lời đề nghị.",
							example:
								"If you have questions, ask me. = Nếu bạn có câu hỏi, hãy hỏi tôi.",
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
							lines: [
								'"The rest of the team" nghĩa là những thành viên còn lại trong nhóm.',
							],
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
							lines: [
								'"Sounds good" là câu phản hồi ngắn gọn để đồng ý với một kế hoạch.',
							],
						},
						grammar: {
							title: "Sounds + tính từ",
							explanation:
								"“Sounds + tính từ” là cách nói ngắn của “That sounds + tính từ”.",
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
			// talk-about-work
			{
				id: "talk-about-work",
				thumbnail:
					"/dialogue/office-introduction/thumbnails/talk-about-work.png",
				title: "Hỏi về công việc",
				description: "Anna và Tom nói về công việc và nhiệm vụ.",
				scene: "/dialogue/office-introduction/talk-about-work/bg.png",
				characters: {
					Tom: "/dialogue/office-introduction/shared/tom.png",
					Anna: "/dialogue/office-introduction/shared/anna.png",
				},
				dialogue: [
					{
						speaker: "Tom",
						text: "Hey Anna, what are you working on?",
						translation: "Này Anna, bạn đang làm gì vậy?",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-01.mp3",
					},
					{
						speaker: "Anna",
						text: "I’m making a new website.",
						translation: "Mình đang làm một trang web mới.",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-01.mp3",
					},
					{
						speaker: "Tom",
						text: "Oh, nice! Is it for a client?",
						translation: "Ồ, hay đấy! Nó dành cho khách hàng à?",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-02.mp3",
					},
					{
						speaker: "Anna",
						text: "Yes, it is.",
						translation: "Đúng vậy.",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-02.mp3",
					},
					{
						speaker: "Tom",
						text: "Are you working alone?",
						translation: "Bạn đang làm một mình à?",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-03.mp3",
					},
					{
						speaker: "Anna",
						text: "No. I’m working with Maria and two developers.",
						translation:
							"Không. Mình đang làm cùng Maria và hai lập trình viên.",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-03.mp3",
					},
					{
						speaker: "Tom",
						text: "What are you doing for the project?",
						translation: "Bạn đang làm phần gì cho dự án?",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-04.mp3",
					},
					{
						speaker: "Anna",
						text: "I’m planning the work and talking to the client.",
						translation:
							"Mình đang lên kế hoạch công việc và nói chuyện với khách hàng.",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-04.mp3",
					},
					{
						speaker: "Tom",
						text: "Do you need help?",
						translation: "Bạn có cần giúp không?",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-05.mp3",
					},
					{
						speaker: "Anna",
						text: "Yes. Can you look at the homepage?",
						translation: "Có. Bạn có thể xem giúp trang chủ không?",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-05.mp3",
					},
					{
						speaker: "Tom",
						text: "Sure. I can help.",
						translation: "Được chứ. Mình có thể giúp.",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-06.mp3",
					},
					{
						speaker: "Anna",
						text: "Thanks, Tom!",
						translation: "Cảm ơn, Tom!",
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-06.mp3",
					},
				],
				usefulWords: [
					{
						word: "working on",
						translation: "làm, thực hiện",
						example: "Hey Anna, what are you working on?",
					},
					{
						word: "client",
						pronunciation: "/ˈklaɪənt/",
						translation: "khách hàng",
						example: "Is it for a client?",
					},
					{
						word: "working alone",
						translation: "làm việc một mình",
						example: "Are you working alone?",
					},
					{
						word: "working with",
						translation: "làm việc cùng",
						example: "I’m working with Maria and two developers.",
					},
					{
						word: "project",
						pronunciation: "/ˈprɒdʒekt/",
						translation: "dự án",
						example: "What are you doing for the project?",
					},
					{
						word: "planning the work",
						translation: "lên kế hoạch công việc",
						example: "I’m planning the work and talking to the client.",
					},
					{
						word: "talking to",
						translation: "nói chuyện với",
						example: "I’m planning the work and talking to the client.",
					},
					{
						word: "look at",
						translation: "xem, nhìn vào",
						example: "Can you look at the homepage?",
					},
				],
				tasks: [
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Tom và hoàn thành câu hỏi.",
						grammar: {
							title: "What are you + V-ing?",
							explanation:
								"Cấu trúc này dùng để hỏi một người đang làm gì ở thời điểm hiện tại.",
							example: "What are you reading? = Bạn đang đọc gì vậy?",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-01.mp3",
						transcript: "Hey Anna, what are you working on?",
						sentenceBefore: "Hey Anna, what are you",
						sentenceAfter: "on?",
						answer: "working",
					},
					{
						id: "2",
						type: "multipleChoice",
						title: "Hiểu hội thoại",
						question: "Tom đang hỏi Anna điều gì?",
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-01.mp3",
						transcript: "Hey Anna, what are you working on?",
						options: [
							"Anna đang làm gì",
							"Anna đang ở đâu",
							"Anna đi làm lúc mấy giờ",
						],
						answer: "Anna đang làm gì",
					},
					{
						id: "3",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành câu hỏi đúng.",
						grammar: {
							title: "work on + danh từ",
							explanation:
								"“Work on” dùng khi nói bạn đang dành thời gian làm một nhiệm vụ hoặc dự án.",
							example:
								"I’m working on a report. = Tôi đang làm một bản báo cáo.",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-01.mp3",
						transcript: "What are you working on?",
						words: ["working", "What", "on", "you", "are"],
						answer: "What are you working on?",
					},
					{
						id: "4",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Anna đang làm sản phẩm gì?",
						grammar: {
							title: "be + V-ing",
							explanation:
								"Thì hiện tại tiếp diễn diễn tả một việc đang xảy ra hoặc đang được thực hiện.",
							example: "She’s making an app. = Cô ấy đang làm một ứng dụng.",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-01.mp3",
						transcript: "I’m making a new website.",
						sentenceBefore: "I’m making a new",
						sentenceAfter: ".",
						answer: "website",
					},
					{
						id: "5",
						type: "multipleChoice",
						title: "Bạn nghe được gì?",
						question: "Anna đang làm gì?",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-01.mp3",
						transcript: "I’m making a new website.",
						options: ["Một trang web mới", "Một logo mới", "Một video mới"],
						answer: "Một trang web mới",
					},
					{
						id: "6",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Tom và điền từ còn thiếu.",
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-02.mp3",
						transcript: "Oh, nice! Is it for a client?",
						sentenceBefore: "Oh, nice! Is it for a",
						sentenceAfter: "?",
						answer: "client",
					},
					{
						id: "7",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Tom muốn biết trang web dành cho ai?",
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-02.mp3",
						transcript: "Oh, nice! Is it for a client?",
						options: ["Một khách hàng", "Anna", "Công ty của Tom"],
						answer: "Một khách hàng",
					},
					{
						id: "8",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu trả lời ngắn của Anna.",
						grammar: {
							title: "Yes, it is.",
							explanation:
								"Với câu hỏi bắt đầu bằng “Is it...?”, ta có thể trả lời ngắn bằng “Yes, it is.”",
							example: "Is it ready? Yes, it is. = Nó xong chưa? Xong rồi.",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-02.mp3",
						transcript: "Yes, it is.",
						sentenceBefore: "Yes, it",
						sentenceAfter: ".",
						answer: "is",
					},
					{
						id: "9",
						type: "multipleChoice",
						title: "Hiểu ý nghĩa",
						question: "Câu “Yes, it is.” của Anna có nghĩa là gì?",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-02.mp3",
						transcript: "Yes, it is.",
						options: ["Đúng vậy", "Chưa xong", "Anna không biết"],
						answer: "Đúng vậy",
					},
					{
						id: "10",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành câu hỏi đúng.",
						grammar: {
							title: "Are you + V-ing?",
							explanation:
								"Cấu trúc này dùng để hỏi một người có đang làm một việc hay không.",
							example: "Are you waiting for me? = Bạn đang đợi tôi phải không?",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-03.mp3",
						transcript: "Are you working alone?",
						words: ["alone", "you", "working", "Are"],
						answer: "Are you working alone?",
					},
					{
						id: "11",
						type: "multipleChoice",
						title: "Hiểu hội thoại",
						question: "Tom đang hỏi Anna điều gì?",
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-03.mp3",
						transcript: "Are you working alone?",
						options: [
							"Anna có đang làm việc một mình không",
							"Anna có muốn nghỉ không",
							"Anna có làm việc ở nhà không",
						],
						answer: "Anna có đang làm việc một mình không",
					},
					{
						id: "12",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Anna đang làm việc cùng những ai?",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-03.mp3",
						transcript: "No. I’m working with Maria and two developers.",
						sentenceBefore: "No. I’m working with Maria and two",
						sentenceAfter: ".",
						answer: "developers",
					},
					{
						id: "13",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Ai đang cùng Anna làm dự án?",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-03.mp3",
						transcript: "No. I’m working with Maria and two developers.",
						options: [
							"Maria và hai lập trình viên",
							"Tom và một quản lý",
							"Chỉ có Anna",
						],
						answer: "Maria và hai lập trình viên",
					},
					{
						id: "14",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu hỏi của Tom.",
						grammar: {
							title: "What are you doing for...?",
							explanation:
								"Cấu trúc này dùng để hỏi một người đang đảm nhận phần việc gì cho một mục tiêu cụ thể.",
							example:
								"What are you doing for the event? = Bạn đang làm phần gì cho sự kiện?",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-04.mp3",
						transcript: "What are you doing for the project?",
						sentenceBefore: "What are you doing for the",
						sentenceAfter: "?",
						answer: "project",
					},
					{
						id: "15",
						type: "multipleChoice",
						title: "Hiểu câu hỏi",
						question: "Tom muốn biết điều gì?",
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-04.mp3",
						transcript: "What are you doing for the project?",
						options: [
							"Phần việc Anna đang làm cho dự án",
							"Thời hạn của dự án",
							"Giá của dự án",
						],
						answer: "Phần việc Anna đang làm cho dự án",
					},
					{
						id: "16",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Anna và điền từ còn thiếu.",
						grammar: {
							title: "be + V-ing and V-ing",
							explanation:
								"Khi hai hành động đang diễn ra song song, ta có thể nối hai động từ dạng V-ing bằng “and”.",
							example:
								"I’m reading and taking notes. = Tôi đang đọc và ghi chú.",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-04.mp3",
						transcript: "I’m planning the work and talking to the client.",
						sentenceBefore: "I’m",
						sentenceAfter: "the work and talking to the client.",
						answer: "planning",
					},
					{
						id: "17",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành nhiệm vụ thứ hai của Anna.",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-04.mp3",
						transcript: "I’m planning the work and talking to the client.",
						sentenceBefore: "I’m planning the work and talking to the",
						sentenceAfter: ".",
						answer: "client",
					},
					{
						id: "18",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Anna đang làm hai việc gì?",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-04.mp3",
						transcript: "I’m planning the work and talking to the client.",
						options: [
							"Lên kế hoạch và nói chuyện với khách hàng",
							"Viết mã và thiết kế logo",
							"Gọi điện và đặt lịch họp",
						],
						answer: "Lên kế hoạch và nói chuyện với khách hàng",
					},
					{
						id: "19",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành lời đề nghị của Tom.",
						grammar: {
							title: "Do you need + danh từ?",
							explanation:
								"Cấu trúc này dùng để hỏi lịch sự xem một người có cần điều gì không.",
							example: "Do you need a break? = Bạn có cần nghỉ một chút không?",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-05.mp3",
						transcript: "Do you need help?",
						sentenceBefore: "Do you need",
						sentenceAfter: "?",
						answer: "help",
					},
					{
						id: "20",
						type: "multipleChoice",
						title: "Hiểu ý nghĩa",
						question: "Tom đang làm gì khi hỏi “Do you need help?”",
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-05.mp3",
						transcript: "Do you need help?",
						options: [
							"Đề nghị giúp Anna",
							"Yêu cầu Anna rời đi",
							"Hỏi Anna về giờ nghỉ",
						],
						answer: "Đề nghị giúp Anna",
					},
					{
						id: "21",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành lời nhờ giúp đỡ đúng.",
						grammar: {
							title: "Can you + động từ?",
							explanation:
								"“Can you + động từ?” là cách thông dụng để nhờ một người làm điều gì.",
							example:
								"Can you check this file? = Bạn có thể kiểm tra tệp này không?",
						},
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-05.mp3",
						transcript: "Can you look at the homepage?",
						words: ["homepage", "you", "the", "Can", "at", "look"],
						answer: "Can you look at the homepage?",
					},
					{
						id: "22",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Anna muốn Tom xem phần nào?",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-05.mp3",
						transcript: "Yes. Can you look at the homepage?",
						sentenceBefore: "Yes. Can you look at the",
						sentenceAfter: "?",
						answer: "homepage",
					},
					{
						id: "23",
						type: "multipleChoice",
						title: "Chọn phản hồi đúng",
						question: "Tom phản hồi lời nhờ của Anna như thế nào?",
						grammar: {
							title: "can + động từ",
							explanation:
								"“Can + động từ” có thể dùng để nói rằng một người có khả năng hoặc sẵn sàng làm việc gì.",
							example: "I can check it. = Tôi có thể kiểm tra nó.",
						},
						speaker: "Tom",
						character: {
							name: "Tom",
							image: "/dialogue/office-introduction/shared/tom.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/tom-06.mp3",
						transcript: "Sure. I can help.",
						options: [
							"Đồng ý giúp Anna",
							"Từ chối giúp Anna",
							"Hỏi thêm về khách hàng",
						],
						answer: "Đồng ý giúp Anna",
					},
					{
						id: "24",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu cảm ơn của Anna.",
						speaker: "Anna",
						character: {
							name: "Anna",
							image: "/dialogue/office-introduction/shared/anna.png",
						},
						audioUrl:
							"/dialogue/office-introduction/talk-about-work/audio/anna-06.mp3",
						transcript: "Thanks, Tom!",
						sentenceBefore: "",
						sentenceAfter: ", Tom!",
						answer: "Thanks",
					},
					{
						id: "25",
						type: "dialogueCloze",
						title: "Ôn tập hội thoại",
						instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",
						lines: [
							{
								speaker: "Tom",
								parts: [
									"Hey Anna, what are you ",
									{ blank: "working", id: "1" },
									" on?",
								],
							},
							{
								speaker: "Anna",
								parts: [
									"I’m making a new ",
									{ blank: "website", id: "2" },
									".",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Oh, nice! Is it for a ",
									{ blank: "client", id: "3" },
									"?",
								],
							},
							{
								speaker: "Anna",
								parts: ["Yes, it ", { blank: "is", id: "4" }, "."],
							},
							{
								speaker: "Tom",
								parts: ["Are you working ", { blank: "alone", id: "5" }, "?"],
							},
							{
								speaker: "Anna",
								parts: [
									"No. I’m working with Maria and two ",
									{ blank: "developers", id: "6" },
									".",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"What are you doing for the ",
									{ blank: "project", id: "7" },
									"?",
								],
							},
							{
								speaker: "Anna",
								parts: [
									"I’m ",
									{ blank: "planning", id: "8" },
									" the work and talking to the client.",
								],
							},
							{
								speaker: "Tom",
								parts: ["Do you ", { blank: "need", id: "9" }, " help?"],
							},
							{
								speaker: "Anna",
								parts: [
									"Yes. Can you look at the ",
									{ blank: "homepage", id: "10" },
									"?",
								],
							},
							{
								speaker: "Tom",
								parts: [{ blank: "Sure", id: "11" }, ". I can help."],
							},
							{
								speaker: "Anna",
								parts: [{ blank: "Thanks", id: "12" }, ", Tom!"],
							},
						],
					},
				],
			},
			// lunch break
			{
				id: "lunch-break",
				thumbnail: "/dialogue/office-introduction/thumbnails/lunch-break.png",
				title: "Giờ nghỉ trưa",
				description: "Maria và Tom cùng ăn trưa và trò chuyện.",
				scene: "/dialogue/office-introduction/lunch-break/bg.png",
				characters: officeCharacterImages,
				dialogue: [
					{
						speaker: "Maria",
						text: "Hey Tom, are you hungry?",
						translation: "Này Tom, bạn có đói không?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/maria-01.mp3",
					},
					{
						speaker: "Tom",
						text: "Yes, I am. Do you want to get lunch?",
						translation: "Có. Bạn có muốn đi ăn trưa không?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/tom-01.mp3",
					},
					{
						speaker: "Maria",
						text: "Sure. What do you usually eat for lunch?",
						translation: "Được chứ. Bạn thường ăn gì vào bữa trưa?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/maria-02.mp3",
					},
					{
						speaker: "Tom",
						text: "I usually bring food from home.",
						translation: "Tôi thường mang đồ ăn từ nhà.",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/tom-02.mp3",
					},
					{
						speaker: "Maria",
						text: "That looks really good. What are you having today?",
						translation: "Món đó trông ngon thật. Hôm nay bạn ăn gì?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/maria-03.mp3",
					},
					{
						speaker: "Tom",
						text: "Chicken and rice. What about you?",
						translation: "Gà và cơm. Còn bạn thì sao?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/tom-03.mp3",
					},
					{
						speaker: "Maria",
						text: "I have a sandwich. Do you eat here every day?",
						translation:
							"Tôi có một chiếc bánh mì kẹp. Bạn ăn ở đây mỗi ngày à?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/maria-04.mp3",
					},
					{
						speaker: "Tom",
						text: "Not every day. Sometimes I go out with coworkers.",
						translation:
							"Không phải mỗi ngày. Đôi khi tôi ra ngoài ăn với đồng nghiệp.",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/tom-04.mp3",
					},
					{
						speaker: "Maria",
						text: "How long is the lunch break?",
						translation: "Giờ nghỉ trưa kéo dài bao lâu?",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/maria-05.mp3",
					},
					{
						speaker: "Tom",
						text: "We have about an hour.",
						translation: "Chúng ta có khoảng một tiếng.",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/tom-05.mp3",
					},
					{
						speaker: "Maria",
						text: "That’s nice. Let’s grab coffee after lunch.",
						translation: "Tuyệt đấy. Chúng ta đi uống cà phê sau bữa trưa nhé.",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/maria-06.mp3",
					},
					{
						speaker: "Tom",
						text: "Great idea!",
						translation: "Ý hay đấy!",
						audioUrl:
							"/dialogue/office-introduction/lunch-break/audio/tom-06.mp3",
					},
				],
				usefulWords: [
					{
						word: "hungry",
						pronunciation: "/ˈhʌŋɡri/",
						translation: "đói",
						example: "Hey Tom, are you hungry?",
					},
					{
						word: "get lunch",
						translation: "đi ăn trưa",
						example: "Do you want to get lunch?",
					},
					{
						word: "usually",
						pronunciation: "/ˈjuːʒuəli/",
						translation: "thường, thường xuyên",
						example: "What do you usually eat for lunch?",
					},
					{
						word: "bring food from home",
						translation: "mang đồ ăn từ nhà",
						example: "I usually bring food from home.",
					},
					{
						word: "sandwich",
						pronunciation: "/ˈsænwɪtʃ/",
						translation: "bánh mì kẹp",
						example: "I have a sandwich.",
					},
					{
						word: "go out with coworkers",
						translation: "ra ngoài cùng đồng nghiệp",
						example: "Sometimes I go out with coworkers.",
					},
					{
						word: "lunch break",
						translation: "giờ nghỉ trưa",
						example: "How long is the lunch break?",
					},
					{
						word: "grab coffee",
						translation: "đi uống cà phê",
						example: "Let’s grab coffee after lunch.",
					},
				],
				tasks: [
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Maria và hoàn thành câu hỏi.",
						...lunchBreakTaskMedia("Maria", 1),
						transcript: "Hey Tom, are you hungry?",
						sentenceBefore: "Hey Tom, are you",
						sentenceAfter: "?",
						answer: "hungry",
					},
					{
						id: "2",
						type: "multipleChoice",
						title: "Hiểu hội thoại",
						question: "Maria đang hỏi Tom điều gì?",
						...lunchBreakTaskMedia("Maria", 1),
						transcript: "Hey Tom, are you hungry?",
						options: [
							"Tom có đói không",
							"Tom có bận không",
							"Tom có mệt không",
						],
						answer: "Tom có đói không",
					},
					{
						id: "3",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành câu hỏi đúng.",
						...lunchBreakTaskMedia("Maria", 1),
						transcript: "Are you hungry?",
						words: ["hungry", "Are", "you"],
						answer: "Are you hungry?",
					},
					{
						id: "4",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu trả lời của Tom.",
						...lunchBreakTaskMedia("Tom", 1),
						transcript: "Yes, I am. Do you want to get lunch?",
						sentenceBefore: "Yes, I",
						sentenceAfter: ". Do you want to get lunch?",
						answer: "am",
					},
					{
						id: "5",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Tom rủ Maria làm gì?",
						grammar: {
							title: "Do you want to + động từ?",
							explanation:
								"Dùng cấu trúc này để hỏi ai đó có muốn cùng làm một việc hay không.",
							example: "Do you want to sit here? = Bạn có muốn ngồi đây không?",
						},
						...lunchBreakTaskMedia("Tom", 1),
						transcript: "Yes, I am. Do you want to get lunch?",
						options: ["Đi ăn trưa", "Uống cà phê", "Về nhà"],
						answer: "Đi ăn trưa",
					},
					{
						id: "6",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành lời rủ đúng.",
						...lunchBreakTaskMedia("Tom", 1),
						transcript: "Do you want to get lunch?",
						words: ["lunch", "you", "get", "Do", "to", "want"],
						answer: "Do you want to get lunch?",
					},
					{
						id: "7",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Maria hỏi về thói quen ăn trưa của Tom.",
						grammar: {
							title: "What do you usually + động từ?",
							explanation: "Dùng câu hỏi này để hỏi một người thường làm gì.",
							example: "What do you usually drink? = Bạn thường uống gì?",
						},
						...lunchBreakTaskMedia("Maria", 2),
						transcript: "Sure. What do you usually eat for lunch?",
						sentenceBefore: "Sure. What do you",
						sentenceAfter: "eat for lunch?",
						answer: "usually",
					},
					{
						id: "8",
						type: "multipleChoice",
						title: "Hiểu câu hỏi",
						question: "Maria muốn biết điều gì?",
						...lunchBreakTaskMedia("Maria", 2),
						transcript: "Sure. What do you usually eat for lunch?",
						options: [
							"Tom thường ăn gì vào bữa trưa",
							"Tom ăn sáng lúc mấy giờ",
							"Tom mua đồ ăn ở đâu",
						],
						answer: "Tom thường ăn gì vào bữa trưa",
					},
					{
						id: "9",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Tom thường mang gì từ nhà?",
						...lunchBreakTaskMedia("Tom", 2),
						transcript: "I usually bring food from home.",
						sentenceBefore: "I usually bring",
						sentenceAfter: "from home.",
						answer: "food",
					},
					{
						id: "10",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Tom thường chuẩn bị bữa trưa như thế nào?",
						...lunchBreakTaskMedia("Tom", 2),
						transcript: "I usually bring food from home.",
						options: [
							"Mang đồ ăn từ nhà",
							"Mua đồ ăn ở công ty",
							"Không ăn trưa",
						],
						answer: "Mang đồ ăn từ nhà",
					},
					{
						id: "11",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Maria nhận xét món ăn của Tom.",
						...lunchBreakTaskMedia("Maria", 3),
						transcript: "That looks really good. What are you having today?",
						sentenceBefore: "That looks really",
						sentenceAfter: ". What are you having today?",
						answer: "good",
					},
					{
						id: "12",
						type: "multipleChoice",
						title: "Bạn nghe được gì?",
						question: "Hôm nay Tom ăn gì?",
						...lunchBreakTaskMedia("Tom", 3),
						transcript: "Chicken and rice. What about you?",
						options: ["Gà và cơm", "Salad và súp", "Bánh mì kẹp"],
						answer: "Gà và cơm",
					},
					{
						id: "13",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu Tom hỏi lại Maria.",
						...lunchBreakTaskMedia("Tom", 3),
						transcript: "Chicken and rice. What about you?",
						sentenceBefore: "Chicken and rice. What",
						sentenceAfter: "you?",
						answer: "about",
					},
					{
						id: "14",
						type: "multipleChoice",
						title: "Hiểu hội thoại",
						question: "Maria mang món gì?",
						...lunchBreakTaskMedia("Maria", 4),
						transcript: "I have a sandwich. Do you eat here every day?",
						options: ["Một chiếc bánh mì kẹp", "Gà và cơm", "Một bát súp"],
						answer: "Một chiếc bánh mì kẹp",
					},
					{
						id: "15",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Maria hỏi về thói quen ăn trưa ở công ty.",
						...lunchBreakTaskMedia("Maria", 4),
						transcript: "I have a sandwich. Do you eat here every day?",
						sentenceBefore: "I have a sandwich. Do you eat here every",
						sentenceAfter: "?",
						answer: "day",
					},
					{
						id: "16",
						type: "multipleChoice",
						title: "Chọn ý đúng",
						question: "Tom có ăn ở công ty mỗi ngày không?",
						...lunchBreakTaskMedia("Tom", 4),
						transcript: "Not every day. Sometimes I go out with coworkers.",
						options: [
							"Không, đôi khi anh ấy ra ngoài với đồng nghiệp",
							"Có, anh ấy luôn ăn ở công ty",
							"Không, anh ấy không bao giờ ăn trưa",
						],
						answer: "Không, đôi khi anh ấy ra ngoài với đồng nghiệp",
					},
					{
						id: "17",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Nghe Tom và điền từ chỉ tần suất.",
						...lunchBreakTaskMedia("Tom", 4),
						transcript: "Not every day. Sometimes I go out with coworkers.",
						sentenceBefore: "Not every day.",
						sentenceAfter: "I go out with coworkers.",
						answer: "Sometimes",
					},
					{
						id: "18",
						type: "arrangeWords",
						title: "Sắp xếp câu",
						question: "Sắp xếp thành câu hỏi về khoảng thời gian.",
						grammar: {
							title: "How long is...?",
							explanation:
								"Dùng “How long is...?” để hỏi một việc hoặc khoảng thời gian kéo dài bao lâu.",
							example: "How long is the meeting? = Cuộc họp kéo dài bao lâu?",
						},
						...lunchBreakTaskMedia("Maria", 5),
						transcript: "How long is the lunch break?",
						words: ["break", "How", "the", "is", "lunch", "long"],
						answer: "How long is the lunch break?",
					},
					{
						id: "19",
						type: "multipleChoice",
						title: "Hiểu câu trả lời",
						question: "Giờ nghỉ trưa kéo dài khoảng bao lâu?",
						...lunchBreakTaskMedia("Tom", 5),
						transcript: "We have about an hour.",
						options: ["Khoảng một tiếng", "Khoảng 30 phút", "Khoảng hai tiếng"],
						answer: "Khoảng một tiếng",
					},
					{
						id: "20",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành câu trả lời của Tom.",
						...lunchBreakTaskMedia("Tom", 5),
						transcript: "We have about an hour.",
						sentenceBefore: "We have about an",
						sentenceAfter: ".",
						answer: "hour",
					},
					{
						id: "21",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Maria đề nghị làm gì sau bữa trưa?",
						...lunchBreakTaskMedia("Maria", 6),
						transcript: "That’s nice. Let’s grab coffee after lunch.",
						sentenceBefore: "That’s nice. Let’s grab",
						sentenceAfter: "after lunch.",
						answer: "coffee",
					},
					{
						id: "22",
						type: "multipleChoice",
						title: "Hiểu lời đề nghị",
						question: "Câu “Let’s grab coffee” dùng để làm gì?",
						grammar: {
							title: "Let’s + động từ",
							explanation:
								"Dùng “Let’s + động từ” để đề nghị cùng nhau làm một việc.",
							example: "Let’s take a break. = Chúng ta nghỉ một chút nhé.",
						},
						...lunchBreakTaskMedia("Maria", 6),
						transcript: "That’s nice. Let’s grab coffee after lunch.",
						options: [
							"Rủ ai đó cùng uống cà phê",
							"Hỏi giá một cốc cà phê",
							"Từ chối uống cà phê",
						],
						answer: "Rủ ai đó cùng uống cà phê",
					},
					{
						id: "23",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						question: "Hoàn thành phản hồi của Tom.",
						...lunchBreakTaskMedia("Tom", 6),
						transcript: "Great idea!",
						sentenceBefore: "Great",
						sentenceAfter: "!",
						answer: "idea",
					},
					{
						id: "24",
						type: "multipleChoice",
						title: "Chọn phản hồi đúng",
						question: "Tom cảm thấy thế nào về lời đề nghị của Maria?",
						...lunchBreakTaskMedia("Tom", 6),
						transcript: "Great idea!",
						options: [
							"Anh ấy đồng ý và thích ý tưởng đó",
							"Anh ấy không muốn đi",
							"Anh ấy chưa hiểu câu hỏi",
						],
						answer: "Anh ấy đồng ý và thích ý tưởng đó",
					},
					{
						id: "25",
						type: "dialogueCloze",
						title: "Ôn tập hội thoại",
						instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",
						lines: [
							{
								speaker: "Maria",
								parts: ["Hey Tom, are you ", { blank: "hungry", id: "1" }, "?"],
							},
							{
								speaker: "Tom",
								parts: [
									"Yes, I am. Do you want to get ",
									{ blank: "lunch", id: "2" },
									"?",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"Sure. What do you ",
									{ blank: "usually", id: "3" },
									" eat for lunch?",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"I usually bring food from ",
									{ blank: "home", id: "4" },
									".",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"That looks really good. What are you ",
									{ blank: "having", id: "5" },
									" today?",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Chicken and rice. What ",
									{ blank: "about", id: "6" },
									" you?",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"I have a sandwich. Do you eat here every ",
									{ blank: "day", id: "7" },
									"?",
								],
							},
							{
								speaker: "Tom",
								parts: [
									"Not every day. ",
									{ blank: "Sometimes", id: "8" },
									" I go out with coworkers.",
								],
							},
							{
								speaker: "Maria",
								parts: [
									"How long is the lunch ",
									{ blank: "break", id: "9" },
									"?",
								],
							},
							{
								speaker: "Tom",
								parts: ["We have about an ", { blank: "hour", id: "10" }, "."],
							},
							{
								speaker: "Maria",
								parts: [
									"That’s nice. Let’s grab ",
									{ blank: "coffee", id: "11" },
									" after lunch.",
								],
							},
							{
								speaker: "Tom",
								parts: ["Great ", { blank: "idea", id: "12" }, "!"],
							},
						],
					},
				],
			},
		],
	},
	"weekend-camping": {
		id: "weekend-camping",
		heroImage: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
		title: "Cuối tuần cắm trại",
		image: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
		description:
			"Theo chân Leo và Mia trong chuyến cắm trại cuối tuần và học tiếng Anh qua những tình huống thực tế.",
		level: "beginner",
		duration: "30 phút",
		dialogues: [
			// arriving at the campsite
			{
				id: "arriving-at-the-campsite",
				thumbnail: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
				title: "Đến khu cắm trại",
				description:
					"Leo và Mia đến khu cắm trại và tìm một nơi phù hợp để dựng lều.",
				scene: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
				characters: {
					Leo: "/dialogue/weekend-camping/shared/leo.png",
					Mia: "/dialogue/weekend-camping/shared/mia.png",
				},
				dialogue: [
					{
						speaker: "Leo",
						text: "We’re here! This place looks nice.",
						translation: "Chúng ta đến rồi! Nơi này trông đẹp đấy.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-01.mp3",
					},
					{
						speaker: "Leo",
						text: "Where should we put the tent?",
						translation: "Chúng ta nên dựng lều ở đâu?",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-02.mp3",
					},
					{
						speaker: "Mia",
						text: "Yeah, it’s really quiet here.",
						translation: "Ừ, ở đây thật sự rất yên tĩnh.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-01.mp3",
					},
					{
						speaker: "Mia",
						text: "Maybe near those trees.",
						translation: "Có lẽ gần những cái cây kia.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-02.mp3",
					},
					{
						speaker: "Mia",
						text: "Is the ground flat enough?",
						translation: "Mặt đất có đủ bằng phẳng không?",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-03.mp3",
					},
					{
						speaker: "Leo",
						text: "That looks like a good spot.",
						translation: "Chỗ đó có vẻ ổn đấy.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-03.mp3",
					},
					{
						speaker: "Leo",
						text: "I think so. Let me check.",
						translation: "Mình nghĩ là có. Để mình kiểm tra.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-04.mp3",
					},
					{
						speaker: "Leo",
						text: "Great. I’ll get the tent.",
						translation: "Tuyệt. Mình sẽ lấy lều.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-05.mp3",
					},
					{
						speaker: "Mia",
						text: "Okay. I’ll bring our bags over.",
						translation: "Được rồi. Mình sẽ mang túi của chúng ta qua đó.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-04.mp3",
					},
					{
						speaker: "Mia",
						text: "Do we need anything else?",
						translation: "Chúng ta có cần gì khác không?",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-05.mp3",
					},
					{
						speaker: "Leo",
						text: "Not yet. Let’s set up the tent first.",
						translation: "Chưa đâu. Hãy dựng lều trước đã.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-06.mp3",
					},
					{
						speaker: "Mia",
						text: "Sounds good. Let’s do it.",
						translation: "Nghe ổn đấy. Làm thôi.",
						audioUrl:
							"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-06.mp3",
					},
				],
				usefulWords: [
					{
						word: "campsite",
						pronunciation: "/ˈkæmpsaɪt/",
						translation: "khu cắm trại",
						example: "We’re finally at the campsite.",
					},
					{
						word: "quiet",
						pronunciation: "/ˈkwaɪət/",
						translation: "yên tĩnh",
						example: "It’s really quiet here.",
					},
					{
						word: "tent",
						pronunciation: "/tent/",
						translation: "cái lều",
						example: "Where should we put the tent?",
					},
					{
						word: "near",
						pronunciation: "/nɪr/",
						translation: "gần",
						example: "Maybe near those trees.",
					},
					{
						word: "spot",
						pronunciation: "/spɒt/",
						translation: "chỗ, vị trí",
						example: "That looks like a good spot.",
					},
					{
						word: "ground",
						pronunciation: "/ɡraʊnd/",
						translation: "mặt đất",
						example: "Is the ground flat enough?",
					},
					{
						word: "flat",
						pronunciation: "/flæt/",
						translation: "bằng phẳng",
						example: "The ground is flat enough.",
					},
					{
						word: "set up",
						pronunciation: "/set ʌp/",
						translation: "dựng, thiết lập",
						example: "Let’s set up the tent first.",
					},
				],

				tasks: orderDialogueTasks(
					[
						// Task 1
						{
							id: "1",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và điền từ còn thiếu.",
							grammar: {
								title: "We’re here!",
								explanation:
									"“We’re here!” thường được dùng khi bạn vừa đến một địa điểm.",
								example: "We’re here! = Chúng ta đến rồi!",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-01.mp3",
							transcript: "We’re here! This place looks nice.",
							sentenceBefore: "We’re ",
							sentenceAfter: "! This place looks nice.",
							answer: "here",
						},

						// Task 2
						{
							id: "2",
							type: "multipleChoice",
							title: "Hiểu tình huống",
							instruction: "Nghe Mia và chọn đáp án đúng.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-01.mp3",
							transcript: "Yeah, it’s really quiet here.",

							question: "Từ “here” trong câu của Mia đang nói đến đâu?",

							options: [
								"Trong chiếc lều",
								"Khu cắm trại",
								"Trong xe",
								"Nhà của Mia",
							],

							answer: "Khu cắm trại",
						},

						// Task 3
						{
							id: "3",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và điền từ còn thiếu.",
							grammar: {
								title: "should we...?",
								explanation:
									"“Should we...?” được dùng để hỏi ý kiến hoặc đề xuất làm điều gì đó.",
								example: "Where should we go? = Chúng ta nên đi đâu?",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-02.mp3",
							transcript: "Where should we put the tent?",
							sentenceBefore: "Where should we put the ",
							sentenceAfter: "?",
							answer: "tent",
						},

						// Task 4
						{
							id: "4",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và hoàn thành gợi ý về vị trí.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-02.mp3",
							transcript: "Maybe near those trees.",
							parts: ["Maybe ", " those ", "."],
							answers: ["near", "trees"],
						},

						// Task 5
						{
							id: "5",
							type: "multipleChoice",
							title: "Hiểu tình huống",
							instruction: "Nghe Leo và chọn đáp án đúng.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-03.mp3",
							transcript: "That looks like a good spot.",

							question: "“That” trong câu của Leo đang nói đến chỗ nào?",

							options: [
								"Chiếc xe của họ",
								"Lối vào khu cắm trại",
								"Khu vực gần những cái cây",
								"Nơi để túi của họ",
							],

							answer: "Khu vực gần những cái cây",
						},

						// Task 6
						{
							id: "6",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và hoàn thành nhận xét về khu cắm trại.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-01.mp3",
							transcript: "Yeah, it’s really quiet here.",
							parts: ["Yeah, it’s really ", " ", "."],
							answers: ["quiet", "here"],
						},

						// Task 7
						{
							id: "7",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và điền từ còn thiếu.",
							grammar: {
								title: "Let me + verb",
								explanation:
									"“Let me + động từ” dùng khi bạn muốn tự mình làm một việc.",
								example: "Let me check. = Để mình kiểm tra.",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-04.mp3",
							transcript: "I think so. Let me check.",
							sentenceBefore: "I think so. Let me ",
							sentenceAfter: ".",
							answer: "check",
						},

						// Task 8
						{
							id: "8",
							type: "multipleChoice",
							title: "Hiểu tình huống",
							instruction: "Nghe Mia và chọn ý nghĩa phù hợp với tình huống.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-04.mp3",
							transcript: "Okay. I’ll bring our bags over.",

							question:
								"Từ “over” trong câu “I’ll bring our bags over” đang chỉ điều gì?",

							options: [
								"Mang túi đến chỗ họ vừa chọn",
								"Mang túi về nhà",
								"Đặt túi lên trên lều",
								"Mang túi sang cho người khác",
							],

							answer: "Mang túi đến chỗ họ vừa chọn",
						},

						// Task 9
						{
							id: "9",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và điền từ còn thiếu.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-05.mp3",
							transcript: "Great. I’ll get the tent.",
							sentenceBefore: "Great. I’ll get the ",
							sentenceAfter: ".",
							answer: "tent",
						},

						// Task 10
						{
							id: "10",
							type: "multipleChoice",
							title: "Hiểu tình huống",
							instruction: "Nghe Mia và chọn đáp án đúng.",
							grammar: {
								title: "anything else",
								explanation:
									"“anything else” được dùng khi hỏi xem có cần thêm thứ gì nữa không.",
								example:
									"Do you need anything else? = Bạn có cần gì khác nữa không?",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-05.mp3",
							transcript: "Do we need anything else?",

							question: "Tại sao Mia hỏi “Do we need anything else?”",

							options: [
								"Vì cô ấy muốn biết họ có cần lấy thêm đồ trước khi dựng lều không",
								"Vì cô ấy muốn đổi chỗ cắm trại",
								"Vì cô ấy muốn đi về nhà",
								"Vì cô ấy không biết chiếc lều ở đâu",
							],

							answer:
								"Vì cô ấy muốn biết họ có cần lấy thêm đồ trước khi dựng lều không",
						},

						// Task 11
						{
							id: "11",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và điền cụm từ còn thiếu.",
							grammar: {
								title: "Let’s + verb",
								explanation:
									"“Let’s + động từ” dùng để đề nghị cùng nhau làm một việc.",
								example: "Let’s go. = Đi thôi.",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-06.mp3",
							transcript: "Not yet. Let’s set up the tent first.",
							sentenceBefore: "Not yet. Let’s set up the tent ",
							sentenceAfter: ".",
							answer: "first",
						},

						// Task 12
						{
							id: "12",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và hoàn thành câu.",
							grammar: {
								title: "Sounds good",
								explanation:
									"“Sounds good” là cách nói tự nhiên để đồng ý với một đề xuất.",
								example: "Sounds good! = Nghe ổn đấy!",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-06.mp3",
							transcript: "Sounds good. Let’s do it.",
							sentenceBefore: "Sounds good. Let’s ",
							sentenceAfter: " it.",
							answer: "do",
						},

						// Task 13
						{
							id: "13",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và hoàn thành mẫu câu hỏi ý kiến.",
							grammar: {
								title: "Where should we + verb?",
								explanation:
									"Dùng mẫu câu này để hỏi ý kiến về nơi nên thực hiện một việc.",
								example: "Where should we sit? = Chúng ta nên ngồi ở đâu?",
							},
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-02.mp3",
							transcript: "Where should we put the tent?",
							parts: ["Where ", " we put the ", "?"],
							answers: ["should", "tent"],
						},

						// Task 14
						{
							id: "14",
							type: "multipleChoice",
							title: "Hiểu tình huống",
							instruction: "Nghe Leo và chọn mục đích của câu hỏi.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-02.mp3",
							transcript: "Where should we put the tent?",
							question: "Tại sao Leo hỏi câu này?",
							options: [
								"Họ đang quyết định nơi dựng lều",
								"Họ đang tìm đường về nhà",
								"Họ đang kiểm tra hành lý",
								"Họ đang hỏi giờ khởi hành",
							],
							answer: "Họ đang quyết định nơi dựng lều",
						},

						// Task 15
						{
							id: "15",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và điền từ chỉ vị trí.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-02.mp3",
							transcript: "Maybe near those trees.",
							sentenceBefore: "Maybe ",
							sentenceAfter: " those trees.",
							answer: "near",
						},

						// Task 16
						{
							id: "16",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và hoàn thành cụm từ chỉ địa điểm.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-03.mp3",
							transcript: "That looks like a good spot.",
							sentenceBefore: "That looks like a good ",
							sentenceAfter: ".",
							answer: "spot",
						},

						// Task 17
						{
							id: "17",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và điền tính từ còn thiếu.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-03.mp3",
							transcript: "Is the ground flat enough?",
							parts: ["Is the ", " ", " enough?"],
							answers: ["ground", "flat"],
						},

						// Task 18
						{
							id: "18",
							type: "multipleChoice",
							title: "Hiểu tình huống",
							instruction: "Nghe Mia và chọn lý do phù hợp nhất.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-03.mp3",
							transcript: "Is the ground flat enough?",
							question: "Tại sao Mia kiểm tra mặt đất?",
							options: [
								"Để xem chỗ đó có phù hợp để dựng lều không",
								"Để tìm chiếc túi bị mất",
								"Để xem trời có sắp mưa không",
								"Để tìm đường ra khỏi khu cắm trại",
							],
							answer: "Để xem chỗ đó có phù hợp để dựng lều không",
						},

						// Task 19
						{
							id: "19",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và điền vật cô ấy sẽ mang tới.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-04.mp3",
							transcript: "Okay. I’ll bring our bags over.",
							parts: ["Okay. I’ll ", " our ", " over."],
							answers: ["bring", "bags"],
						},

						// Task 20
						{
							id: "20",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Mia và hoàn thành cụm từ thường dùng.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Mia",
								image: "/dialogue/weekend-camping/shared/mia.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/mia-05.mp3",
							transcript: "Do we need anything else?",
							sentenceBefore: "Do we need anything ",
							sentenceAfter: "?",
							answer: "else",
						},

						// Task 21
						{
							id: "21",
							type: "fillBlank",
							title: "Điền từ còn thiếu",
							instruction: "Nghe Leo và hoàn thành lời đề nghị.",
							scene:
								"/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
							character: {
								name: "Leo",
								image: "/dialogue/weekend-camping/shared/leo.png",
							},
							audioUrl:
								"/dialogue/weekend-camping/arriving-at-the-campsite/audio/leo-06.mp3",
							transcript: "Not yet. Let’s set up the tent first.",
							parts: ["Not yet. ", " ", " ", " the tent first."],
							answers: ["Let’s", "set", "up"],
							choices: ["set", "first", "Let’s", "up"],
						},
					],
					[
						"1",
						"13",
						"14",
						"6",
						"2",
						"4",
						"17",
						"18",
						"16",
						"5",
						"7",
						"9",
						"19",
						"8",
						"20",
						"21",
						"11",
						"12",
					],
				),
			},
			// setting-up-the-tent
			{
				id: "setting-up-the-tent",
				thumbnail:
					"/dialogue/weekend-camping/thumbnails/setting-up-the-tent.png",
				title: "Dựng lều",
				description:
					"Leo và Mia cùng nhau dựng lều sau khi đã chọn được chỗ cắm trại.",
				scene: "/dialogue/weekend-camping/setting-up-the-tent/bg.png",
				characters: weekendCampingCharacterImages,
				dialogue: [
					{
						speaker: "Leo",
						text: "Okay, let’s set up the tent.",
						translation: "Được rồi, hãy dựng lều thôi.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/leo-01.mp3",
					},
					{
						speaker: "Leo",
						text: "Can you help me with this pole?",
						translation: "Bạn có thể giúp mình với cây cọc này không?",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/leo-02.mp3",
					},
					{
						speaker: "Mia",
						text: "Sure. Where should I hold it?",
						translation: "Được chứ. Mình nên giữ nó ở đâu?",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/mia-01.mp3",
					},
					{
						speaker: "Mia",
						text: "Like this?",
						translation: "Như thế này à?",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/mia-02.mp3",
					},
					{
						speaker: "Leo",
						text: "Yes, perfect. Hold it there for a second.",
						translation: "Ừ, hoàn hảo. Giữ nó ở đó một lát nhé.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/leo-03.mp3",
					},
					{
						speaker: "Leo",
						text: "Now I’ll put this side up.",
						translation: "Giờ mình sẽ dựng phía này lên.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/leo-04.mp3",
					},
					{
						speaker: "Mia",
						text: "Do we need the other pole too?",
						translation: "Chúng ta có cần cây cọc còn lại không?",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/mia-03.mp3",
					},
					{
						speaker: "Mia",
						text: "I can get it.",
						translation: "Mình có thể lấy nó.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/mia-04.mp3",
					},
					{
						speaker: "Leo",
						text: "Thanks. It goes on the other side.",
						translation: "Cảm ơn. Nó nằm ở phía bên kia.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/leo-05.mp3",
					},
					{
						speaker: "Leo",
						text: "I think we’re almost done.",
						translation: "Mình nghĩ chúng ta gần xong rồi.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/leo-06.mp3",
					},
					{
						speaker: "Mia",
						text: "Nice! The tent looks good.",
						translation: "Tuyệt! Cái lều trông ổn đấy.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/mia-05.mp3",
					},
					{
						speaker: "Mia",
						text: "Let’s put our bags inside.",
						translation: "Hãy để túi của chúng ta vào trong.",
						audioUrl:
							"/dialogue/weekend-camping/setting-up-the-tent/audio/mia-06.mp3",
					},
				],
				usefulWords: [
					{
						word: "set up",
						pronunciation: "/set ʌp/",
						translation: "dựng, thiết lập",
						example: "Okay, let’s set up the tent.",
					},
					{
						word: "tent",
						pronunciation: "/tent/",
						translation: "cái lều",
						example: "Okay, let’s set up the tent.",
					},
					{
						word: "pole",
						pronunciation: "/poʊl/",
						translation: "cây cọc, cây sào",
						example: "Can you help me with this pole?",
					},
					{
						word: "hold",
						pronunciation: "/hoʊld/",
						translation: "giữ",
						example: "Where should I hold it?",
					},
					{
						word: "for a second",
						pronunciation: "/fɔːr ə ˈsekənd/",
						translation: "một lát",
						example: "Hold it there for a second.",
					},
					{
						word: "put ... up",
						pronunciation: "/pʊt ... ʌp/",
						translation: "dựng ... lên",
						example: "Now I’ll put this side up.",
					},
					{
						word: "the other side",
						pronunciation: "/ði ˈʌðər saɪd/",
						translation: "phía bên kia",
						example: "It goes on the other side.",
					},
					{
						word: "almost done",
						pronunciation: "/ˈɔːlmoʊst dʌn/",
						translation: "gần xong",
						example: "I think we’re almost done.",
					},
					{
						word: "inside",
						pronunciation: "/ˌɪnˈsaɪd/",
						translation: "vào bên trong",
						example: "Let’s put our bags inside.",
					},
				],
				tasks: [
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành lời đề nghị.",
						grammar: {
							title: "Let’s + verb",
							explanation:
								"Dùng “Let’s + động từ” để đề nghị cùng nhau làm một việc.",
							example: "Let’s start. = Chúng ta bắt đầu nhé.",
						},
						...settingUpTentTaskMedia("Leo", 1),
						transcript: "Okay, let’s set up the tent.",
						parts: ["Okay, ", " set ", " the ", "."],
						answers: ["let’s", "up", "tent"],
						choices: ["tent", "let’s", "pole", "up"],
					},
					{
						id: "2",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành lời nhờ giúp đỡ.",
						grammar: {
							title: "Can you + verb...?",
							explanation:
								"Dùng “Can you + động từ...?” để nhờ ai đó làm một việc.",
							example: "Can you wait? = Bạn có thể đợi không?",
						},
						...settingUpTentTaskMedia("Leo", 2),
						transcript: "Can you help me with this pole?",
						parts: ["Can you ", " me with this ", "?"],
						answers: ["help", "pole"],
					},
					{
						id: "3",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và điền từ còn thiếu.",
						...settingUpTentTaskMedia("Leo", 2),
						transcript: "Can you help me with this pole?",
						sentenceBefore: "Can ",
						sentenceAfter: " help me with this pole?",
						answer: "you",
					},
					{
						id: "4",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Leo và chọn điều anh ấy đang nhờ Mia làm.",
						...settingUpTentTaskMedia("Leo", 2),
						transcript: "Can you help me with this pole?",
						question: "Leo đang nhờ Mia làm gì?",
						options: [
							"Mang túi vào trong lều",
							"Tìm một chỗ cắm trại khác",
							"Giúp anh ấy với cây cọc",
							"Kiểm tra thời tiết",
						],
						answer: "Giúp anh ấy với cây cọc",
					},
					{
						id: "5",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu hỏi.",
						grammar: {
							title: "Where should I + verb...?",
							explanation:
								"Dùng mẫu câu này để hỏi mình nên làm một việc ở đâu.",
							example: "Where should I sit? = Mình nên ngồi ở đâu?",
						},
						...settingUpTentTaskMedia("Mia", 1),
						transcript: "Sure. Where should I hold it?",
						parts: ["Sure. Where ", " I ", " it?"],
						answers: ["should", "hold"],
					},
					{
						id: "6",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Mia và xác định vật được nhắc đến.",
						...settingUpTentTaskMedia("Mia", 1),
						transcript: "Sure. Where should I hold it?",
						question: "Từ “it” trong câu của Mia chỉ vật nào?",
						options: [
							"Chiếc túi",
							"Cây cọc Leo vừa đưa",
							"Mặt đất",
							"Cái lều đã dựng xong",
						],
						answer: "Cây cọc Leo vừa đưa",
					},
					{
						id: "7",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Mia và chọn ý phù hợp nhất.",
						...settingUpTentTaskMedia("Mia", 2),
						transcript: "Like this?",
						question: "Mia muốn kiểm tra điều gì khi hỏi “Like this?”",
						options: [
							"Liệu họ có cần mang thêm túi không",
							"Liệu khu cắm trại có yên tĩnh không",
							"Liệu họ đã dựng xong lều chưa",
							"Liệu cô ấy đang giữ cây cọc đúng cách không",
						],
						answer: "Liệu cô ấy đang giữ cây cọc đúng cách không",
					},
					{
						id: "8",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành lời hướng dẫn.",
						...settingUpTentTaskMedia("Leo", 3),
						transcript: "Yes, perfect. Hold it there for a second.",
						parts: ["Yes, ", ". Hold it ", " for a ", "."],
						answers: ["perfect", "there", "second"],
						choices: ["there", "second", "perfect", "minute"],
					},
					{
						id: "9",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Leo và xác định vị trí được nhắc đến.",
						...settingUpTentTaskMedia("Leo", 3),
						transcript: "Yes, perfect. Hold it there for a second.",
						question: "Từ “there” chỉ vị trí nào?",
						options: [
							"Bên trong chiếc túi",
							"Vị trí Leo vừa hướng dẫn Mia giữ cây cọc",
							"Khu vực gần xe",
							"Phía ngoài khu cắm trại",
						],
						answer: "Vị trí Leo vừa hướng dẫn Mia giữ cây cọc",
					},
					{
						id: "10",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành hành động tiếp theo.",
						...settingUpTentTaskMedia("Leo", 4),
						transcript: "Now I’ll put this side up.",
						parts: ["Now ", " put this ", " ", "."],
						answers: ["I’ll", "side", "up"],
						choices: ["side", "up", "I’ll", "down"],
					},
					{
						id: "11",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu hỏi.",
						grammar: {
							title: "Do we need...?",
							explanation:
								"Dùng “Do we need...?” để hỏi xem một thứ có cần thiết hay không.",
							example:
								"Do we need more water? = Chúng ta có cần thêm nước không?",
						},
						...settingUpTentTaskMedia("Mia", 3),
						transcript: "Do we need the other pole too?",
						parts: ["Do we ", " the ", " pole too?"],
						answers: ["need", "other"],
					},
					{
						id: "12",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Mia và chọn điều cô ấy muốn biết.",
						...settingUpTentTaskMedia("Mia", 3),
						transcript: "Do we need the other pole too?",
						question: "Mia đang hỏi Leo điều gì?",
						options: [
							"Chiếc lều có đẹp không",
							"Họ nên đặt túi ở đâu",
							"Họ có cần cây cọc còn lại không",
							"Họ có nên rời khu cắm trại không",
						],
						answer: "Họ có cần cây cọc còn lại không",
					},
					{
						id: "13",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành lời đề nghị giúp đỡ.",
						grammar: {
							title: "I can + verb",
							explanation:
								"Dùng “I can + động từ” để nói mình có thể làm một việc.",
							example: "I can help. = Mình có thể giúp.",
						},
						...settingUpTentTaskMedia("Mia", 4),
						transcript: "I can get it.",
						sentenceBefore: "I can ",
						sentenceAfter: " it.",
						answer: "get",
					},
					{
						id: "14",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành câu chỉ vị trí.",
						...settingUpTentTaskMedia("Leo", 5),
						transcript: "Thanks. It goes on the other side.",
						parts: ["Thanks. It goes on the ", " ", "."],
						answers: ["other", "side"],
					},
					{
						id: "15",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Leo và xác định vị trí của cây cọc.",
						...settingUpTentTaskMedia("Leo", 5),
						transcript: "Thanks. It goes on the other side.",
						question: "“The other side” chỉ vị trí nào?",
						options: [
							"Bên trong chiếc túi",
							"Ngay cạnh cây cọc Mia đang cầm",
							"Ở ngoài khu cắm trại",
							"Phía đối diện của chiếc lều",
						],
						answer: "Phía đối diện của chiếc lều",
					},
					{
						id: "16",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành nhận xét về tiến độ.",
						grammar: {
							title: "almost + trạng thái",
							explanation:
								"“Almost” cho biết một việc sắp đạt đến trạng thái được nói tới.",
							example: "We’re almost ready. = Chúng ta gần sẵn sàng rồi.",
						},
						...settingUpTentTaskMedia("Leo", 6),
						transcript: "I think we’re almost done.",
						parts: ["I ", " we’re ", " done."],
						answers: ["think", "almost"],
					},
					{
						id: "17",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Leo và chọn mô tả đúng về tiến độ.",
						...settingUpTentTaskMedia("Leo", 6),
						transcript: "I think we’re almost done.",
						question: "Leo muốn nói gì khi nói họ “almost done”?",
						options: [
							"Họ chưa bắt đầu dựng lều",
							"Họ sắp dựng xong lều",
							"Họ cần chọn một chỗ khác",
							"Họ đã làm hỏng chiếc lều",
						],
						answer: "Họ sắp dựng xong lều",
					},
					{
						id: "18",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành nhận xét về chiếc lều.",
						...settingUpTentTaskMedia("Mia", 5),
						transcript: "Nice! The tent looks good.",
						parts: ["Nice! The ", " looks ", "."],
						answers: ["tent", "good"],
					},
					{
						id: "19",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành hành động tiếp theo.",
						grammar: {
							title: "Let’s + verb",
							explanation:
								"Dùng “Let’s” để rủ hoặc đề nghị cùng nhau làm một việc.",
							example: "Let’s go inside. = Chúng ta vào trong nhé.",
						},
						...settingUpTentTaskMedia("Mia", 6),
						transcript: "Let’s put our bags inside.",
						parts: ["Let’s ", " our ", " ", "."],
						answers: ["put", "bags", "inside"],
						choices: ["inside", "bags", "put", "tent"],
					},
				],
			},
			{
				id: "starting-a-campfire",
				thumbnail:
					"/dialogue/weekend-camping/thumbnails/setting-up-the-tent.png",
				title: "Nhóm lửa trại",
				description:
					"Leo và Mia cùng nhau chuẩn bị và nhóm lửa sau khi dựng lều xong.",
				scene: "/dialogue/weekend-camping/setting-up-the-tent/bg.png",
				characters: weekendCampingCharacterImages,
				dialogue: [
					{
						speaker: "Leo",
						text: "The tent is finally ready!",
						translation: "Cuối cùng thì lều cũng dựng xong rồi!",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/leo-01.mp3",
					},
					{
						speaker: "Mia",
						text: "Yeah! Should we make a fire now?",
						translation: "Ừ! Bây giờ mình nhóm lửa nhé?",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/mia-01.mp3",
					},
					{
						speaker: "Leo",
						text: "Good idea. It’s getting a little cold.",
						translation: "Ý hay đấy. Trời bắt đầu hơi lạnh rồi.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/leo-02.mp3",
					},
					{
						speaker: "Mia",
						text: "I’ll get some firewood.",
						translation: "Mình sẽ đi lấy một ít củi.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/mia-02.mp3",
					},
					{
						speaker: "Leo",
						text: "Okay. I’ll prepare the fire pit.",
						translation: "Được. Mình sẽ chuẩn bị chỗ nhóm lửa.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/leo-03.mp3",
					},
					{
						speaker: "Mia",
						text: "Is this enough wood?",
						translation: "Chỗ củi này đủ chưa?",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/mia-03.mp3",
					},
					{
						speaker: "Leo",
						text: "Almost. Let’s get a few more pieces.",
						translation: "Gần đủ rồi. Mình lấy thêm vài khúc nữa nhé.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/leo-04.mp3",
					},
					{
						speaker: "Mia",
						text: "All right. I’ll be right back.",
						translation: "Được rồi. Mình sẽ quay lại ngay.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/mia-04.mp3",
					},
					{
						speaker: "Leo",
						text: "Great. Everything is ready now.",
						translation: "Tuyệt. Bây giờ mọi thứ đã sẵn sàng rồi.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/leo-05.mp3",
					},
					{
						speaker: "Mia",
						text: "Can I light the fire?",
						translation: "Mình châm lửa được không?",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/mia-05.mp3",
					},
					{
						speaker: "Leo",
						text: "Sure. Just be careful.",
						translation: "Được chứ. Chỉ cần cẩn thận nhé.",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/leo-06.mp3",
					},
					{
						speaker: "Mia",
						text: "Look! It’s working!",
						translation: "Nhìn này! Lửa cháy rồi!",
						audioUrl:
							"/dialogue/weekend-camping/starting-a-campfire/audio/mia-06.mp3",
					},
				],
				usefulWords: [
					{
						word: "ready",
						pronunciation: "/ˈredi/",
						translation: "sẵn sàng",
						example: "The tent is finally ready!",
					},
					{
						word: "make a fire",
						pronunciation: "/meɪk ə ˈfaɪər/",
						translation: "nhóm lửa",
						example: "Should we make a fire now?",
					},
					{
						word: "get cold",
						pronunciation: "/ɡet koʊld/",
						translation: "trở nên lạnh",
						example: "It’s getting a little cold.",
					},
					{
						word: "firewood",
						pronunciation: "/ˈfaɪərwʊd/",
						translation: "củi",
						example: "I’ll get some firewood.",
					},
					{
						word: "prepare",
						pronunciation: "/prɪˈper/",
						translation: "chuẩn bị",
						example: "I’ll prepare the fire pit.",
					},
					{
						word: "fire pit",
						pronunciation: "/ˈfaɪər pɪt/",
						translation: "chỗ nhóm lửa",
						example: "I’ll prepare the fire pit.",
					},
					{
						word: "a few more",
						pronunciation: "/ə fjuː mɔːr/",
						translation: "thêm một vài",
						example: "Let’s get a few more pieces.",
					},
					{
						word: "be right back",
						pronunciation: "/bi raɪt bæk/",
						translation: "quay lại ngay",
						example: "I’ll be right back.",
					},
					{
						word: "light the fire",
						pronunciation: "/laɪt ðə ˈfaɪər/",
						translation: "châm lửa",
						example: "Can I light the fire?",
					},
					{
						word: "be careful",
						pronunciation: "/bi ˈkerfəl/",
						translation: "cẩn thận",
						example: "Just be careful.",
					},
				],
				tasks: [
					{
						id: "1",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành câu.",
						...startingCampfireTaskMedia("Leo", 1),
						transcript: "The tent is finally ready!",
						sentenceBefore: "The tent is finally ",
						sentenceAfter: "!",
						answer: "ready",
					},

					{
						id: "2",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành lời đề nghị.",
						grammar: {
							title: "Should we + verb...?",
							explanation:
								"Dùng “Should we + động từ...?” để đề nghị hoặc hỏi ý kiến về việc cùng làm gì đó.",
							example: "Should we go now? = Chúng ta đi bây giờ nhé?",
						},
						...startingCampfireTaskMedia("Mia", 1),
						transcript: "Yeah! Should we make a fire now?",
						parts: ["Yeah! ", " we ", " a fire now?"],
						answers: ["Should", "make"],
					},

					{
						id: "3",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Mia và chọn điều cô ấy đang đề nghị.",
						...startingCampfireTaskMedia("Mia", 1),
						transcript: "Yeah! Should we make a fire now?",
						question: "Mia muốn Leo cùng làm gì?",
						options: [
							"Đi ngủ",
							"Dựng lại chiếc lều",
							"Nhóm lửa",
							"Rời khu cắm trại",
						],
						answer: "Nhóm lửa",
					},

					{
						id: "4",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành câu.",
						grammar: {
							title: "get + adjective",
							explanation:
								"“Get + tính từ” thường dùng để diễn tả một trạng thái đang thay đổi.",
							example: "It’s getting dark. = Trời đang dần tối.",
						},
						...startingCampfireTaskMedia("Leo", 2),
						transcript: "Good idea. It’s getting a little cold.",
						parts: ["Good idea. It’s ", " a little ", "."],
						answers: ["getting", "cold"],
					},

					{
						id: "5",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Leo và chọn lý do phù hợp nhất.",
						...startingCampfireTaskMedia("Leo", 2),
						transcript: "Good idea. It’s getting a little cold.",
						question: "Tại sao Leo nghĩ nhóm lửa là một ý hay?",
						options: [
							"Vì trời bắt đầu lạnh",
							"Vì họ muốn nấu ăn ngay",
							"Vì chiếc lều bị hỏng",
							"Vì họ muốn rời đi",
						],
						answer: "Vì trời bắt đầu lạnh",
					},

					{
						id: "6",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành điều cô ấy sẽ làm.",
						grammar: {
							title: "I’ll + verb",
							explanation:
								"“I’ll + động từ” thường dùng khi bạn quyết định hoặc nói mình sẽ làm một việc.",
							example: "I’ll help you. = Mình sẽ giúp bạn.",
						},
						...startingCampfireTaskMedia("Mia", 2),
						transcript: "I’ll get some firewood.",
						parts: ["I’ll ", " some ", "."],
						answers: ["get", "firewood"],
					},

					{
						id: "7",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành việc anh ấy sẽ làm.",
						...startingCampfireTaskMedia("Leo", 3),
						transcript: "Okay. I’ll prepare the fire pit.",
						parts: ["Okay. I’ll ", " the ", " ", "."],
						answers: ["prepare", "fire", "pit"],
						choices: ["prepare", "fire", "pit", "tent"],
					},

					{
						id: "8",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu hỏi.",
						grammar: {
							title: "enough + noun",
							explanation:
								"“Enough + danh từ” dùng để nói rằng số lượng của một thứ là đủ.",
							example: "Do we have enough water? = Chúng ta có đủ nước không?",
						},
						...startingCampfireTaskMedia("Mia", 3),
						transcript: "Is this enough wood?",
						parts: ["Is this ", " ", "?"],
						answers: ["enough", "wood"],
					},

					{
						id: "9",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Mia và chọn điều cô ấy muốn biết.",
						...startingCampfireTaskMedia("Mia", 3),
						transcript: "Is this enough wood?",
						question: "Mia đang kiểm tra điều gì?",
						options: [
							"Củi có đủ hay chưa",
							"Lều có đủ lớn không",
							"Họ có đủ thức ăn không",
							"Trời có đủ ấm không",
						],
						answer: "Củi có đủ hay chưa",
					},

					{
						id: "10",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành lời đề nghị.",
						grammar: {
							title: "Let’s + verb",
							explanation:
								"Dùng “Let’s + động từ” để rủ hoặc đề nghị cùng nhau làm một việc.",
							example: "Let’s get some water. = Chúng ta đi lấy nước nhé.",
						},
						...startingCampfireTaskMedia("Leo", 4),
						transcript: "Almost. Let’s get a few more pieces.",
						parts: ["Almost. ", " get a few ", " pieces."],
						answers: ["Let’s", "more"],
					},

					{
						id: "11",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Leo và chọn ý đúng nhất.",
						...startingCampfireTaskMedia("Leo", 4),
						transcript: "Almost. Let’s get a few more pieces.",
						question: "Leo muốn nói gì khi trả lời “Almost”?",
						options: [
							"Họ có quá nhiều củi",
							"Họ không cần củi nữa",
							"Họ gần đủ củi nhưng cần thêm một ít",
							"Họ cần dựng lại lều",
						],
						answer: "Họ gần đủ củi nhưng cần thêm một ít",
					},

					{
						id: "12",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu.",
						...startingCampfireTaskMedia("Mia", 4),
						transcript: "All right. I’ll be right back.",
						parts: ["All right. I’ll be ", " ", "."],
						answers: ["right", "back"],
					},

					{
						id: "13",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành nhận xét.",
						...startingCampfireTaskMedia("Leo", 5),
						transcript: "Great. Everything is ready now.",
						sentenceBefore: "Great. Everything is ",
						sentenceAfter: " now.",
						answer: "ready",
					},

					{
						id: "14",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu xin phép.",
						grammar: {
							title: "Can I + verb...?",
							explanation:
								"Dùng “Can I + động từ...?” để hỏi xin phép làm một việc.",
							example: "Can I open it? = Mình mở nó được không?",
						},
						...startingCampfireTaskMedia("Mia", 5),
						transcript: "Can I light the fire?",
						parts: ["Can I ", " the ", "?"],
						answers: ["light", "fire"],
					},

					{
						id: "15",
						type: "multipleChoice",
						title: "Hiểu tình huống",
						instruction: "Nghe Mia và chọn điều cô ấy đang xin phép làm.",
						...startingCampfireTaskMedia("Mia", 5),
						transcript: "Can I light the fire?",
						question: "Mia đang xin phép Leo làm gì?",
						options: [
							"Đi lấy thêm củi",
							"Châm lửa",
							"Đi vào trong lều",
							"Di chuyển chỗ cắm trại",
						],
						answer: "Châm lửa",
					},

					{
						id: "16",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Leo và hoàn thành lời nhắc.",
						grammar: {
							title: "Just + imperative",
							explanation:
								"“Just” có thể được dùng trước một lời nhắc để làm câu nghe nhẹ nhàng hơn.",
							example: "Just wait here. = Cứ đợi ở đây nhé.",
						},
						...startingCampfireTaskMedia("Leo", 6),
						transcript: "Sure. Just be careful.",
						sentenceBefore: "Sure. Just be ",
						sentenceAfter: ".",
						answer: "careful",
					},

					{
						id: "17",
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu cuối.",
						...startingCampfireTaskMedia("Mia", 6),
						transcript: "Look! It’s working!",
						sentenceBefore: "Look! It’s ",
						sentenceAfter: "!",
						answer: "working",
					},
				],
			},
		],
	},
};
