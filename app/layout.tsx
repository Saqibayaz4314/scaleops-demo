import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ScaleOps Demo | AWS Auto Scaling Application",
  description:
    "A Next.js demo application deployed on AWS EC2 with Application Load Balancer and Auto Scaling Group — HacktoberFest 3.0",
  keywords: ["AWS", "Auto Scaling", "EC2", "Next.js", "Load Balancer"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
