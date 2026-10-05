import { handlers } from "@/lib/auth";
import { withRequestLogging } from "@/lib/request-logging";

export const GET = withRequestLogging(handlers.GET);
export const POST = withRequestLogging(handlers.POST);
