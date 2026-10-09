import type { NextConfig } from 'next';
// Dynamic pages should read the latest committed database snapshot on navigation.
const config: NextConfig = { serverExternalPackages: ['@libsql/client'], poweredByHeader: false, experimental: { staleTimes: { dynamic: 0, static: 300 } } };
export default config;
