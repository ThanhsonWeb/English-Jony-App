const express = require("express");
const { protect } = require("../controllers/authController");
const { getLeaderboard } = require("../controllers/leaderboardController");

const router = express.Router();
router.use(protect);
router.get("/", getLeaderboard);

module.exports = router;
