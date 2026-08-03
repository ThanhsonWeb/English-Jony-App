const express = require("express");
const { getAllUsers } = require("../controllers/userController");
const {
	protect,
	restrictTo,
	forgotPassword,
} = require("../controllers/authController");

// /api/v1/users
const router = express.Router();
// routes
router.route("/").get(protect, restrictTo("admin"), getAllUsers);
router.post("/forgotPassword", forgotPassword);
module.exports = router;
