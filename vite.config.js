import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages needs the repository path; the Android app uses bundled relative assets.
  base: process.env.CAPACITOR_BUILD === "true" ? "./" : "/massawe-enterprise/",
  plugins: [react()]
});
