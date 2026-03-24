export async function logout(router: { push: (path: string) => void }) {
  await fetch("/nivelo/api/auth/logout", { method: "POST", credentials: "include" });
  router.push("/login");
}
