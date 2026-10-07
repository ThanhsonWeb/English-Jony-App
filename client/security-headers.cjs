// Staged CSP: static hydration/theme scripts and inline styles need unsafe-inline.
// Production has no eval, wildcard hosts, or general https: allowance.
function securityHeaders(development = process.env.NODE_ENV === "development") {
	const csp = [
		"default-src 'self'",
		`script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client https://va.vercel-scripts.com`,
		"style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
		"img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com",
		"font-src 'self'",
		`connect-src 'self' https://accounts.google.com/gsi/ https://vitals.vercel-insights.com${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
		"media-src 'self' blob: https://api.dictionaryapi.dev https://ssl.gstatic.com",
		"frame-src https://accounts.google.com/gsi/",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join("; ");
	return [
		{ key: "Content-Security-Policy", value: csp },
		{ key: "X-Frame-Options", value: "DENY" },
		{ key: "X-Content-Type-Options", value: "nosniff" },
		{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	];
}

module.exports = { securityHeaders };
