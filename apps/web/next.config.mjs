/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @wt/shared is published as raw TypeScript source; let Next transpile it.
  transpilePackages: ["@wt/shared"],
};

export default nextConfig;
