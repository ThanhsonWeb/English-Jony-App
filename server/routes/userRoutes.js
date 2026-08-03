const express = require("express");
const { getAllUsers } = require("../controllers/userController");
const {
	protect,
	restrictTo,
	forgotPassword,
	resetPassword,
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
router.patch("/test", (req, res) => {
	res.send("working");
});

module.exports = router;
