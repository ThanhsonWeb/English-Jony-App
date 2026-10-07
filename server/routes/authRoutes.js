const express = require("express");
const {
	signup,
	login,
	logout,
	createGoogleOAuthState,
	googleOAuthCallback,
	discardCredentialAttempt,
} = require("../controllers/authController.js");
const { requireCredentialAttempt } = require("../utils/credentialCookies");

const router = express.Router();
router.use(require("../middleware/privateResponse"));
// routes
router.get("/google/state", createGoogleOAuthState);
router.get("/google/callback", googleOAuthCallback);
// Separate routes fail safely against an older backend during deployment.
router.post("/credentials/login", requireCredentialAttempt, login);
router.post("/credentials/signup", requireCredentialAttempt, signup);
router.post("/credentials/discard", requireCredentialAttempt, discardCredentialAttempt);
router.route("/signup").post(signup);
router.route("/login").post(login);
router.post("/logout", logout);
module.exports = router;
