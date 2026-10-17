import { getImageProps } from "next/image";

export const SCENE_IMAGE_SIZES = "(max-width: 768px) 100vw, 768px";
export const CHARACTER_IMAGE_SIZES = "(max-width: 640px) 65vw, 400px";
export const DIALOGUE_IMAGE_QUALITY = 90;

const pendingImages = new Map();

export function preloadDialogueImage(src, sizes) {
	if (!src || typeof window === "undefined") return Promise.resolve();
	const key = `${src}|${sizes}`;
	if (pendingImages.has(key)) return pendingImages.get(key);

	const { props } = getImageProps({
		src, alt: "", fill: true, sizes, quality: DIALOGUE_IMAGE_QUALITY,
	});
	const image = new window.Image();
	image.sizes = props.sizes;
	image.srcset = props.srcSet;
	image.src = props.src;
	const ready = typeof image.decode === "function"
		? image.decode().catch(() => {})
		: new Promise((resolve) => {
			image.onload = resolve;
			image.onerror = resolve;
		});
	pendingImages.set(key, ready);
	return ready;
}

export function preloadTaskImages(task, fallbackScene) {
	if (!task) return Promise.resolve();
	return Promise.all([
		preloadDialogueImage(task.scene || fallbackScene, SCENE_IMAGE_SIZES),
		preloadDialogueImage(task.character?.image, CHARACTER_IMAGE_SIZES),
	]);
}
