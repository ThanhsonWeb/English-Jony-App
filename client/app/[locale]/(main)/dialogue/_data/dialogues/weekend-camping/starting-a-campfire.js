import {
	orderDialogueTasks,
	weekendCampingCharacterImages,
	weekendCampingFillBlankTask,
} from "./helpers";

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

const startingACampfire = {
				id: "starting-a-campfire",
				thumbnail:
					"/dialogue/weekend-camping/thumbnails/weekend-camping-thumbnail3.png",
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
				tasks: orderDialogueTasks([
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
						type: "dialogueCloze",
						title: "Ôn tập hội thoại",
						instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",
						lines: [
							{
								speaker: "Leo",
								parts: ["The tent is ", { blank: "finally", id: "1" }, " ready!"],
							},
							{
								speaker: "Mia",
								parts: ["Yeah! Should we make a ", { blank: "fire", id: "2" }, " now?"],
							},
							{
								speaker: "Leo",
								parts: ["Good idea. It’s getting a little ", { blank: "cold", id: "3" }, "."],
							},
							{
								speaker: "Mia",
								parts: ["I’ll get some ", { blank: "firewood", id: "4" }, "."],
							},
							{
								speaker: "Leo",
								parts: ["Okay. I’ll ", { blank: "prepare", id: "5" }, " the fire pit."],
							},
							{
								speaker: "Mia",
								parts: ["Is this ", { blank: "enough", id: "6" }, " wood?"],
							},
							{
								speaker: "Leo",
								parts: ["Almost. Let’s get a few more ", { blank: "pieces", id: "7" }, "."],
							},
							{
								speaker: "Mia",
								parts: ["All right. I’ll be right ", { blank: "back", id: "8" }, "."],
							},
							{
								speaker: "Leo",
								parts: ["Great. ", { blank: "Everything", id: "9" }, " is ready now."],
							},
							{
								speaker: "Mia",
								parts: ["Can I ", { blank: "light", id: "10" }, " the fire?"],
							},
							{
								speaker: "Leo",
								parts: ["Sure. Just be ", { blank: "careful", id: "11" }, "."],
							},
							{
								speaker: "Mia",
								parts: ["Look! It’s ", { blank: "working", id: "12" }, "!"],
							},
						],
					},
					weekendCampingFillBlankTask("18", "starting-a-campfire", "Leo", 1, "The tent is finally ready!", "The tent is ", "finally", " ready!"),
					weekendCampingFillBlankTask("19", "starting-a-campfire", "Mia", 1, "Yeah! Should we make a fire now?", "Yeah! Should we make a ", "fire", " now?"),
					weekendCampingFillBlankTask("20", "starting-a-campfire", "Leo", 2, "Good idea. It’s getting a little cold.", "Good ", "idea", ". It’s getting a little cold."),
					weekendCampingFillBlankTask("21", "starting-a-campfire", "Mia", 2, "I’ll get some firewood.", "I’ll get ", "some", " firewood."),
					weekendCampingFillBlankTask("22", "starting-a-campfire", "Leo", 4, "Almost. Let’s get a few more pieces.", "Almost. Let’s get a few more ", "pieces", "."),
					weekendCampingFillBlankTask("23", "starting-a-campfire", "Mia", 4, "All right. I’ll be right back.", "", "All", " right. I’ll be right back."),
					weekendCampingFillBlankTask("24", "starting-a-campfire", "Leo", 5, "Great. Everything is ready now.", "Great. ", "Everything", " is ready now."),
					weekendCampingFillBlankTask("25", "starting-a-campfire", "Leo", 6, "Sure. Just be careful.", "", "Sure", ". Just be careful."),
				], [
					"1", "18",
					"2", "3", "19",
					"4", "5", "20",
					"6", "21",
					"7",
					"8", "9",
					"10", "11", "22",
					"12", "23",
					"13", "24",
					"14", "15",
					"16", "25",
					"17",
				]),
			};

export default startingACampfire;
