import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowRight,
  Check,
  CheckSquare,
  FileText,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  useProjects,
  useWorkspace,
} from '@/data'
import { modKey } from './store'
import { useWorkspaceUI } from './workspace'
import { contentText, searchRank } from '@/data/text'

export function SearchResults({
  query,
  onSelect,
  selected = -1,
}: {
  query: string
  onSelect?: () => void
  selected?: number
}) {
  const { pages, tasks } = useWorkspace(
    useShallow((s) => ({ pages: s.pages, tasks: s.tasks })),
  )
  const projects = useProjects()
  const q = query.toLowerCase().trim()
  const results = useMemo(
    () =>
      [
        ...pages
          .filter((p) => !p.deletedAt)
          .map((p) => ({
            id: p.id,
            title: p.title || 'Untitled',
            body: contentText(p.content || p.blocks),
            type: 'Page',
            to: `/p/${p.id}`,
            icon: FileText,
          })),
        ...projects.map((p) => ({
          id: p.id,
          title: p.name,
          body: p.description,
          type: 'Project',
          to: `/projects/${p.id}/table`,
          icon: FileText,
        })),
        ...tasks
          .filter((t) => !t.deletedAt)
          .map((t) => ({
            id: t.id,
            title: t.title,
            body: `${t.notes} ${(t.labels || []).join(' ')}`,
            type: 'Task',
            to: `/projects/${t.projectId}/table?task=${encodeURIComponent(t.id)}`,
            icon: CheckSquare,
          })),
      ]
        .map((result) => ({
          ...result,
          rank: searchRank(q, result.title, result.body),
        }))
        .filter((result) => Number.isFinite(result.rank))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, q ? 12 : 5),
    [pages, tasks, projects, q],
  )
  return (
    <div className="search-results">
      {results.map((result, i) => (
        <Link
          data-search-result
          data-selected={selected === i}
          className="search-result"
          key={`${result.type}-${result.id}`}
          to={result.to}
          onClick={onSelect}
        >
          <result.icon size={17} />
          <span>
            <strong>{result.title}</strong>
            <span className="small muted">
              {result.type} · SingBuild Workspace
            </span>
          </span>
          <ArrowRight size={14} />
        </Link>
      ))}
      {!results.length && (
        <p className="quiet-empty">
          No results for “{query}”. Try a different word.
        </p>
      )}
    </div>
  )
}
export function SearchPage() {
  const [query, setQuery] = useState('')
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1 className="t-title">Search</h1>
          <p className="muted">Find a thought, a task, or your next plan.</p>
        </div>
      </header>
      <label className="search-field search-page-field">
        <Search size={20} />
        <input
          aria-label="Search workspace"
          placeholder="Search your workspace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      <SearchResults query={query} />
    </div>
  )
}
function CommandPalette() {
  const { commandOpen, setCommandOpen } = useWorkspaceUI()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const addTask = useWorkspace((s) => s.addTask)
  useEffect(() => {
    if (commandOpen) {
      setQuery('')
      setSelected(0)
    }
  }, [commandOpen])
  return (
    <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className="command-palette glass"
          data-material="thick"
          onKeyDown={(e) => {
            const results = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                '[data-search-result]',
              ),
            )
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setSelected((i) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    i + (e.key === 'ArrowDown' ? 1 : -1),
                  ),
                ),
              )
            }
            if (
              e.key === 'Enter' &&
              document.activeElement?.tagName === 'INPUT'
            ) {
              e.preventDefault()
              results[selected]?.click()
            }
          }}
        >
          <Dialog.Title className="sr-only">Search and commands</Dialog.Title>
          <div className="command-input">
            <Search size={21} />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(0)
              }}
              placeholder="Search pages, tasks, and projects…"
              aria-label="Search and commands"
            />
            <Dialog.Close className="kbd">Esc</Dialog.Close>
          </div>
          <div className="command-body">
            <span className="eyebrow">
              {query ? 'RESULTS' : 'JUMP BACK IN'}
            </span>
            <SearchResults
              query={query}
              selected={selected}
              onSelect={() => setCommandOpen(false)}
            />
            {!query && (
              <>
                <div className="menu-sep" />
                <span className="eyebrow">QUICK ACTIONS</span>
                {[
                  {
                    label: 'Create a new task',
                    icon: CheckSquare,
                    run: () => { const id = addTask({ title: 'New task', projectId: 'website' }); const task = useWorkspace.getState().tasks.find((t) => t.id === id)!; navigate(`/projects/${task.projectId}/table?task=${id}`) },
                  },
                ].map((action) => (
                  <button
                    className="command-action"
                    key={action.label}
                    onClick={() => {
                      setCommandOpen(false)
                      action.run()
                    }}
                  >
                    <action.icon size={16} />
                    {action.label}
                  </button>
                ))}
              </>
            )}
          </div>
          <footer>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> to navigate
            </span>
            <span>
              <kbd>↵</kbd> to open
            </span>
            <span>{modKey()} K to search</span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function WorkspaceOverlays() {
  const storageError = useWorkspace((s) => s.storageError)
  const scope = useWorkspace((s) => s.scope)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  // Cloud users still have network saves even without localStorage;
  // only show the persistent banner when the guest has no fallback at all.
  const showBanner = storageError && !bannerDismissed
  return (
    <>
      <CommandPalette />
      {showBanner && (
        <div className="storage-banner" role="alert">
          <span>
            {scope !== 'guest'
              ? 'Local recovery storage is unavailable. Online cloud saves can continue; download a backup of pending edits before closing this tab.'
              : 'Could not save to this device. Keep this tab open or your unsaved changes will be lost.'}
          </span>
          <button className="storage-banner-dismiss" aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>
            <X size={14} />
          </button>
        </div>
      )}
      <WorkspaceToast />
    </>
  )
}

function WorkspaceToast() {
  const toast = useWorkspaceUI((s) => s.toast)
  return (
    <>
      {toast && (
        <div
          className="workspace-toast glass"
          data-material="thick"
          role="status"
        >
          <Check size={16} />
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.()
                useWorkspaceUI.setState({ toast: null })
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => useWorkspaceUI.setState({ toast: null })}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
