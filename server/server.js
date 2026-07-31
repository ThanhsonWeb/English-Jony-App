require("dotenv").config();
const app = require("./app");
const mongoose = require("mongoose");

// connect to mongoDB
mongoose
	.connect(process.env.DATABASE)
	.then(() => console.log("MongoDB Connected!"));
// start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
