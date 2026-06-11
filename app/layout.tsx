import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers/providers";

const inter = { variable: "--font-inter" }

export const metadata: Metadata = {
  title: "Rapid Wash Attendant ",
  description: "Rapid Wash Attendant Point of Sale System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
