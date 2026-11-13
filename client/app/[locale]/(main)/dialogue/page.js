import DialogueCatalogueClient from "./DialogueCatalogueClient";

export default async function DialoguePage({ searchParams }) {
	const query = await searchParams;
	const initialCategory = query?.category === "story" ? "story" : "all";
	const isStartIntent = query?.onboarding === "start";
	return <DialogueCatalogueClient key={`${initialCategory}:${isStartIntent}`} isStartIntent={isStartIntent} initialCategory={initialCategory} />;
}
