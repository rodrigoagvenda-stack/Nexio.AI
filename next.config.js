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
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
        'node_modules/sharp',
        // googleapis é importado via await import() lazy (google-calendar.ts)
        // nft ainda o rastreia como dependência — excluir do standalone economiza ~190 MB em disco
        // ATENÇÃO: os routes /api/google/* importam googleapis estaticamente, então NÃO excluir
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
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
