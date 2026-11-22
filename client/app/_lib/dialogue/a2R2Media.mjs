const origin = "https://pub-a0c593a050834420b5faa3e260029a02.r2.dev";
const localBase = "/dialogue/everyday-plans/making-plans-after-work/";
const remoteBase = `${origin}/a2/dialogue/everyday-plans/making-plans-after-work/`;
const thumbnail = "/dialogue/everyday-plans/thumbnails/making-plans-after-work.webp";

export function a2R2Url(value, enabled) {
	if (!enabled || typeof value !== "string") return value;
	if (value === thumbnail) return `${remoteBase}thumbnails/making-plans-after-work.webp`;
	if (value === `${localBase}bg.png` || /^\/dialogue\/everyday-plans\/making-plans-after-work\/audio\/(ben-0[1-6]|emma-0[1-4])\.mp3$/.test(value)) return remoteBase + value.slice(localBase.length);
	return value;
}

export function a2LocalFallback(value) {
	if (value === `${remoteBase}thumbnails/making-plans-after-work.webp`) return thumbnail;
	if (typeof value === "string" && value.startsWith(remoteBase)) {
		const local = localBase + value.slice(remoteBase.length);
		if (a2R2Url(local, true) === value) return local;
	}
	return null;
}
