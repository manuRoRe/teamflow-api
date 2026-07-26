import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dataPath = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");

export async function readJsonFile(fileName) {
  const filePath = path.join(dataPath, fileName);
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

export async function writeJsonFile(fileName, data) {
  await mkdir(dataPath, { recursive: true });
  const filePath = path.join(dataPath, fileName);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  await rename(temporaryPath, filePath);
}
