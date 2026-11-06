import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { IconSearch, IconLayers, IconHeart, IconSun, IconMoon, IconChevronDown } from '../icons/Icons'

export default function Topbar({ onSearch }) {
  const { theme, toggleTheme } = useTheme()
  const [q, setQ] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (q.trim()) onSearch(q.trim())
  }

  return (
    <header className="app-topbar">
      <form className="topbar-search" onSubmit={submit}>
        <IconSearch size={16} className="topbar-search-icon" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Kërko zona, lagje ose prona…"
        />
        <kbd>/</kbd>
      </form>

      <div className="topbar-actions">
        <button type="button" className="icon-pill" title="Krahaso prona (së shpejti)">
          <IconLayers size={16} />
          <span>Krahaso</span>
        </button>
        <button type="button" className="icon-pill" title="Të preferuarat (së shpejti)">
          <IconHeart size={16} />
          <span>Të preferuarat</span>
        </button>

        <button type="button" className="theme-switch" onClick={toggleTheme} title="Ndrysho pamjen">
          {theme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
        </button>

        <button type="button" className="avatar-chip">
          <span className="avatar-circle">A</span>
          <IconChevronDown size={13} />
        </button>
      </div>
    </header>
  )
}
