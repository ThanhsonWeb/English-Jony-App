const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("node:path");
const { getAllUsers, getMe, updateAvatar, updateTheme, updateLanguage, requestAccountDeletion } = require("../controllers/userController");
const { localAvatarDirectory } = require("../services/avatarUpload");
const { recoveryIpLimiter } = require("../middleware/recoveryRateLimit");
const {
	protect,
	restrictTo,
	forgotPassword,
	resetPassword,
	updatePassword,
	updateMe,
} = require("../controllers/authController");

// /api/v1/users
const router = express.Router();
router.use(require("../middleware/privateResponse"));
const accountDeletionLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 5,
	keyGenerator: req => String(req.user.id),
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: { status: "fail", message: "Too many account deletion requests. Please wait and try again." },
});
const requireAccountDeletionEnabled = (req, res, next) => {
	if (process.env.ACCOUNT_DELETION_REQUEST_ENABLED !== "true") return res.sendStatus(404);
	next();
};
const avatarLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 10,
	keyGenerator: (req) => String(req.user.id),
});
// routes

router.get("/me", protect, getMe);
router.patch("/theme", protect, updateTheme);
router.patch("/language", protect, updateLanguage);
router.get("/avatar-files/:filename", (req, res, next) => {
	if (process.env.NODE_ENV !== "development" ||
		!/^user_[0-9a-f]{24}_[0-9a-f-]{36}\.(jpg|png|webp)$/.test(req.params.filename)) {
		return res.sendStatus(404);
	}
	res.set("Cache-Control", "public, max-age=31536000, immutable");
	res.sendFile(path.join(localAvatarDirectory, req.params.filename), (error) => {
		if (error && !res.headersSent) next(error);
	});
});
router.route("/").get(protect, restrictTo("admin"), getAllUsers);
router.post("/forgotPassword", recoveryIpLimiter, forgotPassword);
router.patch("/resetPassword/:token", resetPassword);
router.patch("/updatePassword", protect, updatePassword);
router.post("/request-account-deletion", protect, requireAccountDeletionEnabled, accountDeletionLimiter, requestAccountDeletion);
router.patch("/updateMe", protect, updateMe);
router.patch(
	"/avatar",
	protect,
	avatarLimiter,
	express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "2mb" }),
	updateAvatar,
);

module.exports = router;
