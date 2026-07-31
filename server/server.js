require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();

app.get("/", (req, res) => {
	res.send("Backend is running!");
});
// connect to mongoDB
mongoose
	.connect(process.env.DATABASE)
	.then(() => console.log("MongoDB Connected!"));
// start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
