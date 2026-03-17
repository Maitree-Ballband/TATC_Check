/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  // Allow geolocation for check-in; block camera/microphone
  { key: 'Permissions-Policy',      value: 'geolocation=(self), camera=(), microphone=()' },
]

const nextConfig = {
  // output: 'standalone',  // enable for Docker / self-hosted deployment

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
