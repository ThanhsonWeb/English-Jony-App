const express = require("express");
const { signup } = require("../controllers/authController.js");

const router = express.Router();
// routes
router.route("/signup").post(signup);

module.exports = router;
