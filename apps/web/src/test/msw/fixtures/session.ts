import type { Session } from "next-auth";

/** A signed-in owner, for components under SessionProvider. */
export const session: Session = {
  user: { id: "user_1", email: "owner@example.com", name: "Sam Owner" },
  expires: "2099-01-01T00:00:00.000Z",
};
