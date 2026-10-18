"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useLeaderboardResource } from "@/app/_lib/useStudyResources";
import { resolveAvatarUrl } from "@/app/_lib/resolveAvatarUrl";
import { CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronDown, Crown, Flame, Target, X } from "lucide-react";
import styles from "../rank.module.css";
import RankGuestView from "./RankGuestView";

function RankAvatar({ user, large = false }) {
	const [failedAvatarUrls, setFailedAvatarUrls] = useState([]);
	const avatarUrl = resolveAvatarUrl(user, failedAvatarUrls);
	const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
	return (
		<span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} data-tone="cyan">
			{avatarUrl ? (
				<Image src={avatarUrl} alt="" fill unoptimized onError={() => setFailedAvatarUrls((urls) => [...urls, avatarUrl])} sizes={large ? "88px" : "38px"} />
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

function RankTopCard({ user, t, format, onOpenProfile }) {
	const metal = user.rank === 1 ? "gold" : user.rank === 2 ? "silver" : "bronze";
	return (
		<article className={`${styles.topCard} ${user.rank === 1 ? styles.winner : ""}`} data-medal={metal} aria-label={t("rankedUser", { rank: user.rank, name: user.name })}>
			<Laurels />
			<span className={styles.medal} aria-hidden="true"><span>{user.rank}</span></span>
			{user.isCurrentUser ? <><RankAvatar user={user} large /><h3>{user.name}</h3></> :
				<button type="button" className={styles.topProfileTrigger}
					aria-label={t("viewProfile", { name: user.name })}
					onClick={(event) => onOpenProfile(user, event)}>
					<RankAvatar user={user} large /><h3>{user.name}</h3>
				</button>}
			<div className={styles.topStats}>
				<strong>{format(user.periodXp)} KN</strong>
				<span className={styles.streak}><Flame size={18} aria-hidden="true" />{t("days", { count: user.streakDays })}</span>
			</div>
			<span className={styles.podiumBase} aria-hidden="true" />
		</article>
	);
}

function LeaderboardRow({ user, t, format, onOpenProfile }) {
	return (
		<tr className={`${styles.leaderboardRow} ${user.isCurrentUser ? styles.currentUser : ""}`} aria-current={user.isCurrentUser ? "true" : undefined}>
			<td className={styles.rankNumber}>{user.rank ?? "—"}</td>
			<th scope="row"><div className={styles.rowUser}>
				{user.isCurrentUser ? <><RankAvatar user={user} /><span className={styles.userName}>{user.name}</span></> :
					<button type="button" className={styles.profileTrigger}
						aria-label={t("viewProfile", { name: user.name })}
						onClick={(event) => onOpenProfile(user, event)}>
						<RankAvatar user={user} /><span className={styles.userName}>{user.name}</span>
					</button>}
				{user.isCurrentUser && <span className={styles.youBadge}>{t("you")}</span>}
			</div></th>
			<td className={styles.rowLevel}>Lv. {user.level}</td>
			<td className={styles.rowStreak}><span className={styles.streak}><Flame size={19} aria-hidden="true" />{t("days", { count: user.streakDays })}</span></td>
			<td className={styles.rowKn}>{format(user.periodXp)} KN</td>
		</tr>
	);
}

function RankProfilePopup({ selectedUser, onClose, t, format }) {
	const closeRef = useRef(null);
	const [requestId, setRequestId] = useState(0);
	const [request, setRequest] = useState({ status: "loading", profile: null });

	useEffect(() => {
		const controller = new AbortController();
		async function load() {
			try {
				const response = await fetch(`/api/v1/leaderboard/users/${selectedUser.id}`, {
					credentials: "include", cache: "no-store", signal: controller.signal,
				});
				if (!response.ok) throw new Error("loadError");
				const profile = (await response.json()).data?.profile;
				if (profile?.id !== selectedUser.id) throw new Error("loadError");
				setRequest({ status: "ready", profile });
			} catch {
				if (!controller.signal.aborted) setRequest({ status: "error", profile: null });
			}
		}
		void load();
		return () => controller.abort();
	}, [selectedUser.id, requestId]);

	useEffect(() => {
		const oldOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeRef.current?.focus();
		function onKeyDown(event) {
			if (event.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = oldOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	const profile = request.profile;
	return createPortal(
		<div className={styles.profileBackdrop} onClick={(event) => {
			if (event.target === event.currentTarget) onClose();
		}}>
			<section role="dialog" aria-modal="true" aria-labelledby="rank-profile-title" className={styles.profileDialog}>
				<button ref={closeRef} type="button" className={styles.profileClose}
					aria-label={t("closeProfile")} onClick={onClose}><X size={20} /></button>
				<p className={styles.profileEyebrow}>{t("profileTitle")}</p>
				<div className={styles.profileIdentity}>
					<RankAvatar user={profile || selectedUser} large />
					<h2 id="rank-profile-title">{profile?.name || selectedUser.name}</h2>
				</div>
				{request.status === "loading" && <p className={styles.profileStatus} role="status">{t("profileLoading")}</p>}
				{request.status === "error" && <div className={styles.profileStatus} role="alert">
					<p>{t("profileError")}</p>
					<button type="button" onClick={() => { setRequest({ status: "loading", profile: null }); setRequestId((id) => id + 1); }}>{t("retry")}</button>
				</div>}
				{profile && <dl className={styles.profileStats}>
					<div><dt>{t("level")}</dt><dd>Lv. {profile.level}</dd></div>
					<div><dt>{t("monthlyRank")}</dt><dd>{profile.monthlyRank === null ? t("unranked") : `#${profile.monthlyRank}`}</dd></div>
					<div><dt>{t("monthKn")}</dt><dd>{format(profile.monthlyXp)} KN</dd></div>
					<div><dt>{t("streakTitle")}</dt><dd>{t("days", { count: profile.streakDays })}</dd></div>
				</dl>}
			</section>
		</div>, document.body,
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
	const { user: signedInUser, loading: authLoading } = useAuth();
	const [period, setPeriod] = useState("month");
	const [timeframe, setTimeframe] = useState("current");
	const [selectedUser, setSelectedUser] = useState(null);
	const openerRef = useRef(null);
	const { data, error: loadError, loading: queryLoading, refresh } = useLeaderboardResource(
		signedInUser?._id || signedInUser?.id, period, timeframe, !authLoading && Boolean(signedInUser),
	);
	const loading = authLoading || queryLoading;
	const error = data === undefined && loadError ? (loadError.message === "signIn" ? "signIn" : "loadError") : null;
	const withCurrentAvatar = profile => profile?.isCurrentUser && signedInUser
		? { ...profile, avatar: signedInUser.avatar || profile.avatar, photo: signedInUser.photo || profile.photo }
		: profile;
	const leaderboard = (data?.leaderboard ?? []).map(withCurrentAvatar);
	const currentUser = withCurrentAvatar(data?.currentUser);
	const rows = [...leaderboard];
	// Keep a personal row for users outside the top ten and unranked users.
	if (currentUser && !rows.some(user => user.id === currentUser.id)) rows.push(currentUser);

	const format = value => new Intl.NumberFormat(locale).format(value);
	const activePeriod = t(period === "month" ? (timeframe === "current" ? "thisMonth" : "lastMonth") : (timeframe === "current" ? "thisWeek" : "lastWeek"));

	function changePeriod(nextPeriod) {
		setPeriod(nextPeriod);
		setTimeframe("current");
	}

	function openProfile(user, event) {
		openerRef.current = event.currentTarget;
		setSelectedUser(user);
	}

	const closeProfile = useCallback(() => {
		setSelectedUser(null);
		requestAnimationFrame(() => openerRef.current?.focus());
	}, []);

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

				{authLoading ? (
					<p className={styles.statusMessage} role="status">{t("loading")}</p>
				) : !signedInUser ? (
					<RankGuestView t={t} />
				) : <>
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
								{currentUser.nextLevelTotalXp === null ? <span>{t("maxLevel")}</span> : <span>{format(currentUser.currentLevelXp)} / {format(currentUser.nextLevelXp)} KN</span>}
							</div>
						</> : <div className={styles.levelProgress} aria-hidden="true" />}
					</RankSummaryCard>
				</div>

				<RankPeriodSwitch period={period} timeframe={timeframe} onPeriodChange={changePeriod} onTimeframeChange={setTimeframe} t={t} />
				<div aria-live="polite" aria-busy={loading}>
					{loading && <p className={styles.statusMessage} role="status">{t("loading")}</p>}
					{error && <div className={styles.statusMessage} role="alert"><p>{t(error)}</p><button type="button" onClick={() => void refresh(true).catch(() => {})}>{t("retry")}</button></div>}
					{data && leaderboard.length === 0 && <p className={styles.statusMessage}>{t("empty")}</p>}
					{currentUser && <p className="sr-only">{t("results", { period: activePeriod, rank: currentUser.rank ?? t("unranked") })}</p>}
				</div>

				<section aria-label={t("topThree")} className={styles.podium}>
					{[leaderboard[1], leaderboard[0], leaderboard[2]].filter(Boolean).map(user => <RankTopCard key={user.id} user={user} t={t} format={format} onOpenProfile={openProfile} />)}
				</section>

				<section aria-label={t("leaderboard")} className={styles.leaderboardPanel}>
					<table className={styles.leaderboard}>
						<caption className="sr-only">{t("leaderboard")} — {activePeriod}</caption>
						<thead><tr><th scope="col">#</th><th scope="col">{t("user")}</th><th scope="col">{t("level")}</th><th scope="col">{t("streak")}</th><th scope="col">{t(period === "week" ? "weekKn" : "monthKn")}</th></tr></thead>
						<tbody>{rows.map(user => <LeaderboardRow key={user.id} user={user} t={t} format={format} onOpenProfile={openProfile} />)}</tbody>
					</table>
				</section>
				</>}
			</div>
			{signedInUser && selectedUser && <RankProfilePopup key={selectedUser.id} selectedUser={selectedUser}
				onClose={closeProfile} t={t} format={format} />}
		</main>
	);
}
