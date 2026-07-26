import { readJsonFile, writeJsonFile } from "../utils/fileStorage.js";

const STORE_FILE = "traffic-store.json";
let mutationQueue = Promise.resolve();

export function readTrafficStore() {
  return readJsonFile(STORE_FILE);
}

export function mutateTrafficStore(mutator) {
  const operation = mutationQueue.then(async () => {
    const store = await readTrafficStore();
    const result = await mutator(store);
    await writeJsonFile(STORE_FILE, store);
    return result;
  });

  mutationQueue = operation.catch(() => undefined);
  return operation;
}
