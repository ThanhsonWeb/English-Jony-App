const coffeeShop = {
	courseId: "coffee-shop",

	level: "beginner",

	characters: ["Ben", "Emma", "Alex"],

	dialogues: [
		{
			dialogueId: "ordering-a-coffee",
			title: "Gọi cà phê",
			thumbnail: "/dialogue/coffee-shop/thumbnails/ordering-a-coffee.png",
			situation:
				"Ben và Emma đến quầy gọi cà phê. Emma giúp Ben chọn đồ uống và Alex nhận order.",
		},
		{
			dialogueId: "choosing-a-snack",
			title: "Chọn đồ ăn nhẹ",
			thumbnail: "/dialogue/coffee-shop/thumbnails/choosing-a-snack.png",
			situation:
				"Ben và Emma đang ngồi ở quán cà phê. Ben muốn gọi thêm một món ăn nhẹ và hỏi Emma xem món nào nghe ngon hoặc phù hợp.",
		},
		{
			dialogueId: "asking-about-the-wifi",
			title: "Hỏi mật khẩu Wi-Fi",
			thumbnail: "/dialogue/coffee-shop/thumbnails/asking-about-the-wifi.png",
			situation: "Ben muốn sử dụng Wi-Fi của quán và hỏi Emma cách kết nối.",
		},
		{
			dialogueId: "fixing-an-order",
			title: "Sửa món đã gọi",
			thumbnail: "/dialogue/coffee-shop/thumbnails/fixing-an-order.png",
			situation:
				"Ben nhận ra đồ uống của mình không đúng và lịch sự nhờ Alex, nhân viên của quán, kiểm tra lại.",
		},
		{
			dialogueId: "paying-at-the-counter",
			title: "Thanh toán tại quầy",
			thumbnail: "/dialogue/coffee-shop/thumbnails/paying-at-the-counter.png",
			situation:
				"Ben thanh toán tại quầy và hỏi Alex về giá tiền và cách thanh toán.",
		},
	],
};

export default coffeeShop;
