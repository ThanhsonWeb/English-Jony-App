const express = require("express");
const { getAllVocab } = require("../controllers/vocabController");
const { protect } = require("../controllers/authController");

const router = express.Router();

// routes
router.route("/").get(protect, getAllVocab);
router.route("/").post(protect, getAllVocab);

module.exports = router;
