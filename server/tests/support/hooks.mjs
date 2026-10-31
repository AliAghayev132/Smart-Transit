/**
 * Node ESM loader hook (yalnız testlərdə): `#models` → in-memory model qatı, MongoDBService → saxta bağlantı.
 */
const MODELS = new URL("./memoryModels.js", import.meta.url).href;
const MONGO = new URL("./memoryMongo.js", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "#models") return { url: MODELS, shortCircuit: true };
  const r = await next(specifier, context);
  if (r.url.endsWith("/services/MongoDBService.js"))
    return { url: MONGO, shortCircuit: true };
  return r;
}
