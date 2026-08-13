import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baddie Phyto",
  description: "Future Card Buddyfight online simulator"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
