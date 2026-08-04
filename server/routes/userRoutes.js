const express = require("express");
const { getAllUsers } = require("../controllers/userController");
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
router.use((req, res, next) => {
	console.log(req.method, req.originalUrl);
	next();
});
// routes
router.route("/").get(protect, restrictTo("admin"), getAllUsers);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);
router.patch("/updatePassword", protect, updatePassword);
router.patch("/updateMe", protect, updateMe);

module.exports = router;
