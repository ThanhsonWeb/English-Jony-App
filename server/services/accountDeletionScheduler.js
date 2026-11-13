const accountDeletionRunner = require("./accountDeletionRunner");

const ENABLE_ENV = "ACCOUNT_DELETION_SCHEDULER_ENABLED";
const DEFAULT_INTERVAL_MS = 60 * 1000;

function createAccountDeletionScheduler({
	runOnce = accountDeletionRunner.runAccountDeletionOnce,
	intervalMs = DEFAULT_INTERVAL_MS,
	setIntervalImpl = setInterval,
	clearIntervalImpl = clearInterval,
	logger = console,
} = {}) {
	if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) {
		throw new RangeError("Account deletion scheduler interval must be a positive integer");
	}

	let timer = null;
	let running = false;

	async function runScheduledOnce() {
		if (running) return { status: "skipped", reason: "run_in_progress" };
		running = true;
		try {
			return await runOnce();
		} catch (error) {
			// Do not expose database/account details, and do not let one failure stop later ticks.
			try {
				logger.error("Scheduled account deletion run failed", {
					errorName: error?.name || "Error",
				});
			} catch {}
			return { status: "failed" };
		} finally {
			running = false;
		}
	}

	function start() {
		if (timer !== null) return false;
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
	return scheduler.start();
}

module.exports = {
	createAccountDeletionScheduler,
	startConfiguredAccountDeletionScheduler,
	ENABLE_ENV,
	DEFAULT_INTERVAL_MS,
};
