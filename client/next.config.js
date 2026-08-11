/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // When frontend calls /api/v1/..., route it to the backend
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`, 
      },
    ];
  },
};

module.exports = nextConfig;