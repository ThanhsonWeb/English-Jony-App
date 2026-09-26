require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const User = require("../models/userModel");

async function main() {
	await mongoose.connect(process.env.DATABASE);
	const users = await User.find({ avatar: { $exists: true, $ne: "" } })
		.select("avatar -_id")
		.lean();
	const summary = {
		total: users.length,
		cloudinaryHttps: 0,
		otherHttps: 0,
		localRelative: 0,
		insecureHttp: 0,
		invalid: 0,
		publiclyReachable: 0,
		unreachable: 0,
	};

	for (const user of users) {
		const value = typeof user.avatar === "string" ? user.avatar.trim() : "";
		if (/^https:\/\/res\.cloudinary\.com\//i.test(value)) summary.cloudinaryHttps += 1;
		else if (/^https:\/\//i.test(value)) summary.otherHttps += 1;
		else if (/^\/(api\/v1\/users\/avatar-files|uploads)\//i.test(value)) summary.localRelative += 1;
		else if (/^http:\/\//i.test(value)) summary.insecureHttp += 1;
		else summary.invalid += 1;

		if (/^https:\/\//i.test(value)) {
			try {
				const response = await fetch(value, {
					method: "HEAD",
					signal: AbortSignal.timeout(10000),
				});
				if (response.ok) summary.publiclyReachable += 1;
				else summary.unreachable += 1;
			} catch {
				summary.unreachable += 1;
			}
		}
	}

	console.log(JSON.stringify(summary));
}

main()
	.catch((error) => {
		console.error(`${error.name}: ${error.message}`);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
