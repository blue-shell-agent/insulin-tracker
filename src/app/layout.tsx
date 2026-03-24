import type { Metadata } from "next";
import "./globals.css";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: "Nivelo — Tu salud, bajo control",
  description: "Plataforma de seguimiento médico para pacientes",
  manifest: "/manifest.json",
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-gray-50 min-h-screen"><SwRegister />{children}</body>
    </html>
  );
}
