const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 20;

function validateProfileName(name) {
	if (typeof name !== "string" || !name.trim()) return "nameRequired";
	const length = name.trim().length;
	if (length < MIN_NAME_LENGTH) return "nameTooShort";
	if (length > MAX_NAME_LENGTH) return "nameTooLong";
	return null;
}

module.exports = { MIN_NAME_LENGTH, MAX_NAME_LENGTH, validateProfileName };
