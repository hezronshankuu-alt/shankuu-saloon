import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shankuu Salon | Book your beauty appointment",
  description: "Book braids, locs, lashes and beauty services at Shankuu Salon in Dodoma, Tanzania.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
