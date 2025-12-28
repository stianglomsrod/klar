/** @type {import('postcss-load-config').Config} */
const config = {
plugins: {
  tailwindcss: {}, // ✅ Bruk denne (standard for v3)
  autoprefixer: {},
},
};

export default config;