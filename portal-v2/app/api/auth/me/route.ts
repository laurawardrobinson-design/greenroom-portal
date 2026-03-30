import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

export async function GET() {
  try {
    const user = await getAuthUser();
    return Response.json(user);
  } catch (error) {
    return authErrorResponse(error);
  }
}
