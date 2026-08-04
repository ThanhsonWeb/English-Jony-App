const express = require("express");
const {
	getAllVocab,
	createNewVocab,
	getVocab,
	updateVocab,
	deleteVocab,
} = require("../controllers/vocabController");
const { protect } = require("../controllers/authController");

const router = express.Router();

// routes
router.route("/").get(protect, getAllVocab).post(protect, createNewVocab);

router
	.route("/:id")
	.get(protect, getVocab)
	.patch(protect, updateVocab)
	.delete(protect, deleteVocab);

module.exports = router;
