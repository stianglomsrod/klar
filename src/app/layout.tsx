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
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Hopp til hovedinnhold
        </a>
        <div id="main-content" tabIndex={-1} className="focus:outline-none">
          {children}
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
