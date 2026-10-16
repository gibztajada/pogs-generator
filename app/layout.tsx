import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POGS Generator",
  description: "Generate the VSMMC POGS Obstetrical Sheet",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Browser extensions (e.g. Testim) add attributes to <body> before hydration. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
