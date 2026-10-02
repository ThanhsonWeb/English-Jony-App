import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, Bookmark, CalendarCheck, Check, Coffee, Headphones, Play, Volume2, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";
import { lessonData } from "./dialogue/_data/lessonData";
import styles from "./home.module.css";

const features = [
	{ key: "dialogues", Icon: Headphones, href: "/dialogue" },
	{ key: "vocabulary", Icon: BookOpen, href: "/wordlist" },
	{ key: "review", Icon: Zap, href: "/wordlist" },
];
const steps = ["choose", "listen", "save", "review"];

function Waveform() {
	return <span className={styles.waveform}>{[12, 22, 34, 18, 42, 27, 14].map((height, index) => <i key={index} style={{ height }} />)}</span>;
}

export default async function Home() {
	const [t, notebook, locale] = await Promise.all([getTranslations("Home"), getTranslations("Notebook"), getLocale()]);
	const courses = Object.values(lessonData).slice(0, 5);
	return (
		<main className={styles.home}>
			<div className={styles.container}>
				<section className={styles.hero} aria-labelledby="home-title">
					<div className={styles.heroArt}>
						<Image src="/home/hero.png" alt={t("heroAlt")} fill priority sizes="(max-width: 640px) 100vw, 70vw" className={styles.heroImage} />
					</div>
					<div className={styles.heroCopy}>
						<p className={styles.eyebrow}><Headphones size={14} aria-hidden="true" />{t("eyebrow")}</p>
						<h1 id="home-title">{t.rich("heroTitle", { accent: (text) => <span>{text}</span> })}</h1>
						<p className={styles.heroDescription}>{t("heroDescription")}</p>
						<div className={styles.ctas}>
							<Link href="/dialogue" className={styles.primary}>{t("startLearning")}<ArrowRight size={18} aria-hidden="true" /></Link>
							<Link href="/dialogue" className={styles.secondary}>{t("exploreDialogues")}</Link>
						</div>
					</div>
				</section>
				<section className={styles.features} aria-label={t("featuresLabel")}>
					{features.map(({ key, Icon, href }, index) => (
						<Link href={href} className={styles.feature} key={key}>
							<div className={styles.featureTop}><span className={styles.iconBox}><Icon size={24} aria-hidden="true" /></span><span className={styles.number}>0{index + 1}</span></div>
							<h2>{t(`features.${key}.title`)}</h2>
							<p>{t(`features.${key}.description`)}</p>
							<div className={styles.featureVisual} aria-hidden="true">
								<span className={styles.circleArrow}><ArrowRight size={18} /></span>
								{key === "dialogues" && <div className={styles.dialoguePreview}><Image src="/home/hero.png" alt="" fill sizes="250px" /></div>}
								{key === "vocabulary" && <div className={styles.wordPreview}><div><strong>coffee <Volume2 size={14} /></strong><span>/ˈkɒfi/</span><small>{t("coffeeMeaning")}</small></div><Coffee size={44} strokeWidth={1.3} /></div>}
								{key === "review" && <div className={styles.reviewPreview}><div className={styles.modeStack}><span>{notebook("flashcard")}</span><span>{notebook("quiz")}</span><span>{notebook("write")}</span></div><div className={styles.bars}><i /><i /><i /></div></div>}
							</div>
						</Link>
					))}
				</section>
				<section className={styles.how} aria-labelledby="how-title">
					<div className={styles.sectionHeading}><p className={styles.kicker}>{t("howEyebrow")}</p><h2 id="how-title">{t("howTitle")}</h2><p>{t("howDescription")}</p></div>
					<ol className={styles.steps}>
						{steps.map((key, index) => <li key={key}>
							<div className={styles.stepArt} aria-hidden="true"><span className={styles.stepNumber}>0{index + 1}</span>
								{key === "choose" && <Image src="/home/hero.png" alt="" fill sizes="240px" className={styles.stepImage} />}
								{key === "listen" && <><Waveform /><span className={styles.play}><Play size={22} fill="currentColor" /></span></>}
								{key === "save" && <><span className={styles.savedWord}>{t("newWord")}<small>{t("savedToNotebook")}</small></span><Bookmark className={styles.bookmark} size={25} fill="currentColor" /></>}
								{key === "review" && <span className={styles.calendar}><CalendarCheck size={44} /><Check size={22} /></span>}
							</div><h3>{t(`steps.${key}.title`)}</h3><p>{t(`steps.${key}.description`)}</p>
						</li>)}
					</ol>
				</section>
				<section className={styles.topics} aria-labelledby="topics-title">
					<div className={styles.topicsHeading}><div><p className={styles.eyebrow}><Headphones size={12} aria-hidden="true" />{t("topicsEyebrow")}</p><h2 id="topics-title">{t("topicsTitle")}</h2><p>{t("topicsDescription")}</p></div><Link href="/dialogue" className={styles.viewAll}>{t("viewAll")}<ArrowRight size={16} aria-hidden="true" /></Link></div>
					<div className={styles.topicGrid}>{courses.map((course) => {
						const title = getLocalizedDialogueValue(course, "title", locale);
						return <Link href={`/dialogue/${course.id}`} key={course.id} className={styles.topic}><div className={styles.topicImage}><Image src={course.dialogues[0]?.thumbnail || course.image} alt="" fill sizes="(max-width: 640px) 45vw, (max-width: 900px) 30vw, 230px" /></div><h3>{title}</h3></Link>;
					})}</div>
				</section>
				<section className={styles.closing}><BookOpen size={26} aria-hidden="true" /><div><h2>{t("closingTitle")}</h2><p>{t("closingDescription")}</p></div><Link href="/dialogue" className={styles.primary}>{t("startLearning")}<ArrowRight size={18} aria-hidden="true" /></Link></section>
			</div>
		</main>
	);
}
