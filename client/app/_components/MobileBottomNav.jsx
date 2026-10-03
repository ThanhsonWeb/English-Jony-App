"use client";

import {
	House,
	BookOpen,
	Headphones,
	ChartNoAxesColumnIncreasing,
	UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "./MobileBottomNav.module.css";

const items = [
	{ key: "home", label: "home", href: "/", Icon: House },
	{ key: "vocabulary", label: "vocabulary", href: "/wordlist", Icon: BookOpen },
	{ key: "dialogue", label: "dialogue", href: "/dialogue", Icon: Headphones },
	{ key: "progress", label: "progress", href: "/rank", Icon: ChartNoAxesColumnIncreasing },
	{ key: "profile", label: "profile", href: "/profile", Icon: UserRound },
];

export default function MobileBottomNav() {
	const t = useTranslations("Navigation");
	const pathname = usePathname();
	const activePath = pathname.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";

	return (
		<nav className={styles.nav} aria-label={t("mobileLabel")}>
			{items.map(({ key, label, href, Icon }) => {
				const active = href === "/"
					? activePath === "/"
					: activePath === href || activePath.startsWith(`${href}/`);
				const labelText = t(label);

				return (
					<Link
						key={key}
						href={href}
						aria-current={active ? "page" : undefined}
						className={`${styles.item}${active ? ` ${styles.active}` : ""}`}
					>
						<Icon className={styles.icon} size={21} aria-hidden="true" />
						<span>{labelText}</span>
						{active && <span className={styles.underline} aria-hidden="true" />}
					</Link>
				);
			})}
		</nav>
	);
}
