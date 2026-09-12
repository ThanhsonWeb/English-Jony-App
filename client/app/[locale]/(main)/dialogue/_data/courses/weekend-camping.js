import cookingDinnerDraft from "../dialogues/weekend-camping/cooking-dinner.json";
import talkingByTheCampfireDraft from "../dialogues/weekend-camping/talking-by-the-campfire.json";
import { buildGeneratedDialogueTasks } from "../helpers/buildDialogue";

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

function weekendCampingFillBlankTask(
	id,
	dialogueId,
	speaker,
	audioIndex,
	transcript,
	sentenceBefore,
	answer,
	sentenceAfter,
) {
	return {
		id,
		type: "fillBlank",
		title: "Điền từ còn thiếu",
		instruction: "Nghe và điền từ còn thiếu.",
		scene: `/dialogue/weekend-camping/${dialogueId}/bg.png`,
		character: {
			name: speaker,
			image: weekendCampingCharacterImages[speaker],
		},
		audioUrl: `/dialogue/weekend-camping/${dialogueId}/audio/${speaker.toLowerCase()}-${String(audioIndex).padStart(2, "0")}.mp3`,
		transcript,
		sentenceBefore,
		sentenceAfter,
		answer,
	};
}

const weekendCampingCourse = {
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
						weekendCampingFillBlankTask("28", "arriving-at-the-campsite", "Mia", 6, "Sounds good. Let’s do it.", "Sounds ", "good", ". Let’s do it."),
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
			},
			// setting-up-the-tent
			{
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
			},
			//starting-a-campfire
			{
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
						type: "fillBlank",
						title: "Điền từ còn thiếu",
						instruction: "Nghe Mia và hoàn thành câu cuối.",
						...startingCampfireTaskMedia("Mia", 6),
						transcript: "Look! It’s working!",
						sentenceBefore: "Look! It’s ",
						sentenceAfter: "!",
						answer: "working",
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
			},
			//cooking dinner
			{
				...cookingDinnerDraft,
				id: cookingDinnerDraft.metadata.dialogueId,
				thumbnail: cookingDinnerDraft.metadata.thumbnail,
				title: cookingDinnerDraft.metadata.title,
				description: cookingDinnerDraft.metadata.situation,
				scene: cookingDinnerDraft.metadata.scene,
				characters: weekendCampingCharacterImages,
				tasks: buildGeneratedDialogueTasks(
					cookingDinnerDraft,
					weekendCampingCharacterImages,
				),
			},
			// talking by the campfire
			{
				...talkingByTheCampfireDraft,
				id: talkingByTheCampfireDraft.metadata.dialogueId,
				thumbnail: talkingByTheCampfireDraft.metadata.thumbnail,
				title: talkingByTheCampfireDraft.metadata.title,
				description: talkingByTheCampfireDraft.metadata.situation,
				scene: talkingByTheCampfireDraft.metadata.scene,
				characters: weekendCampingCharacterImages,
				tasks: buildGeneratedDialogueTasks(
					talkingByTheCampfireDraft,
					weekendCampingCharacterImages,
				),
			},
		],
	};

export default weekendCampingCourse;
