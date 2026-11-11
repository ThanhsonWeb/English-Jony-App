// Existing user documents may predate the lifecycle field. Mongoose applies
// the schema's active default to those documents when this field is selected.
function isActiveAccount(user) {
	return Boolean(user) && user.lifecycleState === "active";
}

// Save filters operate on stored MongoDB values, where legacy fields are absent.
function activeAccountFilter() {
	return { $or: [{ lifecycleState: "active" }, { lifecycleState: { $exists: false } }] };
}

module.exports = { isActiveAccount, activeAccountFilter };
