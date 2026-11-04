import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { MOTIONS, PREF_COOKIES, TEXT_SIZES, THEMES, pick } from "@/lib/prefs/prefs";

export const metadata: Metadata = {
  title: { default: "Titan SOC Academy", template: "%s · Titan SOC Academy" },
  description: "Security operations training platform for Titan Protection & Consulting SOC operators.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceff4" },
    { media: "(prefers-color-scheme: dark)", color: "#04070d" },
  ],
};

// Resolves "system" theme before first paint so there is no light/dark flash.
const themeScript = `(function(){try{var d=document.documentElement;var p=d.getAttribute('data-theme-pref');if(p==='system'||!p){var m=window.matchMedia('(prefers-color-scheme: dark)');d.setAttribute('data-theme',m.matches?'dark':'light');m.addEventListener('change',function(e){if(d.getAttribute('data-theme-pref')==='system')d.setAttribute('data-theme',e.matches?'dark':'light');});}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = pick(THEMES, jar.get(PREF_COOKIES.theme)?.value, "system");
  const text = pick(TEXT_SIZES, jar.get(PREF_COOKIES.text)?.value, "standard");
  const motion = pick(MOTIONS, jar.get(PREF_COOKIES.motion)?.value, "system");
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? "dark" : theme}
      data-theme-pref={theme}
      data-text={text}
      data-motion={motion}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="titan-atmosphere">{children}</body>
    </html>
  );
}
