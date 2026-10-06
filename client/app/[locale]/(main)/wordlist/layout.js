import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Navigation" });
	return { title: t("wordlist") };
}

export default function WordlistLayout({ children }) {
	return children;
}
