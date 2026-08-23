"use client";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function NotFound() {
	const t = useTranslations("Errors");
	return (
		<div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center px-6">
			<div className="text-center max-w-md">
				<div className="text-8xl font-bold text-blue-500 mb-4">404 😵‍💫</div>
				<h1 className="text-2xl font-semibold text-white mb-3">{t("notFoundTitle")}</h1>
				<p className="text-slate-400 mb-8">{t("notFoundDescription")}</p>
				<Link href="/" className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">{t("home")}</Link>
			</div>
		</div>
	);
}
