/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: false,
  productionBrowserSourceMaps: false,
  // Impede webpack de bundlar esses pacotes no chunk do servidor.
  // Ficam como require() nativo em runtime — carregados só quando chamados.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'openai', 'googleapis'],
  // Skip TSC and ESLint during Docker build — saves ~400MB peak RAM.
  // Type errors are caught in development, not at deploy time.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    instrumentationHook: true,
    // Reduce memory during build trace collection
    outputFileTracingExcludes: {
      '**': [
        'node_modules/@swc/**',
        'node_modules/@esbuild/**',
        'node_modules/sharp/**',
        'node_modules/rollup/**',
        'node_modules/webpack/**',
        'node_modules/terser/**',
        'node_modules/uglify-js/**',
        'node_modules/typescript/**',
        'node_modules/eslint/**',
        'node_modules/@typescript-eslint/**',
        'node_modules/jest/**',
        'node_modules/ts-jest/**',
        'node_modules/@jest/**',
        'node_modules/puppeteer/**',
        'node_modules/playwright/**',
        'node_modules/chromium/**',
        'node_modules/pdfjs-dist/**',
        'node_modules/canvas/**',
        'node_modules/node-gyp/**',
      ],
    },
  },
  webpack: (config) => {
    // Disable source maps entirely during build to cut peak memory ~30%
    config.devtool = false;
    return config;
  },
  // Configuração para subdomínios
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || 'https://zaapply.com.br' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
