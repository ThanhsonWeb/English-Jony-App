// Localized display metadata lives beside the existing lesson data so dialogue
// content, exercise answers, audio, and generation files keep their contracts.
const englishMetadata = {
	"at-a-hotel": {
		title: "At a hotel",
		description: "Learn to check in and communicate in everyday hotel situations.",
		dialogues: {
			"checking-in": ["Checking in", "Ben arrives at the hotel and checks in with the receptionist."],
			"asking-for-extra-towels": ["Asking for extra towels", "Ben politely asks a hotel staff member for extra towels."],
			"reporting-a-room-problem": ["Reporting a room problem", "Ben tells a staff member that something in his room is not working and asks for help."],
			"checking-out": ["Checking out", "Ben checks out, reviews his bill, and thanks the staff before leaving."],
		},
	},
	"office-introduction": {
		title: "First day at the office",
		description: "Maria meets Tom on her first day at work. Learn to introduce yourself and talk with people at the office.",
		dialogues: {
			"meeting-tom": ["Maria meets Tom", "Maria gets to know Tom on her first day at the company."],
			"meet-coworkers": ["Meeting new coworkers", "Maria introduces Tom to Anna, a teammate."],
			"talk-about-work": ["Talking about work", "Anna and Tom talk about their jobs and tasks."],
			"lunch-break": ["Lunch break", "Maria and Tom eat lunch and chat."],
		},
	},
	"weekend-camping": {
		title: "Weekend camping",
		description: "Follow Leo and Mia on a weekend camping trip and learn English through everyday situations.",
		dialogues: {
			"arriving-at-the-campsite": ["Arriving at the campsite", "Leo and Mia arrive at the campsite and find a good place to pitch their tent."],
		"setting-up-the-tent": ["Setting up the tent", "Leo and Mia put up their tent together at the campsite."],
			"cooking-dinner": ["Cooking dinner", "Leo and Mia cook dinner beside the campfire."],
			"talking-by-the-campfire": ["Talking by the campfire", "Leo and Mia relax by the campfire and talk about their day and plans for tomorrow."],
		},
	},
	"asking-for-directions": {
		title: "Asking for directions",
		description: "Learn to ask for and give directions in everyday situations.",
		dialogues: {
			"finding-the-bus-stop": ["Finding the bus stop", "Ben asks Emma how to get to the nearest bus stop."],
			"going-to-the-supermarket": ["Going to the supermarket", "Ben asks Emma how to get to a nearby supermarket."],
			"finding-the-train-station": ["Finding the train station", "Ben asks Emma how to get to the train station."],
			"finding-a-cafe": ["Finding a cafe", "Ben calls Emma for directions because he cannot find the cafe where she is waiting."],
		},
	},
	"coffee-shop": {
		title: "Coffee shop",
		description: "Learn to order drinks and talk in everyday coffee shop situations.",
		dialogues: {
			"ordering-a-coffee": ["Ordering a coffee", "Ben and Emma go to the counter. Emma helps Ben choose a drink, and Alex takes their order."],
			"choosing-a-snack": ["Choosing a snack", "At the coffee shop, Ben asks Emma which snack sounds good."],
			"asking-about-the-wifi": ["Asking about the Wi-Fi", "Ben asks Emma how to connect to the coffee shop's Wi-Fi."],
			"fixing-an-order": ["Fixing an order", "Ben notices that his drink is wrong and politely asks Alex to check it."],
		},
	},
	"grocery-store": {
		title: "Grocery store",
		description: "Learn to make a shopping list and talk through everyday supermarket situations.",
		dialogues: {
			"making-a-shopping-list": ["Making a shopping list", "Ben and Emma decide what they need and make a simple shopping list."],
			"finding-items": ["Finding items in the store", "Ben asks Emma where to find a few items in the supermarket."],
			"choosing-food": ["Choosing food", "Ben and Emma compare food options and decide what to buy."],
			"checking-out": ["Checking out", "Lee totals Ben and Emma's groceries, and Ben asks about the price and payment."],
		},
	},
	restaurant: {
		title: "Restaurant",
		description: "Practice simple conversations about getting a table, ordering food, and paying at a restaurant.",
		dialogues: {
			"getting-a-table": ["Getting a table", "Ben and Emma arrive at a restaurant, and Alex helps them find a table."],
			"reading-the-menu": ["Reading the menu", "Ben and Emma look at the menu and talk about what they want to try."],
			"ordering-food": ["Ordering food", "Alex takes their order as Ben and Emma politely ask for food and drinks."],
			"during-the-meal": ["During the meal", "Ben and Emma talk about their food and ask Alex a few simple questions."],
		},
	},
};

export function withDialogueLocalization(course) {
	const translation = englishMetadata[course.id];
	if (!translation) throw new Error(`Missing English course metadata: ${course.id}`);
	return {
		...course,
		localized: {
			title: { vi: course.title, en: translation.title },
			description: { vi: course.description, en: translation.description },
		},
		dialogues: course.dialogues.map((dialogue) => {
			const english = translation.dialogues[dialogue.id];
			if (!english) throw new Error(`Missing English dialogue metadata: ${course.id}/${dialogue.id}`);
			return {
				...dialogue,
				localized: {
					title: { vi: dialogue.title, en: english[0] },
					description: { vi: dialogue.description, en: english[1] },
				},
			};
		}),
	};
}

export function getLocalizedDialogueValue(item, field, locale) {
	const value = item?.localized?.[field] ?? item?.[field];
	if (value && typeof value === "object" && ("vi" in value || "en" in value)) {
		return value[locale] ?? value.en ?? value.vi ?? "";
	}
	return value ?? "";
}
