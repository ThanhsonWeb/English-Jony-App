import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { DialogueBackgroundProgressProvider } from "@/app/_components/DialogueProgressSave";

export default async function LocaleLayout({ children, params }) {
	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	return <NextIntlClientProvider><DialogueBackgroundProgressProvider>{children}</DialogueBackgroundProgressProvider></NextIntlClientProvider>;
}
