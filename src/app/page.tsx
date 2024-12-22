export const metadata = {
  title: "SkyTrade Network Explorer",
}
import HeroSection from "../components/HeroSection"

export default function Page() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <video
        autoPlay
        loop
        muted
        className="absolute left-0 top-0 h-full w-full object-cover"
      >
        <source src="/video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="relative z-10">
        <HeroSection />
      </div>
    </div>
  )
}
