import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export default async function loadEndpoints(dir, app) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const endpoints = [];

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      const subEndpoints = await loadEndpoints(fullPath, app);
      endpoints.push(...subEndpoints);
    } else if (file.isFile() && file.name.endsWith(".js")) {
      try {
        const module = (await import(pathToFileURL(fullPath))).default;

        if (typeof module.run === "function") {
          const routePath = "/api" + fullPath
            .replace(path.join(process.cwd(), "api"), "")
            .replace(/\.js$/, "")
            .replace(/\\/g, "/");

          const methods = module.methods || ["GET"];

          for (const method of methods) {
            app[method.toLowerCase()](routePath, (req, res) => 
              module.run(req, res)
            );
          }

          console.log(`• endpoint loaded: ${routePath} [${methods.join(", ")}]`);

          endpoints.push({
            name: module.name || path.basename(file.name, '.js'),
            description: module.description || "",
            category: module.category || "General",
            route: routePath,
            methods,
            params: module.params || [],
            paramsSchema: module.paramsSchema || {},
          });
        }
      } catch (error) {
        console.error(`Error loading endpoint ${fullPath}:`, error);
      }
    }
  }

  return endpoints;
}