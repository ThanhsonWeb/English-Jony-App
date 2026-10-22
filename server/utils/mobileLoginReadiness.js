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

async function assertMobileLoginReady(db) {
	try {
		const collections = await db.listCollections({ name: COLLECTION }, { nameOnly: false }).toArray();
		const collection = collections.find(item => item.name === COLLECTION);
		if (collection?.type !== "collection" || collection.options?.capped ||
			collection.options?.timeseries || Object.keys(collection.options?.validator || {}).length) {
			throw new Error("Collection not ready");
		}
		// Plain listIndexes also includes unfinished builds. Request build UUIDs so
		// an in-progress index cannot satisfy readiness. The driver handles batches.
		const indexes = await db.runCursorCommand({
			listIndexes: COLLECTION, includeBuildUUIDs: true, cursor: {},
		}).toArray();
		const id = indexes.find(index => index.name === "_id_" && singleKey(index, "_id") && readyIndex(index));
		const ttl = indexes.find(index => singleKey(index, "expiresAt") && readyIndex(index) &&
			index.expireAfterSeconds === 0 && !index.unique && !index.prepareUnique);
		if (!id || !ttl) throw new Error("Indexes not ready");

		// Ask for the effective privileges of THIS connection, not a role name or
		// separate admin account. Inspection never writes a production probe row.
		const { authInfo } = await db.command({ connectionStatus: 1, showPrivileges: true });
		if (!authInfo?.authenticatedUsers?.length || !Array.isArray(authInfo.authenticatedUserPrivileges)) {
			throw new Error("Authenticated permissions unavailable");
		}
		const actions = new Set(authInfo.authenticatedUserPrivileges
			.filter(privilege => grantsCollection(privilege.resource, db.databaseName))
			.flatMap(privilege => privilege.actions || []));
		if (!actions.has("anyAction") && REQUIRED_ACTIONS.some(action => !actions.has(action))) {
			throw new Error("Counter permissions not ready");
		}
	} catch {
		// Database errors can contain connection details. Only expose fixed text.
		throw new Error("Mobile login database readiness failed. Verify the collection, completed indexes and application database permissions.");
	}
}

module.exports = { assertMobileLoginReady };
