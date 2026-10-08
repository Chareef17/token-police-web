import type { NextConfig } from 'next';
// Pages visited in the last 5 minutes are reused on back/forward and menu navigation.
const config: NextConfig = { serverExternalPackages: ['@libsql/client'], poweredByHeader: false, experimental: { staleTimes: { dynamic: 300, static: 300 } } };
export default config;
