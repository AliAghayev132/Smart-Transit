import { register } from "node:module";

// Test mühiti: prodakşn deyil, demo alətləri açıq, AI, Gemini və Google açarları yoxdur (determinizm)
process.env.NODE_ENV = "test";
process.env.DEMO_ENABLED = "true";
process.env.OPENROUTER_API_KEY = "";
process.env.GOOGLE_ROUTES_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.WEATHER_ENABLED = "false"; // testlər şəbəkəyə çıxmır
process.env.SIM_ENABLED = "false";

register("./hooks.mjs", import.meta.url);
