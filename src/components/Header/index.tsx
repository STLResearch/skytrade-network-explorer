import { Container } from "@/components/Container"
import clsx from "clsx"
import Link from "next/link"
import { DesktopNavigation } from "./DesktopNavigation"
import { MobileNavigation } from "./MobileNavigation"

function Logo({ className, ...props }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Home"
      className={clsx(className, "pointer-events-auto")}
      {...props}
    >
      <div className="group flex items-center gap-2">
        <div className="text-lg tracking-tight text-zinc-300 transition group-hover:text-zinc-700 dark:text-zinc-200 group-hover:dark:text-zinc-100 sm:text-xl">
          SkyTrade Explorer
        </div>
      </div>
    </Link>
  )
}

export function Header(props: { toggleTab: () => void | undefined }) {
  return (
    <header className="fixed bottom-auto z-50 h-24 pt-6">
      <Container className="fixed w-full">
        <div className="relative flex gap-4 rounded-xl bg-white/30 px-4 py-2 text-sm font-medium text-zinc-800 shadow-lg shadow-zinc-800/5 ring-1 ring-zinc-900/5 backdrop-blur-sm dark:bg-zinc-800/30 dark:text-zinc-200 dark:ring-white/10">
          <div className="flex flex-1 items-center">
            <Logo />
          </div>
          <div className="flex-2 flex justify-end md:justify-center">
            <MobileNavigation className="pointer-events-auto md:hidden" />
            <DesktopNavigation className="pointer-events-auto hidden md:block" />
          </div>
          <div className="flex justify-end gap-4 md:flex-1"></div>
        </div>
      </Container>
    </header>
  )
}
