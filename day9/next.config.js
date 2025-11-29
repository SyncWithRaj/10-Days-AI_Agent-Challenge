// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  reactStrictMode: true,

  // FORCE DISABLE TURBOPACK ENTIRELY
  compiler: {
    // Forces Webpack compiler instead of Turbopack
    webp: false,
  },

  // This forces Webpack by telling Next.js
  // to NOT use Rust/Turbopack compiler
  experimental: {
    turbotrace: false,
    serverMinification: false,
    optimizeCss: false,
  },

  // Critical: prevents Turbopack from being used
  turbopack: {
    // This is how you silence & disable Turbopack
    enabled: false
  },
});
