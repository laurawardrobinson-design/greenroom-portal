import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

export async function GET() {
  try {
    const user = await getAuthUser();
    return Response.json(user, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
