const express = require("express");
const rateLimit = require("express-rate-limit");
const { getAllUsers, getMe, updateAvatar } = require("../controllers/userController");
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
const avatarLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 10,
	keyGenerator: (req) => String(req.user.id),
});
router.use((req, res, next) => {
	console.log(req.method, req.originalUrl);
	next();
});
// routes

router.get("/me", protect, getMe);
router.route("/").get(protect, restrictTo("admin"), getAllUsers);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);
router.patch("/updatePassword", protect, updatePassword);
router.patch("/updateMe", protect, updateMe);
router.patch(
	"/avatar",
	protect,
	avatarLimiter,
	express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "2mb" }),
	updateAvatar,
);

module.exports = router;
