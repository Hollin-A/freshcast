import { E2E_APP_ENV } from "./env.js";

// Runs in each test worker before the test file imports the app, so
// ConfigModule validates these values instead of apps/api/.env's.
Object.assign(process.env, E2E_APP_ENV);
