import DialogueCatalogueClient from "./DialogueCatalogueClient";

export default async function DialoguePage({ searchParams }) {
	const query = await searchParams;
	return <DialogueCatalogueClient isStartIntent={query?.onboarding === "start"} />;
}
