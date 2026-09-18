"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronDown, Crown, Flame, Target, Trophy } from "lucide-react";
import { getMockLeaderboard, mockLearner } from "../_data/mock-rank";
import styles from "../rank.module.css";

function RankAvatar({ user, large = false }) {
	return (
		<span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} data-tone={user.tone}>
			{user.avatar ? (
				<Image src={user.avatar} alt="" fill sizes={large ? "88px" : "38px"} />
			) : <span aria-hidden="true">{user.initials}</span>}
		</span>
	);
}

function MountainDecoration() {
	return (
		<svg className={styles.mountains} viewBox="0 0 420 130" fill="none" aria-hidden="true">
			<circle cx="325" cy="28" r="15" className={styles.moon} />
			<path d="m60 130 81-80 44 45 64-78 75 90 36-46 60 69Z" fill="currentColor" opacity=".4" />
			<path d="m106 130 90-71 35 32 49-54 78 93Z" fill="currentColor" opacity=".55" />
			<path d="m198 80 51-63-15 54 15-16 24 50M258 65l22-28-8 43 12-9 11 18" stroke="currentColor" strokeWidth="1.5" />
			{[287, 309, 335, 354, 377, 401].map((x, i) => <path key={x} d={`M${x} ${83 + i % 3 * 8}l-12 24h6l-12 18h36l-12-18h6Z`} fill="currentColor" />)}
			<path d="M166 24h3m-1.5-1.5v3M214 9h3m-1.5-1.5v3M376 21h3m-1.5-1.5v3" stroke="currentColor" />
		</svg>
	);
}

function Laurels() {
	return (
		<svg className={styles.laurels} viewBox="0 0 360 180" fill="none" aria-hidden="true">
			{[false, true].map((right) => <g key={String(right)} transform={right ? "translate(360 0) scale(-1 1)" : undefined}>
				<path d="M75 161C31 129 24 83 42 33" stroke="currentColor" strokeWidth="1.4" />
				{[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(${33 + i * i * 1.6} ${40 + i * 23}) rotate(${-25 + i * 12})`}>
					<path d="M0 16C-18 9-19-5-16-15 0-8 2 3 0 16ZM2 20C4 1 14-7 22-9 23 5 14 16 2 20Z" fill="currentColor" />
				</g>)}
			</g>)}
		</svg>
	);
}

function RankSummaryCard({ icon: Icon, label, value, children, tone }) {
	return (
		<section className={styles.summaryCard} data-tone={tone} aria-label={label}>
			<div className={styles.summaryMain}>
				<span className={styles.summaryIcon}><Icon size={32} strokeWidth={1.8} aria-hidden="true" /></span>
				<div className={styles.summaryText}><h2>{label}</h2><p className={styles.summaryValue}>{value}</p></div>
			</div>
			<div className={styles.summaryFooter}>{children}</div>
		</section>
	);
}

function StreakCard({ t }) {
	const weekdays = t.raw("weekdays");
	return (
		<section className={`${styles.summaryCard} ${styles.streakCard}`} aria-label={t("streakTitle")}>
			<div className={styles.summaryMain}>
				<span className={styles.streakIcon}><Flame size={43} strokeWidth={1.6} aria-hidden="true" /></span>
				<div className={styles.summaryText}>
					<h2>{t("streakTitle")}</h2>
					<p className={styles.summaryValue}>{t("days", { count: mockLearner.streakDays })}</p>
					<p className={styles.streakHelp}>{t("streakHelp")}</p>
				</div>
			</div>
			<ul className={styles.weekdays} aria-label={t("studyWeek")}>
				{weekdays.map((day, index) => (
					<li key={day} aria-label={`${day}: ${t(mockLearner.completedWeekdays[index] ? "completed" : "notCompleted")}`}>
						<span className={mockLearner.completedWeekdays[index] ? styles.dayComplete : styles.dayPending}>
							{mockLearner.completedWeekdays[index] ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">—</span>}
						</span>
						<span>{day}</span>
					</li>
				))}
			</ul>
		</section>
	);
}

function RankTopCard({ user, t, format }) {
	const metal = user.rank === 1 ? "gold" : user.rank === 2 ? "silver" : "bronze";
	return (
		<article className={`${styles.topCard} ${user.rank === 1 ? styles.winner : ""}`} data-medal={metal} aria-label={t("rankedUser", { rank: user.rank, name: user.name })}>
			<Laurels />
			<span className={styles.medal} aria-hidden="true"><span>{user.rank}</span></span>
			<RankAvatar user={user} large />
			<h3>{user.name}</h3>
			<div className={styles.topStats}>
				<strong>{format(user.kn)} KN</strong>
				<span className={styles.streak}><Flame size={18} aria-hidden="true" />{t("days", { count: user.streakDays })}</span>
			</div>
			<span className={styles.podiumBase} aria-hidden="true" />
		</article>
	);
}

function LeaderboardRow({ user, t, format }) {
	return (
		<tr className={`${styles.leaderboardRow} ${user.isCurrentUser ? styles.currentUser : ""}`} aria-current={user.isCurrentUser ? "true" : undefined}>
			<td className={styles.rankNumber}>{user.rank}</td>
			<th scope="row"><div className={styles.rowUser}><RankAvatar user={user} /><span className={styles.userName}>{user.name}</span>{user.isCurrentUser && <span className={styles.youBadge}>{t("you")}</span>}</div></th>
			<td className={styles.rowStreak}><span className={styles.streak}><Flame size={19} aria-hidden="true" />{t("days", { count: user.streakDays })}</span></td>
			<td className={styles.rowKn}>{format(user.kn)} KN</td>
		</tr>
	);
}

function RankPeriodSwitch({ period, timeframe, onPeriodChange, onTimeframeChange, t }) {
	const selectId = useId();
	return (
		<div className={styles.periodControls}>
			<div className={styles.periodSwitch} role="group" aria-label={t("periodLabel")}>
				{["week", "month"].map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriodChange(value)}>{t(value)}</button>)}
			</div>
			<div className={styles.periodSelect}>
				<CalendarDays size={18} aria-hidden="true" />
				<label htmlFor={selectId} className="sr-only">{t("timeframeLabel")}</label>
				<select id={selectId} value={timeframe} onChange={event => onTimeframeChange(event.target.value)}>
					<option value="current">{t(period === "month" ? "thisMonth" : "thisWeek")}</option>
					<option value="previous">{t(period === "month" ? "lastMonth" : "lastWeek")}</option>
				</select>
				<ChevronDown size={16} aria-hidden="true" />
			</div>
		</div>
	);
}

export default function RankDashboard() {
	const t = useTranslations("Rank");
	const locale = useLocale();
	const [period, setPeriod] = useState("month");
	const [timeframe, setTimeframe] = useState("current");
	const leaderboard = getMockLeaderboard(period, timeframe);
	const currentUser = leaderboard.find(user => user.isCurrentUser);
	const format = value => new Intl.NumberFormat(locale).format(value);
	const periodKey = period === "month" ? (timeframe === "current" ? "thisMonth" : "lastMonth") : (timeframe === "current" ? "thisWeek" : "lastWeek");
	const activePeriod = t(periodKey);
	const leaderboardKnLabel = t(`knPeriod.${periodKey}`);

	function changePeriod(nextPeriod) {
		setPeriod(nextPeriod);
		setTimeframe("current");
	}

	return (
		<main className={styles.page}>
			<div className={styles.container}>
				<header className={styles.pageHeader}>
					<div className={styles.heading}>
						<h1><Crown size={38} strokeWidth={1.7} aria-hidden="true" />{t("title")}</h1>
						<p>{t("subtitle")}</p>
					</div>
					<aside className={styles.quote} aria-label={t("motivation")}>
						<MountainDecoration />
						<blockquote>“{t("quote")}”</blockquote>
						<p>— StudyJony</p>
					</aside>
				</header>

				<div className={styles.summaryGrid}>
					<StreakCard t={t} />
					<RankSummaryCard icon={Crown} label={t("currentRank")} value={`#${currentUser.rank}`} tone="rank">
						<p>{t("rankHelp")}</p>
					</RankSummaryCard>
					<RankSummaryCard icon={ChartNoAxesColumnIncreasing} label={t("totalKn")} value={`${format(mockLearner.totalKn)} KN`} tone="kn">
						<p><span className={styles.brandText}>+{format(mockLearner.weeklyKn)} KN</span> {t("earnedThisWeek")}</p>
					</RankSummaryCard>
					<RankSummaryCard icon={Target} label={t("level")} value={`Lv. ${mockLearner.level}`} tone="level">
						<progress className={styles.levelProgress} value={mockLearner.levelKn} max={mockLearner.nextLevelKn} aria-label={t("levelProgress")} />
						<div className={styles.levelLabels}><span>{mockLearner.levelKn} / {mockLearner.nextLevelKn} KN</span><span>Lv. {mockLearner.level + 1}</span></div>
					</RankSummaryCard>
				</div>

				<RankPeriodSwitch period={period} timeframe={timeframe} onPeriodChange={changePeriod} onTimeframeChange={setTimeframe} t={t} />
				<p className="sr-only" role="status">{t("results", { period: activePeriod, rank: currentUser.rank })}</p>

				<p className={styles.scorePeriod}>{leaderboardKnLabel}</p>
				<section aria-label={`${t("topThree")} — ${leaderboardKnLabel}`} className={styles.podium}>
					{[leaderboard[1], leaderboard[0], leaderboard[2]].map(user => <RankTopCard key={user.id} user={user} t={t} format={format} />)}
				</section>

				<section aria-label={t("leaderboard")}>
					<table className={styles.leaderboard}>
						<caption className="sr-only">{t("leaderboard")} — {activePeriod}</caption>
						<thead><tr><th scope="col">#</th><th scope="col">{t("user")}</th><th scope="col">{t("streak")}</th><th scope="col">{leaderboardKnLabel}</th></tr></thead>
						<tbody>{leaderboard.slice(3).map(user => <LeaderboardRow key={user.id} user={user} t={t} format={format} />)}</tbody>
					</table>
				</section>
				<p className={styles.sampleNote}><Trophy size={13} aria-hidden="true" />{t("sampleNote")}</p>
			</div>
		</main>
	);
}
