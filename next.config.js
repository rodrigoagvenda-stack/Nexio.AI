/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: false,
  productionBrowserSourceMaps: false,
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
    // Reduce memory during build trace collection
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
        'node_modules/sharp',
        // Pacotes grandes carregados dinamicamente — não precisam ser copiados
        // para o bundle estático (são carregados sob demanda via require/import)
        'node_modules/pdfjs-dist',
      ],
    },
  },
  webpack: (config, { isServer }) => {
    // Disable source maps entirely during build to cut peak memory ~30%
    config.devtool = false;

    if (isServer) {
      // Manter googleapis como external (não bundlar) — 190 MB que só carrega ao usar Calendar
      // Já está em node_modules do standalone, carregado dinamicamente quando necessário
      const existing = config.externals || [];
      config.externals = [
        ...(Array.isArray(existing) ? existing : [existing]),
        ({ request }, callback) => {
          if (request === 'googleapis' || request?.startsWith('googleapis/')) {
            return callback(null, `commonjs ${request}`);
          }
          if (request === 'pdf-parse' || request === 'pdfjs-dist') {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }

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
