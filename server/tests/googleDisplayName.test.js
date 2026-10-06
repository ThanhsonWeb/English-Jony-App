const { test } = require("node:test");
const assert = require("node:assert/strict");
const googleDisplayName = require("../utils/googleDisplayName");
const User = require("../models/userModel");
const cases = [
	["A", "A (Google)"], ["Li", "Li (Google)"], ["Normal Learner", "Normal Learner"],
	["Alexander Montgomery Extra Long", "Alexander Montgomery"],
	["Nguyễn Thị Ánh", "Nguyễn Thị Ánh"], ["Nguye\u0302\u0303n Thi\u0323 A\u0301nh", "Nguyễn Thị Ánh"],
	["  Nguyễn\u0000  Sơn\u200b  ", "Nguyễn Sơn"], ["🌟 Mia", "🌟 Mia"],
	[undefined, "Google user"], [null, "Google user"], [42, "Google user"], [{}, "Google user"],
	[["Learner"], "Google user"], [" \n\t\u200b ", "Google user"], ["!!!", "Google user"],
];
for (const [input, expected] of cases) {
	test(`provider name ${JSON.stringify(input)} fits the existing validation`, async () => {
		const name = googleDisplayName(input);
		assert.equal(name, expected);
		await new User({ name, email: "google@example.com", googleId: "isolated-google" }).validate();
	});
}
test("truncation preserves complete Unicode graphemes and never exceeds UTF-16 limits", async () => {
	for (const value of ["Mia " + "😀".repeat(20), "Nguyễn ".repeat(20), "A" + "\u0301".repeat(40)]) {
		const name = googleDisplayName(value);
		assert.ok(name.length >= 3 && name.length <= 20);
		assert.equal(name.isWellFormed(), true);
		await new User({ name, email: "unicode@example.com", googleId: "isolated-google" }).validate();
	}
});
test("normal account name validation remains unchanged", async () => {
	for (const name of ["Li", "A".repeat(21)]) {
		await assert.rejects(new User({ name, email: "normal@example.com", password: "password-123", passwordConfirm: "password-123" }).validate(), /name/);
	}
});
