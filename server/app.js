const express = require("express");
// express
const app = express();

// Global Middleware
app.use(express.json());

// routes
app.get("/", (req, res) => {
	res.send("Backend is running!");
});

module.exports = app;
