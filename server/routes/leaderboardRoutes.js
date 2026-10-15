const express = require("express");
const { protect } = require("../controllers/authController");
const { getLeaderboard, getPublicProfile } = require("../controllers/leaderboardController");

const router = express.Router();
router.use(protect);
router.get("/", getLeaderboard);
router.get("/users/:userId", getPublicProfile);

module.exports = router;
