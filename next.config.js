const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  // Impede webpack de bundlar esses pacotes no chunk do servidor.
  // Ficam como require() nativo em runtime — carregados só quando chamados.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'openai', 'googleapis'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Reduce memory during build trace collection
  outputFileTracingExcludes: {
    '**': [
      'node_modules/@swc/core/**',
      'node_modules/@swc/core-linux-x64-gnu/**',
      'node_modules/@swc/core-linux-x64-musl/**',
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
  webpack: (config) => {
    // Disable source maps entirely during build to cut peak memory ~30%
    config.devtool = false;
    return config;
  },
  async headers() {
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zaapply.com.br';
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseWss = supabaseUrl.replace(/^https/, 'wss');

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https: ${supabaseUrl}`,
      "font-src 'self' data:",
      `connect-src 'self' ${supabaseUrl} ${supabaseWss} https://api.mercadopago.com https://api.asaas.com https://sandbox.asaas.com https://sentry.io`,
      "media-src 'self' blob: https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          // CORS
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: appOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
          // Security headers
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  org: "zaapply",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  sourcemaps: { disable: true },
});
