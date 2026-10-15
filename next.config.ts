import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    // chromium.executablePath() locates bin/*.br through a runtime import.meta.url join the tracer cannot follow.
    '/api/pdf': ['./public/fonts/**', './public/sheet-assets/**', './node_modules/@sparticuz/chromium/bin/**'],
  },
  // fixtures/ holds real patient data (dev-only); it must never ship in any function bundle.
  outputFileTracingExcludes: { '/**': ['./fixtures/**'] },
  // Kept from the create-next-app scaffold: wires Tailwind v4 into Turbopack.
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};
export default nextConfig;
