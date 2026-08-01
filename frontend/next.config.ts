import type { NextConfig } from 'next';

/**
 * Origin of the Express backend, as seen from the Next.js *server*.
 * Locally that is the dev server on port 5000; in a container deployment it is
 * the service name (e.g. http://backend:5000). Browser traffic never uses this
 * directly — it calls the same-origin /api path below, which is rewritten here.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
