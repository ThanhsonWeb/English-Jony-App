const express = require("express");
const authRouter = require("./routes/authRoutes.js");
const userRouter = require("./routes/userRoutes.js");
const vocabRouter = require("./routes/vocabRoutes.js");
const topicRouter = require("./routes/topicRoutes.js");
const dictionaryRouter = require("./routes/dictionaryRoutes.js");
const AppError = require("./utils/appError.js");
const globalErrorHandler = require("./controllers/errorController.js");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const authLimiter = rateLimit({
	max: 10,
	windowMs: 60 * 60 * 1000,
});
const apiLimiter = rateLimit({
	max: process.env.NODE_ENV === "development" ? 1000 : 100, // Increase limit for local dev

	windowMs: 60 * 60 * 1000, // 1 hour
	message: "Too many requests, try again later.",
});
// Global Middleware
app.use(helmet());
app.use(
	cors({
		origin: process.env.FRONTEND_URL,
		// origin: "http://localhost:3000",
		credentials: true,
	}),
);
app.use(cookieParser());

app.use(express.json());
app.use(compression());
app.use((req, res, next) => {
	if (req.body) mongoSanitize.sanitize(req.body);
	if (req.params) mongoSanitize.sanitize(req.params);
	next();
});

app.use(hpp());

//   Register these route
app.use("/api/v1/auth", authLimiter, authRouter); // 10 request/hour
app.use("/api/v1/users", apiLimiter, userRouter);
app.use("/api/v1/vocab", apiLimiter, vocabRouter);
app.use("/api/v1/topics", apiLimiter, topicRouter);
app.use("/api/v1/dictionary", apiLimiter, dictionaryRouter);
// Route doesn't exist
app.all("/*splat", (req, res, next) => {
	next(new AppError(`Can't find ${req.originalUrl} route ! `, 404));
});

app.use(globalErrorHandler);

module.exports = app;
