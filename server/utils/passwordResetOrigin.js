const AppError = require("./appError");

module.exports = () => {
	const configuredOrigin = process.env.FRONTEND_URL;
	try {
		if (
			typeof configuredOrigin !== "string" ||
			!/^https?:\/\/[^/?#\\\s]+\/*$/i.test(configuredOrigin)
		) throw new Error("Invalid origin");

		const url = new URL(configuredOrigin);
		if (
			!url.hostname || url.username || url.password ||
			(process.env.NODE_ENV === "production" && url.protocol !== "https:")
		) throw new Error("Invalid origin");

		return url.origin;
	} catch {
		throw new AppError("Password recovery is temporarily unavailable. Please try again later.", 500);
	}
};
