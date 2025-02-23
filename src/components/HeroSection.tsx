import Link from "next/link"

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-4 py-20">
      <div className="relative z-10 mx-auto max-w-4xl space-y-6 text-center">
        <h1 className="text-5xl font-bold leading-tight text-[#7e9ce2] md:text-6xl lg:text-7xl">
          SkyTrade
          <br />
          Explorer
        </h1>
        <p className="mx-auto max-w-2xl text-xl text-[#1B396A] md:text-2xl">
          SkyTrade lets you monetize your air rights, the legal right to use and
          control the space above buildings and land.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/drone"
            className="inline-flex items-center rounded-lg bg-[#0066FF] px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600"
          >
            Drone Explorer
            <svg
              className="ml-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
          <Link
            href="/air_space"
            className="inline-flex items-center rounded-lg bg-[#0A2156] px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-[#0c2869]"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Air Space Explorer
            <svg
              className="ml-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
