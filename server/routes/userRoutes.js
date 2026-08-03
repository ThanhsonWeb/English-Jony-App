const express = require("express");
const { getAllUsers } = require("../controllers/userController");
const { protect, restrictTo } = require("../controllers/authController");

// /api/v1/users
const router = express.Router();
// routes
router.route("/").get(protect, restrictTo("admin"), getAllUsers);

module.exports = router;
