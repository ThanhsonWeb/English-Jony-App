"use client";
import { useTranslations } from "next-intl";

export default function Error({ reset }) {
	const t = useTranslations("Errors");
	return (
		<div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center px-6">
			<div className="text-center max-w-md">
				<div className="text-7xl mb-4">😵‍💫</div>
				<h1 className="text-2xl font-semibold text-white mb-3">{t("title")}</h1>
				<p className="text-slate-400 mb-8">{t("description")}</p>
				<button onClick={reset} className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer">{t("retry")}</button>
			</div>
		</div>
	);
}
