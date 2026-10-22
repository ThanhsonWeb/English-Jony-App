const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { assertMobileLoginReady } = require("../utils/mobileLoginReadiness");

const collection = "mobileloginwindows";
const database = "mobile_readiness_fixture";
const idIndex = { name: "_id_", key: { _id: 1 } };
const ttlIndex = { name: "expiresAt_1", key: { expiresAt: 1 }, expireAfterSeconds: 0 };
const privilege = { resource: { db: database, collection }, actions: ["find", "insert", "update"] };

function fixture({ collections = [{ name: collection, type: "collection" }], indexes = [idIndex, ttlIndex], privileges = [privilege], users = [{ user: "fixture" }] } = {}) {
	return {
		databaseName: database,
		listCollections: (filter, options) => {
			assert.deepEqual(filter, { name: collection }); assert.deepEqual(options, { nameOnly: false });
			return { toArray: async () => collections };
		},
		runCursorCommand: command => {
			assert.deepEqual(command, { listIndexes: collection, includeBuildUUIDs: true, cursor: {} });
			return { toArray: async () => indexes };
		},
		command: async command => {
			assert.deepEqual(command, { connectionStatus: 1, showPrivileges: true });
			return { authInfo: { authenticatedUsers: users, authenticatedUserPrivileges: privileges } };
		},
	};
}

test("readiness only inspects metadata and effective privileges, without models or writes", async () => {
	await assertMobileLoginReady(fixture());
});

test("missing, unfinished, partial or incorrect indexes cannot pass readiness", async () => {
	for (const indexes of [[], [ttlIndex], [idIndex],
		[idIndex, { ...ttlIndex, expireAfterSeconds: 900 }],
		[idIndex, { ...ttlIndex, expireAfterSeconds: undefined }],
		[idIndex, { ...ttlIndex, key: { expiresAt: 1, attempts: 1 } }],
		[idIndex, { ...ttlIndex, key: { expiresAt: -1 } }],
		[idIndex, { spec: ttlIndex, buildUUID: "unfinished" }],
		[idIndex, { ...ttlIndex, buildUUID: "unfinished" }],
		...["hidden", "sparse", "unique", "prepareUnique"].map(option => [idIndex, { ...ttlIndex, [option]: true }]),
		[idIndex, { ...ttlIndex, partialFilterExpression: { attempts: { $gt: 1 } } }],
	]) await assert.rejects(assertMobileLoginReady(fixture({ indexes })), /Mobile login database readiness failed/);
});

test("missing collections, views, capped collections and restrictive validators fail safely", async () => {
	for (const collections of [[], [{ name: collection, type: "view" }],
		...[{ capped: true }, { timeseries: {} }, { validator: { attempts: { $lt: 5 } } }]
			.map(options => [{ name: collection, type: "collection", options }]),
	]) await assert.rejects(assertMobileLoginReady(fixture({ collections })));
});

test("effective grants must cover every counter action on the actual collection", async () => {
	for (const resource of [{ db: database, collection }, { db: database, collection: "" },
		{ db: "", collection }, { db: "", collection: "" }, { anyResource: true },
	]) await assertMobileLoginReady(fixture({ privileges: [{ ...privilege, resource }] }));
	await assertMobileLoginReady(fixture({ privileges: privilege.actions.map(action => ({ ...privilege, actions: [action] })) }));
	await assertMobileLoginReady(fixture({ privileges: [{ ...privilege, actions: ["anyAction"] }] }));
	for (const resource of [{ db: "another", collection }, { db: database, collection: "users" }, { cluster: true }, {}]) {
		await assert.rejects(assertMobileLoginReady(fixture({ privileges: [{ ...privilege, resource }] })));
	}
	for (const missing of privilege.actions) await assert.rejects(assertMobileLoginReady(fixture({
		privileges: [{ ...privilege, actions: privilege.actions.filter(action => action !== missing) }],
	})));
	for (const changed of [{ privileges: [] }, { privileges: undefined, users: [] }, { users: [] }]) {
		await assert.rejects(assertMobileLoginReady(fixture(changed)));
	}
});

test("inspection errors cannot leak connection data or permission documents", async t => {
	const logs = ["log", "warn", "error"].map(method => t.mock.method(console, method, () => {}));
	for (const method of ["listCollections", "runCursorCommand", "command"]) {
		const db = fixture(); db[method] = () => { throw new Error("synthetic-private-connection-details"); };
		await assert.rejects(assertMobileLoginReady(db), error => {
			assert.doesNotMatch(error.message, /synthetic-private/); assert.equal(error.cause, undefined); return true;
		});
	}
	assert.ok(logs.every(log => log.mock.callCount() === 0));
});

test("authenticated disposable MongoDB verifies least privileges, real indexes and deployment refusal", { timeout: 180000 }, async t => {
	// All accounts/passwords below exist only in a disposable local database.
	const rootPassword = "disposable-root-fixture-password";
	const userPassword = "disposable-counter-fixture-password";
	const mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" },
		auth: { enable: true, customRootName: "fixture-root", customRootPwd: rootPassword } });
	const connections = [];
	t.after(async () => { await Promise.all(connections.map(connection => connection.destroy())); await mongo.stop(); });
	async function connect(user, password, authSource) {
		const connection = mongoose.createConnection(mongo.getUri(database), {
			autoCreate: false, autoIndex: false, auth: { username: user, password }, authSource,
		});
		connections.push(connection); await connection.asPromise(); return connection;
	}
	const admin = await connect("fixture-root", rootPassword, "admin");
	await admin.db.createCollection(collection);
	await admin.db.collection(collection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	const actions = ["find", "insert", "update", "listIndexes"];
	const principal = async missing => {
		const name = missing ? `without-${missing}` : "counter-only";
		await admin.db.command({ createRole: name, privileges: [
			{ resource: { db: database, collection: "" }, actions: ["listCollections"] },
			{ resource: { db: database, collection }, actions: actions.filter(action => action !== missing) },
		], roles: [] });
		await admin.db.command({ createUser: name, pwd: userPassword, roles: [{ role: name, db: database }] });
		return connect(name, userPassword, database);
	};
	const application = await principal();
	await assertMobileLoginReady(application.db);
	assert.equal(await admin.db.collection(collection).countDocuments(), 0, "readiness created no probe rows");
	const model = application.model("MobileLoginWindow", require("../models/mobileLoginWindowModel").schema);
	assert.equal(model.schema.options.autoIndex, false); assert.equal(model.schema.options.autoCreate, false);
	await model.init();
	const counter = await model.findOneAndUpdate({ _id: "disposable-counter" }, {
		$inc: { attempts: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 600000) },
	}, { upsert: true, returnDocument: "after" });
	assert.equal(counter.attempts, 1);
	assert.equal((await model.findOneAndUpdate({ _id: counter.id }, { $inc: { attempts: 1 } }, { returnDocument: "after" })).attempts, 2);
	await assert.rejects(application.db.createCollection("unrelated"), { code: 13 });
	await assert.rejects(application.db.collection(collection).createIndex({ attempts: 1 }), { code: 13 });
	for (const missing of actions) await assert.rejects(assertMobileLoginReady((await principal(missing)).db));
	await admin.db.collection(collection).dropIndex("expiresAt_1");
	await assert.rejects(assertMobileLoginReady(application.db));
	await admin.db.collection(collection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 60 });
	await assert.rejects(assertMobileLoginReady(application.db));
	await admin.db.collection(collection).dropIndex("expiresAt_1");
	await admin.db.collection(collection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	await assertMobileLoginReady(application.db);
	// Exercise the actual deployment gate with this application principal.
	const { checkDatabase } = require("../scripts/check-deployment");
	const options = { loadConfig: () => ({ DATABASE: mongo.getUri(database) }),
		load: name => { assert.equal(name, "mongoose"); return { createConnection: () => ({
			asPromise: async () => {}, db: application.db, destroy: async () => {},
		}) }; },
	};
	await checkDatabase("unused", undefined, options);
	await admin.db.collection(collection).dropIndex("expiresAt_1");
	await assert.rejects(checkDatabase("unused", undefined, options), /Mobile login database readiness failed/);
});
