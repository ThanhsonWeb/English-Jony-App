import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Navigation" });
	return { title: t("dialogue") };
}

export default function DialogueLayout({ children }) {
	return children;
}
