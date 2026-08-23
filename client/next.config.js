/** @type {import("next").NextConfig} */

const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.js");

const nextConfig = {
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