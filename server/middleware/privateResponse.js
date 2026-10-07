module.exports = (req, res, next) => {
	res.set("Cache-Control", "private, no-store");
	next();
};
