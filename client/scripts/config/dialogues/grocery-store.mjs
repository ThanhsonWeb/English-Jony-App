const groceryStore = {
	courseId: "grocery-store",
	contentType: "dialogue",

	level: "beginner",

	characters: ["Ben", "Emma", "Lee"],

	dialogues: [
		{
			dialogueId: "making-a-shopping-list",
			title: "Lập danh sách mua sắm",
			thumbnail:
				"/dialogue/grocery-store/thumbnails/making-a-shopping-list.webp",
			situation:
				"Ben và Emma chuẩn bị đi siêu thị. Họ cùng kiểm tra xem cần mua những gì và lập một danh sách mua sắm đơn giản.",
		},
		{
			dialogueId: "finding-items",
			title: "Tìm đồ trong siêu thị",
			thumbnail: "/dialogue/grocery-store/thumbnails/finding-items.webp",
			situation:
				"Ben và Emma đang đi quanh siêu thị. Ben không tìm thấy một vài món đồ nên hỏi Emma chúng ở đâu.",
		},
		{
			dialogueId: "choosing-food",
			title: "Chọn đồ ăn",
			thumbnail: "/dialogue/grocery-store/thumbnails/choosing-food.webp",
			situation:
				"Ben và Emma đang chọn thực phẩm. Họ nói về các lựa chọn và quyết định nên mua món nào.",
		},

		{
			dialogueId: "checking-out",
			title: "Thanh toán tại quầy",
			thumbnail: "/dialogue/grocery-store/thumbnails/checking-out.webp",
			situation:
				"Ben và Emma mang đồ đến quầy thanh toán. Lee tính tiền và Ben hỏi về tổng số tiền và cách thanh toán.",
		},
	],
};

export default groceryStore;
