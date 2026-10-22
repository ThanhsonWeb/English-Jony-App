// Read-only production checks. Never import a model or attempt index creation.
const COLLECTION = "mobileloginwindows";
const REQUIRED_ACTIONS = ["find", "insert", "update"];

function grantsCollection(resource, database) {
	return resource?.anyResource === true || (resource &&
		(resource.db === database || resource.db === "") &&
		(resource.collection === COLLECTION || resource.collection === ""));
}

function singleKey(index, field) {
	return index?.key && Object.keys(index.key).length === 1 && index.key[field] === 1;
}

function readyIndex(index) {
	return !index.buildUUID && !index.indexBuildInfo && !index.hidden &&
		!index.sparse && !index.partialFilterExpression;
}

function prerequisiteError(code) {
	return Object.assign(new Error("Mobile login prerequisite not ready"), { code });
}

async function assertMobileLoginReady(db, { runStage = (_stage, operation) => operation() } = {}) {
	try {
		await runStage("db.collection", async () => {
			const collections = await db.listCollections({ name: COLLECTION }, { nameOnly: false }).toArray();
			const collection = collections.find(item => item.name === COLLECTION);
			if (collection?.type !== "collection" || collection.options?.capped ||
				collection.options?.timeseries || Object.keys(collection.options?.validator || {}).length) {
				throw prerequisiteError("MOBILE_COLLECTION_NOT_READY");
			}
		});
		await runStage("db.indexes", async () => {
			// Plain listIndexes includes unfinished builds. The driver handles batches.
			const indexes = await db.runCursorCommand({
				listIndexes: COLLECTION, includeBuildUUIDs: true, cursor: {},
			}).toArray();
			const id = indexes.find(index => index.name === "_id_" && singleKey(index, "_id") && readyIndex(index));
			const ttl = indexes.find(index => singleKey(index, "expiresAt") && readyIndex(index) &&
				index.expireAfterSeconds === 0 && !index.unique && !index.prepareUnique);
			if (!id || !ttl) throw prerequisiteError("MOBILE_INDEXES_NOT_READY");
		});
		await runStage("db.permissions", async () => {
			// Inspect THIS connection's effective privileges; never write probe rows.
			const { authInfo } = await db.command({ connectionStatus: 1, showPrivileges: true });
			if (!authInfo?.authenticatedUsers?.length || !Array.isArray(authInfo.authenticatedUserPrivileges)) {
				throw prerequisiteError("MOBILE_PERMISSIONS_UNAVAILABLE");
			}
			const actions = new Set(authInfo.authenticatedUserPrivileges
				.filter(privilege => grantsCollection(privilege.resource, db.databaseName))
				.flatMap(privilege => privilege.actions || []));
			if (!actions.has("anyAction") && REQUIRED_ACTIONS.some(action => !actions.has(action))) {
				throw prerequisiteError("MOBILE_COUNTER_PERMISSIONS_MISSING");
			}
		});
	} catch {
		// Database errors can contain connection details. Only expose fixed text.
		throw new Error("Mobile login database readiness failed. Verify the collection, completed indexes and application database permissions.");
	}
}

module.exports = { assertMobileLoginReady };
