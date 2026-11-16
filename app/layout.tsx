import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
export const metadata = { title: { default: "AIDeck | Your connected workspace", template: "%s | AIDeck" }, description: "Your Grant Thornton AI Department applications, together in one workspace." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("gt-theme");if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();` }} /></head><body className={geist.variable}>{children}</body></html>;
}
