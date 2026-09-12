import {
	orderDialogueTasks,
	weekendCampingCharacterImages,
	weekendCampingFillBlankTask,
} from "./helpers";

const arrivingAtTheCampsite = {
				id: "arriving-at-the-campsite",
				thumbnail:
					"/dialogue/weekend-camping/thumbnails/weekend-camping-thumbnail1.png",
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
						weekendCampingFillBlankTask("22", "arriving-at-the-campsite", "Leo", 1, "We’re here! This place looks nice.", "We’re here! This place ", "looks", " nice."),
						weekendCampingFillBlankTask("23", "arriving-at-the-campsite", "Mia", 1, "Yeah, it’s really quiet here.", "Yeah, it’s ", "really", " quiet here."),
						weekendCampingFillBlankTask("24", "arriving-at-the-campsite", "Mia", 3, "Is the ground flat enough?", "Is the ground flat ", "enough", "?"),
						weekendCampingFillBlankTask("25", "arriving-at-the-campsite", "Leo", 4, "I think so. Let me check.", "I ", "think", " so. Let me check."),
						weekendCampingFillBlankTask("26", "arriving-at-the-campsite", "Leo", 5, "Great. I’ll get the tent.", "Great. I’ll ", "get", " the tent."),
						weekendCampingFillBlankTask("27", "arriving-at-the-campsite", "Mia", 4, "Okay. I’ll bring our bags over.", "Okay. I’ll bring our bags ", "over", "."),
						{
							id: "28",
							type: "dialogueCloze",
							title: "Ôn tập hội thoại",
							instruction: "Điền các từ còn thiếu để hoàn thành hội thoại.",
							lines: [
								{
									speaker: "Leo",
									parts: ["We’re ", { blank: "here", id: "1" }, "! This place looks nice."],
								},
								{
									speaker: "Leo",
									parts: ["Where should we put the ", { blank: "tent", id: "2" }, "?"],
								},
								{
									speaker: "Mia",
									parts: ["Yeah, it’s really ", { blank: "quiet", id: "3" }, " here."],
								},
								{
									speaker: "Mia",
									parts: ["Maybe near those ", { blank: "trees", id: "4" }, "."],
								},
								{
									speaker: "Mia",
									parts: ["Is the ", { blank: "ground", id: "5" }, " flat enough?"],
								},
								{
									speaker: "Leo",
									parts: ["That looks like a good ", { blank: "spot", id: "6" }, "."],
								},
								{
									speaker: "Leo",
									parts: ["I think so. Let me ", { blank: "check", id: "7" }, "."],
								},
								{
									speaker: "Leo",
									parts: ["Great. I’ll ", { blank: "get", id: "8" }, " the tent."],
								},
								{
									speaker: "Mia",
									parts: ["Okay. I’ll bring our ", { blank: "bags", id: "9" }, " over."],
								},
								{
									speaker: "Mia",
									parts: ["Do we need anything ", { blank: "else", id: "10" }, "?"],
								},
								{
									speaker: "Leo",
									parts: ["Not yet. Let’s set up the tent ", { blank: "first", id: "11" }, "."],
								},
								{
									speaker: "Mia",
									parts: ["Sounds ", { blank: "good", id: "12" }, ". Let’s do it."],
								},
							],
						},
					],
					[
						"1",
						"22",
						"13",
						"14",
						"6",
						"2",
						"23",
						"4",
						"17",
						"18",
						"24",
						"16",
						"5",
						"25",
						"7",
						"26",
						"9",
						"19",
						"8",
						"27",
						"20",
						"21",
						"11",
						"12",
						"28",
					],
				),
			};

export default arrivingAtTheCampsite;
