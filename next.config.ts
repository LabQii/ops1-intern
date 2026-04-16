/** @type {import('next').NextConfig} */
const nextConfig = {
  // Treat pdf-parse as an external package so Next.js doesn't try to bundle it.
  // Required for Vercel serverless compatibility.
  serverExternalPackages: ['pdf-parse'],

  // Turbopack config (used by Next.js 16+ dev server)
  turbopack: {
    resolveAlias: {
      // pdfjs-dist optionally requires 'canvas' — stub it out for Node.js serverless
      canvas: 'next/dist/client/components/not-found-error',
    },
  },

  // Webpack config (used by Vercel production builds / non-Turbopack builds)
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
