import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route or controller as reachable without a session. The global
 * auth guard (#29) skips routes carrying this metadata.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
