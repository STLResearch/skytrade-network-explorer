"use client"

import { ThemeProvider } from "next-themes"
import { store } from "@/store/store"
import { Provider } from "react-redux"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class">{children}</ThemeProvider>
    </Provider>
  )
}
