import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Profile" });

	return { title: t("title") };
}

export default function ProfileLayout({ children }) {
	return children;
}
