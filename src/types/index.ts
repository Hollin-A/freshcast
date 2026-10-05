// Extend NextAuth session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

// Keep this file a module so the declaration above augments next-auth
// rather than replacing it.
export {};
