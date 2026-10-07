/** @type {import("next").NextConfig} */

const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.js");
const { securityHeaders } = require("./security-headers.cjs");

const nextConfig = {
	async headers() {
		return [{ source: "/:path*", locale: false, headers: securityHeaders() }];
	},
	async rewrites() {
		return [
			{
				source: "/api/v1/:path*",
				destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
			},
		];
	},
};

module.exports = withNextIntl(nextConfig);
