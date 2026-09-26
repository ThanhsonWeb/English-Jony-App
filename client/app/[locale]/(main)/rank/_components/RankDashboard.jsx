"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/_contexts/AuthContext";
import { CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronDown, Crown, Flame, Target } from "lucide-react";
import styles from "../rank.module.css";

function RankAvatar({ user, large = false }) {
	const [failedAvatar, setFailedAvatar] = useState(null);
	const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
	return (
		<span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} data-tone="cyan">
			{user.avatar && failedAvatar !== user.avatar ? (
				<Image src={user.avatar} alt="" fill unoptimized onError={() => setFailedAvatar(user.avatar)} sizes={large ? "88px" : "38px"} />
			) : <span aria-hidden="true">{initials}</span>}
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

function StreakCard({ t, user }) {
	const weekdays = t.raw("weekdays");
	return (
		<section className={`${styles.summaryCard} ${styles.streakCard}`} aria-label={t("streakTitle")}>
			<div className={styles.summaryMain}>
				<span className={styles.streakIcon}><Flame size={43} strokeWidth={1.6} aria-hidden="true" /></span>
				<div className={styles.summaryText}>
					<h2>{t("streakTitle")}</h2>
					<p className={styles.summaryValue}>{user ? t("days", { count: user.streakDays }) : "—"}</p>
					<p className={styles.streakHelp}>{user ? t("studyWeek") : t("unavailable")}</p>
				</div>
			</div>
			<ul className={styles.weekdays} aria-label={t("studyWeek")}>
				{weekdays.map((day, index) => (
					<li key={day} aria-label={`${day}: ${t(user ? (user.completedWeekdays[index] ? "completed" : "notCompleted") : "unavailable")}`}>
						<span className={user?.completedWeekdays[index] ? styles.dayComplete : styles.dayPending}>
							{user?.completedWeekdays[index] ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">—</span>}
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
				<strong>{format(user.periodXp)} KN</strong>
				<span className={styles.streak}><Flame size={18} aria-hidden="true" />{t("days", { count: user.streakDays })}</span>
			</div>
			<span className={styles.podiumBase} aria-hidden="true" />
		</article>
	);
}

function LeaderboardRow({ user, t, format }) {
	return (
		<tr className={`${styles.leaderboardRow} ${user.isCurrentUser ? styles.currentUser : ""}`} aria-current={user.isCurrentUser ? "true" : undefined}>
			<td className={styles.rankNumber}>{user.rank ?? "—"}</td>
			<th scope="row"><div className={styles.rowUser}><RankAvatar user={user} /><span className={styles.userName}>{user.name}</span>{user.isCurrentUser && <span className={styles.youBadge}>{t("you")}</span>}</div></th>
			<td className={styles.rowStreak}><span className={styles.streak}><Flame size={19} aria-hidden="true" />{t("days", { count: user.streakDays })}</span></td>
			<td className={styles.rowKn}>{format(user.periodXp)} KN</td>
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
	const { user: signedInUser } = useAuth();
	const [period, setPeriod] = useState("month");
	const [timeframe, setTimeframe] = useState("current");
	const [attempt, setAttempt] = useState(0);
	const [result, setResult] = useState(null);
	const requestKey = `${period}:${timeframe}:${attempt}`;
	const loading = result?.key !== requestKey;
	const data = loading ? null : result.data;
	const error = loading ? null : result.error;
	const currentAvatar = signedInUser?.avatar || signedInUser?.photo;
	const withCurrentAvatar = profile => profile?.isCurrentUser && currentAvatar ? { ...profile, avatar: currentAvatar } : profile;
	const leaderboard = (data?.leaderboard ?? []).map(withCurrentAvatar);
	const currentUser = withCurrentAvatar(data?.currentUser);
	const rows = [...leaderboard];
	// Keep a personal row for users outside the top ten and unranked users.
	if (currentUser && !rows.some(user => user.id === currentUser.id)) rows.push(currentUser);

	useEffect(() => {
		const controller = new AbortController();
		async function loadLeaderboard() {
			try {
				const query = new URLSearchParams({ period, timeframe, limit: "10" });
				const response = await fetch(`/api/v1/leaderboard?${query}`, {
					credentials: "include", cache: "no-store", signal: controller.signal,
				});
				if (!response.ok) throw new Error(response.status === 401 ? "signIn" : "loadError");
				const payload = await response.json();
				if (!controller.signal.aborted) setResult({ key: requestKey, data: payload.data });
			} catch (error) {
				if (!controller.signal.aborted) setResult({ key: requestKey, error: error.message === "signIn" ? "signIn" : "loadError" });
			}
		}
		loadLeaderboard();
		return () => controller.abort();
	}, [period, timeframe, requestKey]);
	const format = value => new Intl.NumberFormat(locale).format(value);
	const activePeriod = t(period === "month" ? (timeframe === "current" ? "thisMonth" : "lastMonth") : (timeframe === "current" ? "thisWeek" : "lastWeek"));

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
						<MountainDecoration />
				
				</header>

				<div className={styles.summaryGrid}>
					<StreakCard t={t} user={currentUser} />
					<RankSummaryCard icon={Crown} label={t("currentRank")} value={currentUser ? (currentUser.rank === null ? t("unranked") : `#${currentUser.rank}`) : "—"} tone="rank">
						<p>{activePeriod}</p>
					</RankSummaryCard>
					<RankSummaryCard icon={ChartNoAxesColumnIncreasing} label={t("totalKn")} value={currentUser ? `${format(currentUser.lifetimeXp)} KN` : "—"} tone="kn">
						<p><span className={styles.brandText}>{currentUser ? `${format(currentUser.periodXp)} KN` : "—"}</span> · {activePeriod}</p>
					</RankSummaryCard>
					<RankSummaryCard icon={Target} label={t("level")} value={currentUser ? `Lv. ${currentUser.level}` : "—"} tone="level">
						{currentUser ? <>
							<progress className={styles.levelProgress} value={currentUser.progressPercent} max={100} aria-label={t("levelProgress")} />
							<div className={styles.levelLabels}>
								{currentUser.nextLevelXp === null ? <span>{t("maxLevel")}</span> : <><span>{format(currentUser.currentLevelXp)} / {format(currentUser.nextLevelXp)} KN</span><span>Lv. {currentUser.level + 1}</span></>}
							</div>
						</> : <div className={styles.levelProgress} aria-hidden="true" />}
					</RankSummaryCard>
				</div>

				<RankPeriodSwitch period={period} timeframe={timeframe} onPeriodChange={changePeriod} onTimeframeChange={setTimeframe} t={t} />
				<div aria-live="polite" aria-busy={loading}>
					{loading && <p className={styles.statusMessage} role="status">{t("loading")}</p>}
					{error && <div className={styles.statusMessage} role="alert"><p>{t(error)}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t("retry")}</button></div>}
					{data && leaderboard.length === 0 && <p className={styles.statusMessage}>{t("empty")}</p>}
					{currentUser && <p className="sr-only">{t("results", { period: activePeriod, rank: currentUser.rank ?? t("unranked") })}</p>}
				</div>

				<section aria-label={t("topThree")} className={styles.podium}>
					{[leaderboard[1], leaderboard[0], leaderboard[2]].filter(Boolean).map(user => <RankTopCard key={user.id} user={user} t={t} format={format} />)}
				</section>

				<section aria-label={t("leaderboard")} className={styles.leaderboardPanel}>
					<table className={styles.leaderboard}>
						<caption className="sr-only">{t("leaderboard")} — {activePeriod}</caption>
						<thead><tr><th scope="col">#</th><th scope="col">{t("user")}</th><th scope="col">{t("streak")}</th><th scope="col">{t(period === "week" ? "weekKn" : "monthKn")}</th></tr></thead>
						<tbody>{rows.map(user => <LeaderboardRow key={user.id} user={user} t={t} format={format} />)}</tbody>
					</table>
				</section>
			</div>
		</main>
	);
}
