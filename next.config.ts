import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google/generative-ai', 'postgres'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
}

export default nextConfig
