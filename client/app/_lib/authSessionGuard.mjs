const accountId = user => user?._id || user?.id || null;

export function createAuthSessionGuard() {
	let user = null;
	let generation = 0;
	const capture = () => ({ generation, userId: accountId(user) });
	const isCurrent = session => session.generation === generation && session.userId === accountId(user);
	return {
		capture,
		isCurrent,
		getUser: () => user,
		start(nextUser) { generation += 1; user = nextUser; return user; },
		update(nextUser) {
			if (accountId(nextUser) !== accountId(user)) generation += 1;
			user = nextUser;
			return user;
		},
		updateForSession(nextUser, session) {
			if (!session.userId || !isCurrent(session) || accountId(nextUser) !== session.userId) return false;
			user = nextUser;
			return true;
		},
	};
}
