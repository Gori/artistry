import type { Metadata } from "next";
import { Lexend_Deca } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const lexend = Lexend_Deca({
  subsets: ["latin"],
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Artistry",
  description: "Song management for creative teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={lexend.variable}>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
