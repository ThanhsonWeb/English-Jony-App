// Auth API messages are not locale-aware; translate known validation failures.
export function getAuthErrorMessage(data, t, fallback) {
	const message = data.message || "";
	if (data.error?.code === 11000 || message.includes("đã được sử dụng")) return t("emailInUse");
	const rules = [
		["Vui lòng nhập đầy đủ email và mật khẩu", "credentialsRequired"],
		["Email hoặc mật khẩu không chính xác", "invalidCredentials"],
		["name must have at least 3 characters", "nameLength"],
		["maximum 20 characters", "nameLength"],
		["please provide a valid email", "validEmail"],
		["user must have an email", "validEmail"],
		["Password must be at least 8 characters", "passwordLength"],
		["Passwords are not the same", "passwordMismatch"],
	];
	const keys = new Set(rules.filter(([text]) => message.includes(text)).map(([, key]) => key));
	return keys.size ? [...keys].map(key => t(key)).join(" ") : t(fallback);
}
