/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.139.98',
    '192.168.139.179',
    '192.168.1.*',
    '192.168.0.*',
    '10.0.*',
    '172.16.*',
  ],
};

export default nextConfig;
