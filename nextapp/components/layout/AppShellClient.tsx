"use client"
import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import { fetchHealth } from "@/lib/api"

export default function AppShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [listingsCount, setListingsCount] = useState<number | null>(null)

  useEffect(() => {
    fetchHealth().then((h) => setListingsCount(h.listings_loaded)).catch(() => {})
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar pathname={pathname} listingsCount={listingsCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="w-full max-w-[1520px] flex-1 p-7">{children}</main>
      </div>
    </div>
  )
}
