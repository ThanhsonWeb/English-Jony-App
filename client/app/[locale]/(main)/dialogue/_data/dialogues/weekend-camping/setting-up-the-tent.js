import {
	orderDialogueTasks,
	weekendCampingCharacterImages,
	weekendCampingFillBlankTask,
} from "./helpers";

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
const settingUpTheTent = {
				id: "setting-up-the-tent",
				thumbnail:
					"/dialogue/weekend-camping/thumbnails/weekend-camping-thumbnail2.png",
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
				tasks: orderDialogueTasks([
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
					weekendCampingFillBlankTask("20", "setting-up-the-tent", "Leo", 1, "Okay, let’s set up the tent.", "", "Okay", ", let’s set up the tent."),
					weekendCampingFillBlankTask("21", "setting-up-the-tent", "Mia", 1, "Sure. Where should I hold it?", "", "Sure", ". Where should I hold it?"),
					weekendCampingFillBlankTask("22", "setting-up-the-tent", "Leo", 3, "Yes, perfect. Hold it there for a second.", "Yes, perfect. ", "Hold", " it there for a second."),
					weekendCampingFillBlankTask("23", "setting-up-the-tent", "Leo", 4, "Now I’ll put this side up.", "", "Now", " I’ll put this side up."),
					weekendCampingFillBlankTask("24", "setting-up-the-tent", "Leo", 6, "I think we’re almost done.", "I think we’re almost ", "done", "."),
					{
						id: "25",
						type: "dialogueCloze",
						title: "Ôn tập hội thoại",
						instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",
						lines: [
							{
								speaker: "Leo",
								parts: ["Okay, let’s set up the ", { blank: "tent", id: "1" }, "."],
							},
							{
								speaker: "Leo",
								parts: ["Can you help me with this ", { blank: "pole", id: "2" }, "?"],
							},
							{
								speaker: "Mia",
								parts: ["Sure. Where should I ", { blank: "hold", id: "3" }, " it?"],
							},
							{
								speaker: "Mia",
								parts: ["Like ", { blank: "this", id: "4" }, "?"],
							},
							{
								speaker: "Leo",
								parts: ["Yes, perfect. Hold it there for a ", { blank: "second", id: "5" }, "."],
							},
							{
								speaker: "Leo",
								parts: ["Now I’ll put this side ", { blank: "up", id: "6" }, "."],
							},
							{
								speaker: "Mia",
								parts: ["Do we need the ", { blank: "other", id: "7" }, " pole too?"],
							},
							{
								speaker: "Mia",
								parts: ["I can ", { blank: "get", id: "8" }, " it."],
							},
							{
								speaker: "Leo",
								parts: ["Thanks. It goes on the other ", { blank: "side", id: "9" }, "."],
							},
							{
								speaker: "Leo",
								parts: ["I think we’re almost ", { blank: "done", id: "10" }, "."],
							},
							{
								speaker: "Mia",
								parts: ["Nice! The tent looks ", { blank: "good", id: "11" }, "."],
							},
							{
								speaker: "Mia",
								parts: ["Let’s put our bags ", { blank: "inside", id: "12" }, "."],
							},
						],
					},
				], [
					"1", "20",
					"2", "3", "4",
					"5", "6", "21",
					"7",
					"8", "9", "22",
					"10", "23",
					"11", "12",
					"13",
					"14", "15",
					"16", "17", "24",
					"18",
					"19", "25",
				]),
			};

export default settingUpTheTent;
