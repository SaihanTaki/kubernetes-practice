import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  pageExtensions: ["ts", "tsx", "mdx"],
};

// Plugins are passed by name so Turbopack can serialize the MDX options.
export default createMDX({ options: { remarkPlugins: [["remark-gfm"]] } })(nextConfig);
