const coffeeShop = {
	courseId: "coffee-shop",

	level: "beginner",

	characters: ["Ben", "Emma"],

	dialogues: [
		{
			dialogueId: "ordering-a-coffee",
			title: "Gọi cà phê",
			thumbnail:
				"/dialogue/coffee-shop/thumbnails/ordering-a-coffee.png",
			situation:
				"Ben gọi một ly cà phê tại quầy và Emma giúp Ben chọn loại đồ uống phù hợp.",
		},
		{
			dialogueId: "choosing-a-snack",
			title: "Chọn đồ ăn nhẹ",
			thumbnail:
				"/dialogue/coffee-shop/thumbnails/choosing-a-snack.png",
			situation:
				"Ben muốn gọi thêm một món ăn nhẹ và hỏi Emma về những món có sẵn.",
		},
		{
			dialogueId: "asking-about-the-wifi",
			title: "Hỏi mật khẩu Wi-Fi",
			thumbnail:
				"/dialogue/coffee-shop/thumbnails/asking-about-the-wifi.png",
			situation:
				"Ben muốn sử dụng Wi-Fi của quán và hỏi Emma cách kết nối.",
		},
		{
			dialogueId: "fixing-an-order",
			title: "Sửa món đã gọi",
			thumbnail:
				"/dialogue/coffee-shop/thumbnails/fixing-an-order.png",
			situation:
				"Ben nhận ra đồ uống của mình không đúng và lịch sự nhờ Emma kiểm tra lại.",
		},
		{
			dialogueId: "paying-at-the-counter",
			title: "Thanh toán tại quầy",
			thumbnail:
				"/dialogue/coffee-shop/thumbnails/paying-at-the-counter.png",
			situation:
				"Ben thanh toán đồ uống và hỏi Emma về giá tiền và cách thanh toán.",
		},
	],
};

export default coffeeShop;