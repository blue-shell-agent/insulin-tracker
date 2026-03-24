import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-middleware";

export default async function Home() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  redirect("/dashboard");
}
