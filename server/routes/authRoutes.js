const express = require("express");
const { signup, login } = require("../controllers/authController.js");

const router = express.Router();
// routes
router.route("/signup").post(signup);
router.route("/login").post(login);

module.exports = router;
