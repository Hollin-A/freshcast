import { setupServer } from "msw/node";
import { createHandlers } from "./handlers";

// Shared by component tests. Defaults to the onboarded scenario; switch with
// server.use(...createHandlers(empty)).
export const server = setupServer(...createHandlers());
