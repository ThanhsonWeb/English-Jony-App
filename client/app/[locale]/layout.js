import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { DialogueBackgroundProgressProvider } from "@/app/_components/DialogueProgressSave";
import { LanguagePreferenceProvider } from "@/app/_contexts/LanguagePreferenceContext";
import { DEFAULT_LANGUAGE, guestLanguage } from "@/app/_lib/languagePreference.mjs";
import { selectedSessionCookies } from "@/i18n/accountLanguage.mjs";

export default async function LocaleLayout({ children, params }) {
	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	const cookieHeader = (await cookies()).toString();
	const initialGuestLanguage = guestLanguage(cookieHeader) || (selectedSessionCookies(cookieHeader) ? DEFAULT_LANGUAGE : locale);
	return (
		<NextIntlClientProvider>
			<LanguagePreferenceProvider initialGuestLanguage={initialGuestLanguage}>
				<DialogueBackgroundProgressProvider>{children}</DialogueBackgroundProgressProvider>
			</LanguagePreferenceProvider>
		</NextIntlClientProvider>
	);
}
