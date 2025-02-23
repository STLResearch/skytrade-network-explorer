"use client"

export default function ClientVideo() {
  return (
    <video
      autoPlay
      loop
      muted
      className="absolute left-0 top-0 h-full w-full object-cover"
    >
      <source src="/video.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  )
}
