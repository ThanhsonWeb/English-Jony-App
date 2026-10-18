import Image from "next/image";
import { Flame, LockKeyhole, LogIn, Medal, Target, UsersRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import styles from "../rank.module.css";

export default function RankGuestView({ t }) {
	return (
		<>
			<section className={styles.guestHero} aria-labelledby="rank-guest-title">
				<div className={styles.guestContent}>
					<h2 id="rank-guest-title">{t("guest.title")}</h2>
					<ul className={styles.guestFeatures}>
						{[[Flame, "trackStreak"], [Target, "seeLevel"], [UsersRound, "compareLearners"]].map(([Icon, key]) => (
							<li key={key}><Icon size={23} strokeWidth={1.7} aria-hidden="true" /><span>{t(`guest.${key}`)}</span></li>
						))}
					</ul>
					<div className={styles.guestActions}>
						<Link href="/login" className={styles.guestLogin}><LogIn size={18} aria-hidden="true" />{t("guest.login")}</Link>
						<Link href="/signup" className={styles.guestSignup}>{t("guest.signup")}</Link>
					</div>
				</div>
				<div className={styles.guestArtwork}>
					<Image src="/stories/hero-bg-rank.png" alt="" width={1774} height={887}
						sizes="(max-width: 639px) calc(100vw - 64px), (max-width: 900px) 420px, 46vw" priority />
				</div>
			</section>

			<section className={styles.guestPreview} aria-labelledby="rank-preview-title">
				<div className={styles.previewHeading}>
					<h2 id="rank-preview-title">{t("leaderboard")}</h2>
					<span>{t("thisMonth")}</span>
				</div>
				<div className={styles.previewPanel}>
					<table className={styles.previewTable}>
						<caption className="sr-only">{t("guest.previewCaption")}</caption>
						<thead><tr>
							<th scope="col">#</th><th scope="col">{t("user")}</th><th scope="col">{t("level")}</th>
							<th scope="col">{t("streak")}</th><th scope="col">{t("monthKn")}</th>
						</tr></thead>
						<tbody>
							{["gold", "silver", "bronze"].map(metal => (
								<tr key={metal} data-medal={metal}>
									<td><Medal className={styles.previewMedal} size={28} aria-hidden="true" /></td>
									<th scope="row">
										<span className="sr-only">{t("guest.hiddenInfo")}</span>
										<div className={styles.previewIdentity} aria-hidden="true">
											<span className={styles.previewAvatar} /><span className={styles.previewName} />
										</div>
									</th>
									{["level", "streak", "xp"].map(field => <td key={field}><span className={styles.previewBar} aria-hidden="true" /></td>)}
								</tr>
							))}
						</tbody>
					</table>
					<p className={styles.previewMessage}><LockKeyhole size={18} aria-hidden="true" />{t("guest.previewMessage")}</p>
				</div>
			</section>
		</>
	);
}
