// Display-only fixtures. Replace this module with the ranking API when ready.
// The sample learner is deliberately independent of the signed-in account.
export const mockLearner = {
	id: "son-jony",
	level: 12,
	totalKn: 11863,
	weeklyKn: 320,
	levelKn: 450,
	nextLevelKn: 600,
	streakDays: 21,
	completedWeekdays: [true, true, true, true, true, false, false],
};

const users = [
	{ id: "huyen-trang", name: "Huyền Trang User", avatar: null, initials: "HT", streakDays: 6, tone: "teal" },
	{ id: "sophie", name: "Sophie van Dijk", avatar: null, initials: "D", streakDays: 4, tone: "violet" },
	{ id: "light-rain", name: "Light Rain", avatar: null, initials: "L", streakDays: 11, tone: "bronze" },
	{ id: "quang", name: "Quang Nguyễn Đình", avatar: null, initials: "Q", streakDays: 17, tone: "gold" },
	{ id: "dieu-thanh", name: "Diệu Thanh", avatar: null, initials: "DT", streakDays: 17, tone: "green" },
	{ id: "son-jony", name: "Sơn Jony", avatar: null, initials: "SJ", streakDays: 21, tone: "teal" },
	{ id: "nha-thanh", name: "Nha Thanh", avatar: null, initials: "NT", streakDays: 5, tone: "rose" },
	{ id: "thai-my", name: "Thái Mỹ Nguyễn", avatar: null, initials: "TM", streakDays: 65, tone: "violet" },
	{ id: "nga", name: "Nga Nguyễn", avatar: null, initials: "N", streakDays: 28, tone: "gold" },
	{ id: "thuan", name: "Thuan", avatar: null, initials: "T", streakDays: 18, tone: "silver" },
];

const scores = {
	month: {
		current: [14691, 14063, 13107, 12955, 12299, 11863, 11123, 10083, 9293, 8741],
		previous: [11280, 12040, 10650, 9890, 9550, 8920, 8600, 10320, 7480, 7120],
	},
	week: {
		current: [960, 1120, 830, 680, 540, 320, 280, 250, 190, 160],
		previous: [780, 720, 930, 610, 490, 450, 310, 340, 260, 180],
	},
};

export function getMockLeaderboard(period, timeframe) {
	return users
		.map((user, index) => ({
			...user,
			kn: scores[period][timeframe][index],
			isCurrentUser: user.id === mockLearner.id,
		}))
		.sort((a, b) => b.kn - a.kn)
		.map((user, index) => ({ ...user, rank: index + 1 }));
}
