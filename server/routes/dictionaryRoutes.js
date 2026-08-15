const express = require("express");
const { lookupWord } = require("../controllers/dictionaryController");
const { protect } = require("../controllers/authController");

const router = express.Router();

router.get("/:word", protect, lookupWord);

module.exports = router;