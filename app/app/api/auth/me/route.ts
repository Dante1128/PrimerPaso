import { getSessionUser, pasoPendiente } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ user: null });
  return Response.json({ user: { ...user, pasoPendiente: pasoPendiente(user) } });
}
