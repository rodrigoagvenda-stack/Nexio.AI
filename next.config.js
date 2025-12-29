/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Otimizações para build em ambientes com pouca memória
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Reduzir uso de memória durante build
  experimental: {
    // Limitar workers para reduzir uso de RAM
    workerThreads: false,
    cpus: 1,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dkvznmmiiiljyrkopiqx.supabase.co',
      },
    ],
  },

  // Configuração para subdomínios
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
