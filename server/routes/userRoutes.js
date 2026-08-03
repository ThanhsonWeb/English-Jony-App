const express = require("express");
const { getAllUsers } = require("../controllers/userController");

const router = express.Router();

// routes
router.route("/").get(getAllUsers);

module.exports = router;
