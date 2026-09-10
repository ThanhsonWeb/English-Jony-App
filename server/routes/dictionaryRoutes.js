const express = require("express");
const { lookupWord } = require("../controllers/dictionaryController");

const router = express.Router();

router.get("/:word", lookupWord);

module.exports = router;
