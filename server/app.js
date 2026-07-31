const express = require("express");
const authRouter = require("./routes/authRoutes.js");
// express
const app = express();

// Global Middleware
app.use(express.json());

// routes
app.use("/api/v1/auth", authRouter);
app.get("/", (req, res) => {
	res.send("Backend is running!");
});

module.exports = app;
