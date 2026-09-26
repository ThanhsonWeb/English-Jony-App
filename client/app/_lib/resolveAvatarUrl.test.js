import test from "node:test";
import assert from "node:assert/strict";
import { resolveAvatarUrl } from "./resolveAvatarUrl.js";

test("production prefers the custom HTTPS avatar", () => {
	assert.equal(
		resolveAvatarUrl(
			{ avatar: "https://res.cloudinary.com/demo/image/upload/avatar.jpg", photo: "https://google.example/photo.jpg" },
			[],
			{ isProduction: true },
		),
		"https://res.cloudinary.com/demo/image/upload/avatar.jpg",
	);
});

test("production rejects local and insecure avatar URLs and uses the Google fallback", () => {
	for (const avatar of [
		"/api/v1/users/avatar-files/user_123.jpg",
		"http://localhost:5000/uploads/avatar.jpg",
		"http://api.studyjony.com/uploads/avatar.jpg",
	]) {
		assert.equal(
			resolveAvatarUrl(
				{ avatar, photo: "https://google.example/photo.jpg" },
				[],
				{ isProduction: true },
			),
			"https://google.example/photo.jpg",
		);
	}
});

test("development can display the local avatar endpoint", () => {
	assert.equal(
		resolveAvatarUrl(
			{ avatar: "/api/v1/users/avatar-files/user_123.jpg", photo: "https://google.example/photo.jpg" },
			[],
			{ isProduction: false },
		),
		"/api/v1/users/avatar-files/user_123.jpg",
	);
});

test("a failed custom avatar falls back to the profile photo", () => {
	const avatar = "https://res.cloudinary.com/demo/image/upload/avatar.jpg";
	assert.equal(
		resolveAvatarUrl(
			{ avatar, photo: "https://google.example/photo.jpg" },
			[avatar],
			{ isProduction: true },
		),
		"https://google.example/photo.jpg",
	);
});
