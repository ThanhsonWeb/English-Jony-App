const express = require("express");
const authRouter = require("./routes/authRoutes.js");
const userRouter = require("./routes/userRoutes.js");
const vocabRouter = require("./routes/vocabRoutes.js");
const AppError = require("./utils/appError.js");
const globalErrorHandler = require("./controllers/errorController.js");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const cors = require("cors");

const app = express();
const limiter = rateLimit({
	max: 100,
	windowMs: 60 * 60 * 1000, // 1 hour
	message: "Too many requests, try again later.",
});
// Global Middleware
app.use(helmet());
app.use(cors());
app.use("/api", limiter);

app.use(express.json());
app.use(compression());
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});


app.use(hpp());

// routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/vocab", vocabRouter);

// Route doesn't exist
app.all("/*splat", (req, res, next) => {
	next(new AppError(`Can't find ${req.originalUrl} route ! `, 404));
});

app.use(globalErrorHandler);

module.exports = app;
