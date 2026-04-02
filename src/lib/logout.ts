export async function logout(router: { push: (path: string) => void }) {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  router.push("/login");
}
