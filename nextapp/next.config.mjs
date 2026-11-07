/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Paths from the previous version keep working.
  async redirects() {
    return [
      { source: '/explore', destination: '/pronat', permanent: true },
      { source: '/map', destination: '/pronat?pamja=harta', permanent: true },
      { source: '/find', destination: '/pronat?pershkrim=1', permanent: true },
      { source: '/listings/:id', destination: '/pronat/:id', permanent: true },
      { source: '/predict', destination: '/vleresimi', permanent: true },
      { source: '/insights', destination: '/tregu', permanent: true },
    ]
  },
}
export default nextConfig
