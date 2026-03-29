import { readFileSync } from "node:fs";

export default {
  name: "version",
  description: "Show plugin version",
  execute: async () => JSON.parse(readFileSync(".claude-plugin/plugin.json", "utf8")).version,
};
