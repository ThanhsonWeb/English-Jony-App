const statuses = new Set(["all", "new", "learning", "review", "mastered"]);

export function resolveWordlistFilter(selected, counts, loading = false) {
	// An explicit selection wins even when its result is empty.
	if (statuses.has(selected)) return selected;
	if (loading || counts.review > 0) return "review";
	return counts.new > 0 ? "new" : "all";
}
