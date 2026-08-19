const AppError = require("../utils/appError");

const handleDuplicatedFieldDB = (err) => {
	const value = err.keyValue.email;
	const message = `Email "${value}" đã được sử dụng, vui lòng chọn email khác!`;
	return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
	const errors = Object.values(err.errors).map((el) => el.message);
	const message = `Dữ liệu không hợp lệ: ${errors.join(". ")}`;
	return new AppError(message, 400);
};

const sendErrorDev = (err, res) => {
	res.status(err.statusCode).json({
		status: err.status,
		message: err.message,
		error: err,
		stack: err.stack,
	});
};

const sendErrorProd = (err, res) => {
	res.status(err.statusCode).json({
		status: err.status,
		message: err.message,
	});
};

const globalErrorHandler = (err, req, res, next) => {
	err.statusCode = err.statusCode || 500;
	err.status = err.status || "error";

	if (process.env.NODE_ENV === "development") {
		sendErrorDev(err, res);
	} else if (process.env.NODE_ENV === "production") {
		let error = err;
		if (error.code === 11000) error = handleDuplicatedFieldDB(err);
		if (error.name === "ValidationError") error = handleValidationErrorDB(err);
		sendErrorProd(error, res);
	}
};

module.exports = globalErrorHandler;
