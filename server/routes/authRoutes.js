const express = require("express");
const { signup, login, logout } = require("../controllers/authController.js");

const router = express.Router();
// routes
router.route("/signup").post(signup);
router.route("/login").post(login);
router.post("/logout", logout);
module.exports = router;
