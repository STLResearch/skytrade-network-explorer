import { GAScript } from "@/components/GAScript"
import { GATracker } from "@/components/GATracker"
import { Header } from "@/components/Header"
import { HotspotsMap } from "@/components/HotspotsMap"
import { Providers } from "@/components/Providers"
import "@/styles/tailwind.css"
import "focus-visible"
import Head from "next/head"
import { Suspense } from "react"
import "react-tooltip/dist/react-tooltip.css"

export const metadata = {
  metadataBase: new URL("https://yourdomain.com"),
  title: "SkyTrade Explorer",
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/favicon-1.ico",
        type: "image/x-icon",
        sizes: "64x64 32x32 24x24 16x16",
      },
      {
        url: "/app-logo-dark.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        url: "/app-logo-dark.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
  },
  openGraph: {
    title: "Skytrade Network Explorer",
    description: "Skytrade Network explorer",
    url: "https://skytrade-network-explorer.vercel.app/",
    siteName: "Skytrade Network Explorer",
    images: [
      {
        url: "/app-logo-dark.png",
        width: 954,
        height: 696,
      },
    ],
    locale: "en-US",
    type: "website",
  },
}

export const viewport = {
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const toggleTab = () => {
    return
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="dns-prefetch" href="https://pmtiles.heliumfoundation.wtf/" />
      </Head>
      <body className="absolute inset-0 bg-zinc-50 dark:bg-black">
        <Providers>
          <GAScript />
          <Suspense>
            <GATracker />
          </Suspense>
          <Header toggleTab={toggleTab} />
          {children}
        </Providers>
      </body>
    </html>
  )
}
