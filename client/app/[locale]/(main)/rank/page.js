import { getTranslations } from "next-intl/server";
import RankDashboard from "./_components/RankDashboard";

export async function generateMetadata({ params }) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Rank" });
	return { title: t("pageTitle") };
}

export default function RankPage() {
	return <RankDashboard />;
}
