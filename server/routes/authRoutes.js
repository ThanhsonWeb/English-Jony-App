const express = require("express");
const {
	signup,
	login,
	logout,
	createGoogleOAuthState,
	googleOAuthCallback,
} = require("../controllers/authController.js");

const router = express.Router();
// routes
router.get("/google/state", createGoogleOAuthState);
router.get("/google/callback", googleOAuthCallback);
router.route("/signup").post(signup);
router.route("/login").post(login);
router.post("/logout", logout);
module.exports = router;
