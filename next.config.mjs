/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.139.23',
    '192.168.139.*',
    '192.168.139.98',
    '192.168.139.179',
    '192.168.1.*',
    '192.168.0.*',
    '10.0.*',
    '172.16.*',
  ],
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
