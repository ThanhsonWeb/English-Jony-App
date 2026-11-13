require("dotenv").config();
const mongoose = require("mongoose");
const { assertAvatarStorageConfigured } = require("./services/avatarUpload");
const { startConfiguredAccountDeletionScheduler } = require("./services/accountDeletionScheduler");
process.on("uncaughtException", (err) => {
	console.error("UNCAUGHT EXCEPTION! 💥 Đang tắt server...");
	console.error(err.name, err.message, err.stack);
	// (unclean state -> exit right away ).
	process.exit(1);
});
// 2. Load file app after uncaughtException's protection
const app = require("./app");

assertAvatarStorageConfigured(process.env);

//-----------------------Connect to mongoDB------------
mongoose
	.connect(process.env.DATABASE)
	.then(() => {
		console.log("MongoDB Connected!");
		startConfiguredAccountDeletionScheduler();
	});
//------------------------start server----------------------
const port = process.env.PORT || 5000;
const server = app.listen(port, "127.0.0.1", () => {
	console.log(`Server running on port ${port}`);
});

//this listener function will run after any promise got error
process.on("unhandledRejection", (err) => {
	console.error(err.name, err.message, err.stack);
	// stop connect receive req from users and shutdown !
	server.close(() => {
		process.exit(1);
	});
});
