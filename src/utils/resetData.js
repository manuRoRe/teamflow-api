import { copyFile } from "node:fs/promises";
import path from "node:path";
import { dataPath } from "./fileStorage.js";

const seedPath = path.join(dataPath, "traffic-store.seed.json");
const storePath = path.join(dataPath, "traffic-store.json");

await copyFile(seedPath, storePath);
console.log("Datos restaurados correctamente.");
