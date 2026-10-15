import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: { '/api/pdf': ['./public/fonts/**', './public/sheet-assets/**'] },
  // Kept from the create-next-app scaffold: wires Tailwind v4 into Turbopack.
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};
export default nextConfig;
