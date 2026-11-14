const accountDeletionRunner = require("./accountDeletionRunner");
const avatarCleanupWorker = require("./avatarCleanupWorker");

const ENABLE_ENV = "ACCOUNT_DELETION_SCHEDULER_ENABLED";
const AVATAR_CLEANUP_ENABLE_ENV = "ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED";
const DEFAULT_INTERVAL_MS = 60 * 1000;

// One scheduled cycle per Node process, even if multiple scheduler instances exist.
let scheduledRunInFlight = false;

function createAccountDeletionScheduler({
	runOnce = accountDeletionRunner.runAccountDeletionOnce,
	runAvatarCleanupBatch = options => avatarCleanupWorker.runAvatarCleanupBatch(options),
	intervalMs = DEFAULT_INTERVAL_MS,
	setIntervalImpl = setInterval,
	clearIntervalImpl = clearInterval,
	logger = console,
} = {}) {
	if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) {
		throw new RangeError("Account deletion scheduler interval must be a positive integer");
	}

	let timer = null;
	let avatarCleanupEnabled = false;

	async function runScheduledOnce() {
		if (scheduledRunInFlight) return { status: "skipped", reason: "run_in_progress" };
		scheduledRunInFlight = true;
		try {
			let cleanupFailed = false;
			if (avatarCleanupEnabled) {
				try {
					const counts = await runAvatarCleanupBatch({ deletingOnly: true });
					if (counts?.held > 0 || counts?.retry > 0) {
						try { logger.warn("Scheduled avatar cleanup requires attention", { held: counts.held, retry: counts.retry }); } catch {}
					}
				} catch {
					cleanupFailed = true;
					try { logger.error("Scheduled avatar cleanup failed"); } catch {}
				}
			}
			// A storage failure must not starve accounts that have no avatar to clean.
			const result = await runOnce();
			return cleanupFailed ? { status: "failed", phase: "avatar_cleanup", accountStatus: result?.status } : result;
		} catch (error) {
			// Do not expose database/account details, and do not let one failure stop later ticks.
			try {
				logger.error("Scheduled account deletion run failed", {
					errorName: error?.name || "Error",
				});
			} catch {}
			return { status: "failed" };
		} finally {
			scheduledRunInFlight = false;
		}
	}

	function start({ avatarCleanupEnabled: enabled = false } = {}) {
		if (timer !== null) return false;
		if (typeof enabled !== "boolean") throw new TypeError("Invalid avatar cleanup scheduler setting");
		avatarCleanupEnabled = enabled;
		timer = setIntervalImpl(() => { void runScheduledOnce(); }, intervalMs);
		timer?.unref?.();
		return true;
	}

	function stop() {
		if (timer === null) return false;
		clearIntervalImpl(timer);
		timer = null;
		return true;
	}

	return { start, stop, runScheduledOnce };
}

const defaultScheduler = createAccountDeletionScheduler();

function startConfiguredAccountDeletionScheduler({ env = process.env, scheduler = defaultScheduler } = {}) {
	if (env[ENABLE_ENV] !== "true") return false;
	return scheduler.start({ avatarCleanupEnabled: env[AVATAR_CLEANUP_ENABLE_ENV] === "true" });
}

module.exports = {
	createAccountDeletionScheduler,
	startConfiguredAccountDeletionScheduler,
	ENABLE_ENV,
	AVATAR_CLEANUP_ENABLE_ENV,
	DEFAULT_INTERVAL_MS,
};
