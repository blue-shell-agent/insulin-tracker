"use client";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Let middleware handle the redirect based on auth/role
    window.location.href = "/dashboard";
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}
