import HeroSection from "../components/HeroSection"
import dynamic from "next/dynamic"

export const metadata = {
  title: "SkyTrade Network Explorer",
}

const ClientVideo = dynamic(() => import("../components/ClientVideo"), {
  ssr: false,
})

export default function Page() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <ClientVideo />
      <div className="relative z-10">
        <HeroSection />
      </div>
    </div>
  )
}
