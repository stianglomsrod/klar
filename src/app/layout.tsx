import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Klar",
  description: "Klar – læringsplattform for elever og lærere",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb">
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="skip-link"
        >
          Hopp til hovedinnhold
        </a>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
