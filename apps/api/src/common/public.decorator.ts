import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route or controller as reachable without a session. The global
 * SessionGuard skips routes carrying this metadata. In OpenAPI, an empty
 * security requirement overrides the document-wide session requirement.
 */
export const Public = () => applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiSecurity({}));
