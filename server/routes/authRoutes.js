const express = require("express");
const {
	signup,
	login,
	logout,
	googleLogin,
} = require("../controllers/authController.js");

const router = express.Router();
// routes
console.log("GOOGLE ROUTE FILE LOADED");
router.post("/google", googleLogin);
router.route("/signup").post(signup);
router.route("/login").post(login);
router.post("/logout", logout);
module.exports = router;
