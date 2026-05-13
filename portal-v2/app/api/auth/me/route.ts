import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

export async function GET() {
  try {
    const user = await getAuthUser();
    // Never HTTP-cache identity. The browser's disk cache outlives a session
    // and would serve the previous role's response after a dev-login switch
    // (e.g. click HOP, still see Producer). SWR's dedupingInterval throttles
    // refetch within a page, which is enough.
    return Response.json(user, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
