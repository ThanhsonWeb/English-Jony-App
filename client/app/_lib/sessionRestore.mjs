// Share session reads without letting an older read or account mutate auth state.
export function createSessionRestore({ guard, loadUser, onUser, onLoading }) {
	let active = null;
	function invalidate() {
		const previous = active;
		active = null;
		previous?.controller.abort();
	}
	function restore(kind = "session") {
		if (active && guard.isCurrent(active.session) &&
			(active.kind === "oauth" || kind !== "oauth")) return active.promise;

		// A callback may follow a read sent with an expired/previous account cookie.
		invalidate();
		const request = { kind, session: guard.capture(), controller: new AbortController() };
		active = request;
		onLoading(true);
		const isCurrent = () => active === request && guard.isCurrent(request.session);
		request.promise = Promise.resolve().then(async () => {
			if (!isCurrent()) return { status: "stale" };
			let user;
			try {
				user = await loadUser(request.controller.signal);
			} catch {
				user = null;
			}
			if (!isCurrent()) return { status: "stale" };
			const id = user?._id || user?.id;
			user = typeof id === "string" && id.trim() ? user : null;
			guard.update(user);
			onUser(user);
			return { status: user ? "success" : "failed", user, session: guard.capture() };
		}).finally(() => {
			if (active === request) {
				active = null;
				onLoading(false);
			}
		});
		return request.promise;
	}
	return { restore, invalidate };
}
