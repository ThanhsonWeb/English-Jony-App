const User = require("../models/userModel");

function validateProfileName(name) {
	if (typeof name !== "string" || !name.trim()) return "nameRequired";
	const rules = User.schema.path("name").options;
	const length = name.trim().length;
	if (length < rules.minLength[0]) return "nameTooShort";
	if (length > rules.maxLength[0]) return "nameTooLong";
	return null;
}

module.exports = { validateProfileName };
