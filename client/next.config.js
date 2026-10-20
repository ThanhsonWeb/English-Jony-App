/** @type {import("next").NextConfig} */

const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.js");
const { securityHeaders } = require("./security-headers.cjs");

const nextConfig = {
	// Keep the RSC rendering hint visible to proxy.js. Without this, Next
	// strips it before the proxy and every client navigation repeats /users/me.
	skipProxyUrlNormalize: true,
	images: { qualities: [75, 90] },
	async headers() {
		return [{ source: "/:path*", locale: false, headers: securityHeaders() }];
	},
	async rewrites() {
		return [
			{
				source: "/api/v1/:path*",
				destination: `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")}/api/v1/:path*`,
			},
		];
	},
};

module.exports = withNextIntl(nextConfig);
