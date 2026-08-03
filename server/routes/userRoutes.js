const express = require("express");
const { getAllUsers } = require("../controllers/userController");
const { protect } = require("../controllers/authController");

// /api/v1/users
const router = express.Router();
// routes
router.route("/").get(protect, getAllUsers);

module.exports = router;
