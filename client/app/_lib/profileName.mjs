export function validateProfileName(name) {
	if (typeof name !== "string" || !name.trim()) return "nameRequired";
	const length = name.trim().length;
	if (length < 3) return "nameTooShort";
	if (length > 20) return "nameTooLong";
	return null;
}
