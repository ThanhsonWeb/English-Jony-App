const express = require("express");
const authRouter = require("./routes/authRoutes.js");
const userRouter = require("./routes/userRoutes.js");
const AppError = require("./utils/appError.js");
const globalErrorHandler = require("./controllers/errorController.js");

const app = express();

// Global Middleware
app.use(express.json());

// routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
// Route doesn't exist
app.all("/*splat", (req, res, next) => {
	next(new AppError(`Can't find ${req.originalUrl} route ! `, 404));
});

app.use(globalErrorHandler);

module.exports = app;
