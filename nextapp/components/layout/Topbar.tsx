"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/context/ThemeContext"
import { Search, Layers, Heart, Sun, Moon, ChevronDown } from "lucide-react"
import { Button } from "../ui/button"

export default function Topbar() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [q, setQ] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="flex h-[64px] shrink-0 items-center gap-4 border-b border-border bg-card px-7">
      <form onSubmit={submit} className="flex max-w-[420px] flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kërko zona, lagje ose prona…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">/</kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" title="Krahaso prona (së shpejti)" type="button">
          <Layers className="h-4 w-4" />
          Krahaso
        </Button>
        <Button variant="ghost" size="sm" title="Të preferuarat (së shpejti)" type="button">
          <Heart className="h-4 w-4" />
          Të preferuarat
        </Button>

        <Button variant="outline" size="icon" onClick={toggleTheme} title="Ndrysho pamjen" type="button">
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <button className="flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-muted-foreground hover:bg-accent" type="button">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            A
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  )
}
