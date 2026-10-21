import { useEffect, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import {
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FlaskConical,
  Folder,
  FolderOpen,
  Info,
  Layers,
  List,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { ObsidianDocState, ObsidianFile } from '../types/audit'
import {
  EMPTY_OBSIDIAN_STATE,
  SAMPLE_OBSIDIAN_FILES,
} from '../utils/obsidianStorage'
import { Button, FieldLabel, Kbd, TextInput, Toggle } from './ui'

interface ObsidianDocModalProps {
  open: boolean
  onClose: () => void
  vault: ObsidianDocState
  onSave: (vault: ObsidianDocState) => void
}

interface WebkitFileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
}

interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
  file: (success: (file: File) => void, error?: (err: unknown) => void) => void
}

interface WebkitFileSystemDirectoryReader {
  readEntries: (
    success: (entries: WebkitFileSystemEntry[]) => void,
    error?: (err: unknown) => void,
  ) => void
}

interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
  createReader: () => WebkitFileSystemDirectoryReader
}

/** Recursively scan an entry (file or directory) from webkitGetAsEntry */
async function scanFileSystemEntry(entry: WebkitFileSystemEntry): Promise<File[]> {
  if (
    entry.name.startsWith('.') ||
    entry.fullPath.includes('/.obsidian') ||
    entry.fullPath.includes('/.trash') ||
    entry.fullPath.includes('/.git') ||
    entry.fullPath.includes('/node_modules')
  ) {
    return []
  }

  if (entry.isFile) {
    const fileEntry = entry as WebkitFileSystemFileEntry
    return new Promise((resolve) => {
      fileEntry.file(
        (file) => {
          const lower = file.name.toLowerCase()
          if (!lower.endsWith('.md') && !lower.endsWith('.markdown') && !lower.endsWith('.txt')) {
            resolve([])
            return
          }
          const cleanPath = entry.fullPath.replace(/^\//, '')
          ;(file as { customPath?: string }).customPath = cleanPath
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: cleanPath,
              configurable: true,
            })
          } catch {
            /* ignore if browser prohibits overriding */
          }
          resolve([file])
        },
        () => resolve([]),
      )
    })
  }

  if (entry.isDirectory) {
    const dirEntry = entry as WebkitFileSystemDirectoryEntry
    const dirReader = dirEntry.createReader()

    const readAllEntries = async (): Promise<WebkitFileSystemEntry[]> => {
      const results: WebkitFileSystemEntry[] = []
      return new Promise((resolve) => {
        const readBatch = () => {
          dirReader.readEntries(
            (batch) => {
              if (!batch || batch.length === 0) {
                resolve(results)
              } else {
                results.push(...batch)
                readBatch()
              }
            },
            () => resolve(results),
          )
        }
        readBatch()
      })
    }

    const childEntries = await readAllEntries()
    const nested = await Promise.all(childEntries.map((c) => scanFileSystemEntry(c)))
    return nested.flat()
  }

  return []
}

/** Recursively read all files from a modern FileSystemDirectoryHandle (Chrome/Edge/Chromium) */
async function getFilesFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
): Promise<File[]> {
  const files: File[] = []
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      if (entry.kind === 'file') {
        const lower = entry.name.toLowerCase()
        if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
          try {
            const file = await (entry as FileSystemFileHandle).getFile()
            const relative = basePath ? `${basePath}/${entry.name}` : entry.name
            ;(file as { customPath?: string }).customPath = relative
            try {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: relative,
                configurable: true,
              })
            } catch {
              /* ignore */
            }
            files.push(file)
          } catch {
            /* ignore unreadable file */
          }
        }
      } else if (entry.kind === 'directory') {
        if (entry.name === '.obsidian' || entry.name === '.trash' || entry.name === '.git') continue
        const nextPath = basePath ? `${basePath}/${entry.name}` : entry.name
        const subFiles = await getFilesFromDirectoryHandle(entry as FileSystemDirectoryHandle, nextPath)
        files.push(...subFiles)
      }
    }
  } catch {
    /* ignore directory read error */
  }
  return files
}

/** Extract all files recursively from a DataTransfer object (drag and drop) */
async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items
  if (items && items.length > 0) {
    // 1. First attempt: Modern W3C getAsFileSystemHandle (Chrome, Edge, Brave, Chromium)
    try {
      const handlePromises: Promise<File[]>[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (typeof (item as { getAsFileSystemHandle?: unknown }).getAsFileSystemHandle === 'function') {
          handlePromises.push(
            (item as unknown as { getAsFileSystemHandle: () => Promise<FileSystemHandle | null> })
              .getAsFileSystemHandle()
              .then(async (handle) => {
                if (!handle) return []
                if (handle.kind === 'directory') {
                  return getFilesFromDirectoryHandle(handle as FileSystemDirectoryHandle, handle.name)
                } else if (handle.kind === 'file') {
                  const lower = handle.name.toLowerCase()
                  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
                    const f = await (handle as FileSystemFileHandle).getFile()
                    ;(f as { customPath?: string }).customPath = handle.name
                    return [f]
                  }
                }
                return []
              })
              .catch(() => []),
          )
        }
      }
      if (handlePromises.length > 0) {
        const results = await Promise.all(handlePromises)
        const all = results.flat()
        if (all.length > 0) return all
      }
    } catch {
      /* fallback to webkitGetAsEntry */
    }

    // 2. Second attempt: webkitGetAsEntry (Firefox, Safari, older Chromium)
    try {
      const entryPromises: Promise<File[]>[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (typeof (item as { webkitGetAsEntry?: unknown }).webkitGetAsEntry === 'function') {
          const entry = (item as unknown as { webkitGetAsEntry: () => WebkitFileSystemEntry | null }).webkitGetAsEntry()
          if (entry) {
            entryPromises.push(scanFileSystemEntry(entry))
          }
        }
      }
      if (entryPromises.length > 0) {
        const nestedFiles = await Promise.all(entryPromises)
        const flattened = nestedFiles.flat()
        if (flattened.length > 0) return flattened
      }
    } catch {
      /* fallback */
    }
  }

  // 3. Fallback to standard dataTransfer.files
  return Array.from(dataTransfer.files || []).filter((f) => {
    const l = f.name.toLowerCase()
    return l.endsWith('.md') || l.endsWith('.markdown') || l.endsWith('.txt')
  })
}

/** Determines common root folder prefix across paths (e.g. "MeuVault/") */
function getCommonFolderPrefix(paths: (string | undefined)[]): string {
  const valid = paths.filter((p): p is string => Boolean(p && p.includes('/')))
  if (valid.length === 0) return ''
  const firstSlash = valid[0].indexOf('/')
  if (firstSlash === -1) return ''
  const candidate = valid[0].slice(0, firstSlash + 1)
  const allShare = valid.every((p) => p.startsWith(candidate))
  return allShare ? candidate : ''
}

export function ObsidianDocModal({ open, onClose, vault, onSave }: ObsidianDocModalProps) {
  if (!open) return null
  return (
    <ObsidianVaultDialog
      key={`${vault.updatedAt}-${vault.files.length}`}
      onClose={onClose}
      vault={vault}
      onSave={onSave}
    />
  )
}

function ObsidianVaultDialog({
  onClose,
  vault,
  onSave,
}: {
  onClose: () => void
  vault: ObsidianDocState
  onSave: (vault: ObsidianDocState) => void
}) {
  const [files, setFiles] = useState<ObsidianFile[]>(vault.files)
  const [activeId, setActiveId] = useState<string | null>(vault.activeFileId ?? (vault.files[0]?.id ?? null))
  const [search, setSearch] = useState('')
  const [useInAudit, setUseInAudit] = useState(vault.useInAudit)
  const [useInPrompt, setUseInPrompt] = useState(vault.useInPrompt)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'folders' | 'flat'>('folders')
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [statusNotification, setStatusNotification] = useState<string | null>(null)

  const multiFileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Ingest batch of File objects
  const ingestFiles = async (fileList: FileList | File[]) => {
    const newFiles: ObsidianFile[] = []
    let skippedNonMd = 0
    let skippedHidden = 0

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const name = file.name
      const path =
        (file as { customPath?: string }).customPath ||
        (file as { webkitRelativePath?: string }).webkitRelativePath ||
        undefined

      // Filter out internal hidden files or .obsidian/.git/.trash folders
      if (
        name.startsWith('.') ||
        (path && (
          path.includes('/.obsidian') ||
          path.startsWith('.obsidian') ||
          path.includes('/.trash') ||
          path.startsWith('.trash') ||
          path.includes('/.git') ||
          path.startsWith('.git')
        ))
      ) {
        skippedHidden++
        continue
      }

      const lower = name.toLowerCase()
      if (!lower.endsWith('.md') && !lower.endsWith('.markdown') && !lower.endsWith('.txt')) {
        skippedNonMd++
        continue
      }

      try {
        const text = await file.text()
        newFiles.push({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          path,
          content: text,
          enabled: true,
          updatedAt: Date.now(),
        })
      } catch {
        /* ignore read failure */
      }
    }

    if (newFiles.length > 0) {
      setFiles((prev) => {
        const map = new Map(prev.map((f) => [f.path || f.name, f]))
        for (const nf of newFiles) {
          map.set(nf.path || nf.name, nf)
        }
        return Array.from(map.values())
      })
      if (!activeId && newFiles[0]) {
        setActiveId(newFiles[0].id)
      }
      setStatusNotification(
        `✅ ${newFiles.length} nota(s) importada(s) com sucesso!${skippedHidden > 0 ? ` (${skippedHidden} arquivos internos ignorados)` : ''}`
      )
      setTimeout(() => setStatusNotification(null), 4500)
    } else {
      setStatusNotification(
        `Nenhuma nota .md encontrada nos arquivos selecionados.`
      )
      setTimeout(() => setStatusNotification(null), 3500)
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    setStatusNotification('Processando notas arrastadas...')
    try {
      const extracted = await extractFilesFromDataTransfer(e.dataTransfer)
      if (extracted.length > 0) {
        await ingestFiles(extracted)
      } else {
        setStatusNotification('Nenhuma nota Markdown (.md) encontrada na pasta arrastada.')
        setTimeout(() => setStatusNotification(null), 3500)
      }
    } catch {
      if (e.dataTransfer.files?.length) {
        await ingestFiles(e.dataTransfer.files)
      }
    }
  }

  /** Modern showDirectoryPicker with fallback to file input */
  const handleOpenFolderPicker = async () => {
    // 1. Try modern showDirectoryPicker API (Chrome, Edge, Brave, Chromium)
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        // @ts-expect-error showDirectoryPicker is standard in Chromium
        const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'read' })
        if (dirHandle) {
          setStatusNotification(`Lendo pasta "${dirHandle.name}"...`)
          const files = await getFilesFromDirectoryHandle(dirHandle, dirHandle.name)
          if (files.length > 0) {
            await ingestFiles(files)
            return
          } else {
            setStatusNotification(`Nenhuma nota Markdown encontrada dentro de "${dirHandle.name}".`)
            setTimeout(() => setStatusNotification(null), 3500)
            return
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string }).name === 'AbortError') {
          return // User clicked Cancel in directory picker
        }
        // Fall through to input ref
      }
    }

    // 2. Fallback to webkitdirectory file input
    folderInputRef.current?.click()
  }

  const handleMultiFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      ingestFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleFolderChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      ingestFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleLoadSampleVault = () => {
    setFiles(SAMPLE_OBSIDIAN_FILES)
    setActiveId(SAMPLE_OBSIDIAN_FILES[0].id)
    setStatusNotification('3 notas de exemplo carregadas no vault.')
    setTimeout(() => setStatusNotification(null), 3000)
  }

  const handleToggleFile = (id: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)))
  }

  const handleToggleAll = (enabled: boolean) => {
    setFiles((prev) => prev.map((f) => ({ ...f, enabled })))
  }

  const handleToggleFolder = (folderFiles: ObsidianFile[], targetEnabled: boolean) => {
    const ids = new Set(folderFiles.map((f) => f.id))
    setFiles((prev) => prev.map((f) => (ids.has(f.id) ? { ...f, enabled: targetEnabled } : f)))
  }

  const handleSoloFolder = (folderFiles: ObsidianFile[]) => {
    const ids = new Set(folderFiles.map((f) => f.id))
    setFiles((prev) => prev.map((f) => ({ ...f, enabled: ids.has(f.id) })))
  }

  const toggleFolderCollapse = (folderName: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }))
  }

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id)
      if (activeId === id) {
        setActiveId(filtered[0]?.id ?? null)
      }
      return filtered
    })
  }

  const handleClearAll = () => {
    setFiles([])
    setActiveId(null)
    onSave(EMPTY_OBSIDIAN_STATE)
    setStatusNotification('Vault limpo com sucesso.')
    setTimeout(() => setStatusNotification(null), 2500)
  }

  const handleUpdateActiveFile = (patch: Partial<ObsidianFile>) => {
    if (!activeId) return
    setFiles((prev) => prev.map((f) => (f.id === activeId ? { ...f, ...patch } : f)))
  }

  const handleSaveAndClose = () => {
    const updated: ObsidianDocState = {
      files,
      activeFileId: activeId,
      useInAudit,
      useInPrompt,
      updatedAt: Date.now(),
    }
    onSave(updated)
    onClose()
  }

  const activeFile = files.find((f) => f.id === activeId) ?? files[0] ?? null
  const filteredFiles = files.filter((f) =>
    (f.path || f.name).toLowerCase().includes(search.toLowerCase()),
  )
  const enabledFiles = files.filter((f) => f.enabled && f.content.trim())
  const totalChars = enabledFiles.reduce((acc, f) => acc + f.content.length, 0)
  const totalWords = enabledFiles.reduce(
    (acc, f) => acc + (f.content.trim() ? f.content.trim().split(/\s+/).length : 0),
    0,
  )

  // Calculate common prefix (e.g. if root folder was uploaded)
  const commonPrefix = useMemo(() => getCommonFolderPrefix(files.map((f) => f.path)), [files])

  // Group files into folder groups
  const folderGroups = useMemo(() => {
    const groupsMap = new Map<string, ObsidianFile[]>()

    for (const f of filteredFiles) {
      let relative = f.path || f.name
      if (commonPrefix && relative.startsWith(commonPrefix)) {
        relative = relative.slice(commonPrefix.length)
      }
      const parts = relative.split('/')
      const folder = parts.length > 1 ? parts.slice(0, -1).join(' / ') : 'Raiz do Vault'
      const existing = groupsMap.get(folder) || []
      existing.push(f)
      groupsMap.set(folder, existing)
    }

    // Sort folders alphabetically, with 'Raiz do Vault' at top
    return Array.from(groupsMap.entries())
      .sort(([a], [b]) => {
        if (a === 'Raiz do Vault') return -1
        if (b === 'Raiz do Vault') return 1
        return a.localeCompare(b, undefined, { numeric: true })
      })
      .map(([folder, folderFiles]) => ({ folder, files: folderFiles }))
  }, [filteredFiles, commonPrefix])

  const handleCopyCurrent = () => {
    if (!activeFile?.content) return
    navigator.clipboard.writeText(activeFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const dragCounter = useRef(0)

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragging(false)
    }
  }

  const handleDropWrapper = async (e: DragEvent) => {
    dragCounter.current = 0
    await handleDrop(e)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-pop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="obsidian-modal-title"
        className="relative flex flex-col w-full max-w-5xl h-[88vh] rounded-2xl border border-white/10 bg-ink-950 shadow-2xl overflow-hidden"
      >
        {/* Hidden inputs */}
        <input
          ref={multiFileInputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt"
          className="hidden"
          onChange={handleMultiFileChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is standard in browsers but untyped in React JSX
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFolderChange}
        />

        {/* Full Modal Drag Overlay */}
        {dragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md border-2 border-dashed border-military-400 p-8 text-center animate-pop pointer-events-none">
            <div className="size-16 rounded-2xl bg-military-500/20 text-military-300 flex items-center justify-center mb-3">
              <FolderOpen size={36} />
            </div>
            <h3 className="text-[17px] font-bold text-white">Solte a pasta completa do seu Vault aqui</h3>
            <p className="text-[12.5px] text-ink-300 max-w-md mt-1">
              Todas as subpastas e notas <Kbd>.md</Kbd> serão lidas recursivamente de uma só vez.
            </p>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-ink-900/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 items-center justify-center rounded-lg border border-military-500/30 bg-military-500/15 text-military-300 shrink-0">
              <BookOpen size={16} />
            </div>
            <div className="min-w-0">
              <h2 id="obsidian-modal-title" className="text-[14px] font-bold text-white flex items-center gap-2">
                <span>Obsidian Vault &amp; Documentações</span>
                <span className="rounded bg-military-500/20 px-1.5 py-0.5 text-[9.5px] font-semibold text-military-300">
                  {enabledFiles.length} de {files.length} ativos
                </span>
                {folderGroups.length > 1 && (
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-mono text-ink-300">
                    {folderGroups.length} pastas
                  </span>
                )}
              </h2>
              <p className="text-[11.5px] text-ink-300 truncate">
                Carregue a pasta raiz completa do seu cofre ou selecione notas individuais para alimentar a IA e os prompts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              title="Fechar (Esc)"
              className="flex size-7 items-center justify-center rounded-lg text-ink-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status notification banner */}
        {statusNotification && (
          <div className="flex items-center justify-between bg-military-500/15 border-b border-military-500/30 px-5 py-2 text-[11.5px] text-military-200 shrink-0 animate-pop">
            <div className="flex items-center gap-2">
              <Info size={13} className="text-military-400 shrink-0" />
              <span>{statusNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotification(null)}
              className="text-ink-400 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Quick Toolbar */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] bg-black/40 px-5 py-2.5 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="subtle"
              icon={<FolderOpen size={12} className="text-military-400" />}
              onClick={handleOpenFolderPicker}
              title="Selecione a pasta raiz do seu Obsidian: todas as subpastas e notas .md serão importadas automaticamente"
            >
              📂 Carregar Pasta Completa (Vault Raiz)
            </Button>
            <Button
              size="sm"
              variant="subtle"
              icon={<Plus size={12} className="text-emerald-400" />}
              onClick={() => multiFileInputRef.current?.click()}
              title="Adicionar arquivos .md específicos"
            >
              📄 Adicionar Arquivos
            </Button>
            <Button
              size="sm"
              variant="subtle"
              icon={<FlaskConical size={12} />}
              onClick={handleLoadSampleVault}
              title="Carregar notas de exemplo (Tema, Layout, Composition)"
            >
              Exemplo
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <>
                <div className="flex items-center rounded-lg bg-white/[0.05] p-0.5 border border-white/5 mr-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('folders')}
                    title="Exibir agrupado por pastas (como no Obsidian)"
                    className={`flex items-center gap-1 px-2 py-1 text-[10.5px] rounded-md transition-colors ${
                      viewMode === 'folders'
                        ? 'bg-military-500/30 text-white font-medium'
                        : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    <Layers size={11} /> Pastas
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('flat')}
                    title="Exibir como lista plana"
                    className={`flex items-center gap-1 px-2 py-1 text-[10.5px] rounded-md transition-colors ${
                      viewMode === 'flat'
                        ? 'bg-military-500/30 text-white font-medium'
                        : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    <List size={11} /> Lista
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  className="text-[10.5px] text-ink-300 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-1"
                >
                  <CheckSquare size={11} /> Marcar Todos
                </button>
                <span className="h-3 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  className="text-[10.5px] text-ink-300 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-1"
                >
                  <Square size={11} /> Desmarcar Todos
                </button>
                <span className="h-3 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10.5px] text-rose-300 hover:text-rose-200 flex items-center gap-1 transition-colors px-1.5 py-1"
                >
                  <Trash2 size={11} /> Limpar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Two-Column Body: File Explorer Sidebar + Markdown Inspector/Editor */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Vault File List */}
          <div className="w-[330px] shrink-0 border-r border-white/[0.08] bg-black/25 flex flex-col min-h-0">
            {/* Search Filter */}
            <div className="p-3 border-b border-white/[0.06]">
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
                <TextInput
                  value={search}
                  placeholder="Buscar notas no vault..."
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-7.5 text-[11.5px]"
                />
              </div>
            </div>

            {/* File List / Folder Tree */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-thin">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-ink-400 gap-2 mt-6">
                  <BookOpen size={24} className="opacity-40" />
                  <p className="text-[11.5px]">Nenhuma nota carregada.</p>
                  <p className="text-[10.5px] text-ink-500">
                    Arraste a pasta inteira do seu Vault ou clique em "Carregar Pasta Completa" acima.
                  </p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-ink-400">
                  Nenhuma nota encontrada para "{search}".
                </div>
              ) : viewMode === 'folders' ? (
                /* Grouped Folder View */
                folderGroups.map((grp) => {
                  const isCollapsed = Boolean(collapsedFolders[grp.folder])
                  const folderEnabledCount = grp.files.filter((f) => f.enabled).length
                  const allInFolderEnabled = folderEnabledCount === grp.files.length
                  const someInFolderEnabled = folderEnabledCount > 0 && !allInFolderEnabled

                  return (
                    <div key={grp.folder} className="mb-2 rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                      {/* Folder Header */}
                      <div
                        onClick={() => toggleFolderCollapse(grp.folder)}
                        className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer select-none transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <button
                            type="button"
                            aria-label={isCollapsed ? 'Expandir pasta' : 'Recolher pasta'}
                            className="text-ink-400 group-hover:text-white"
                          >
                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          </button>
                          {isCollapsed ? (
                            <Folder size={13} className="text-military-400 shrink-0" />
                          ) : (
                            <FolderOpen size={13} className="text-military-400 shrink-0" />
                          )}
                          <span className="font-semibold text-[11.5px] text-ink-200 group-hover:text-white truncate">
                            {grp.folder}
                          </span>
                          <span className="text-[10px] text-ink-400 font-mono">
                            ({folderEnabledCount}/{grp.files.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleSoloFolder(grp.files)}
                            title="Ativar apenas esta pasta e desmarcar as outras"
                            className="opacity-0 group-hover:opacity-100 text-[9.5px] text-military-300 hover:text-white px-1.5 py-0.5 rounded bg-military-500/20 hover:bg-military-500/40 transition-all"
                          >
                            Só esta
                          </button>
                          <input
                            type="checkbox"
                            checked={allInFolderEnabled}
                            ref={(el) => {
                              if (el) el.indeterminate = someInFolderEnabled
                            }}
                            onChange={() => handleToggleFolder(grp.files, !allInFolderEnabled)}
                            title={
                              allInFolderEnabled
                                ? 'Desmarcar pasta inteira'
                                : 'Marcar todas as notas desta pasta'
                            }
                            className="size-3.5 rounded border-white/20 bg-black/40 accent-military-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Folder Child Files */}
                      {!isCollapsed && (
                        <div className="p-1 space-y-0.5">
                          {grp.files.map((file) => {
                            const isActive = file.id === (activeFile?.id ?? '')
                            return (
                              <div
                                key={file.id}
                                onClick={() => setActiveId(file.id)}
                                className={`group flex items-center justify-between rounded-md pl-5 pr-2 py-1.5 text-[11.5px] cursor-pointer transition-all ${
                                  isActive
                                    ? 'bg-military-500/20 text-white border border-military-500/40 font-medium'
                                    : 'text-ink-300 hover:bg-white/[0.05] hover:text-white border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={file.enabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => handleToggleFile(file.id)}
                                    title={file.enabled ? 'Ativo na Auditoria & Prompt' : 'Ignorado'}
                                    className="size-3 rounded border-white/20 bg-black/40 accent-military-500 cursor-pointer shrink-0"
                                  />
                                  <FileText
                                    size={12}
                                    className={`shrink-0 ${
                                      file.enabled
                                        ? isActive
                                          ? 'text-military-300'
                                          : 'text-military-400'
                                        : 'text-ink-500'
                                    }`}
                                  />
                                  <span
                                    className={`truncate font-mono text-[11px] ${
                                      file.enabled ? '' : 'line-through text-ink-500'
                                    }`}
                                    title={file.path || file.name}
                                  >
                                    {file.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                  <span className="text-[9.5px] font-mono text-ink-400">
                                    {Math.round((file.content.length / 1000) * 10) / 10}k
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteFile(file.id, e)}
                                    title="Remover esta nota"
                                    className="opacity-0 group-hover:opacity-100 size-4.5 flex items-center justify-center rounded hover:bg-rose-500/20 hover:text-rose-300 text-ink-400 transition-all"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                /* Flat List View */
                filteredFiles.map((file) => {
                  const isActive = file.id === (activeFile?.id ?? '')
                  return (
                    <div
                      key={file.id}
                      onClick={() => setActiveId(file.id)}
                      className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] cursor-pointer transition-all ${
                        isActive
                          ? 'bg-military-500/20 text-white border border-military-500/40 font-medium'
                          : 'text-ink-300 hover:bg-white/[0.05] hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={file.enabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleToggleFile(file.id)}
                          title={file.enabled ? 'Ativo na Auditoria & Prompt' : 'Ignorado'}
                          className="size-3.5 rounded border-white/20 bg-black/40 accent-military-500 cursor-pointer shrink-0"
                        />
                        <FileText
                          size={13}
                          className={`shrink-0 ${
                            file.enabled ? (isActive ? 'text-military-300' : 'text-military-400') : 'text-ink-500'
                          }`}
                        />
                        <span
                          className={`truncate font-mono text-[11px] ${
                            file.enabled ? '' : 'line-through text-ink-500'
                          }`}
                          title={file.path || file.name}
                        >
                          {file.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span className="text-[10px] font-mono text-ink-400">
                          {Math.round((file.content.length / 1000) * 10) / 10}k
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          title="Remover este arquivo"
                          className="opacity-0 group-hover:opacity-100 size-5 flex items-center justify-center rounded hover:bg-rose-500/20 hover:text-rose-300 text-ink-400 transition-all"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Sidebar Footer Stats */}
            {files.length > 0 && (
              <div className="border-t border-white/[0.06] p-2.5 bg-black/30 text-[10.5px] font-mono text-ink-400 flex items-center justify-between">
                <span>{enabledFiles.length} ativos ({totalWords.toLocaleString('pt-BR')} palavras)</span>
                <span>{totalChars.toLocaleString('pt-BR')} chars</span>
              </div>
            )}
          </div>

          {/* Right Column: Active File Editor / Viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-ink-950">
            {activeFile ? (
              <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
                {/* File Title & Meta */}
                <div className="flex items-center justify-between gap-3 shrink-0 pb-2 border-b border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    <FieldLabel>Nome do Arquivo / Caminho no Vault</FieldLabel>
                    <TextInput
                      value={activeFile.path || activeFile.name}
                      onChange={(e) => handleUpdateActiveFile({ name: e.target.value, path: e.target.value })}
                      className="font-mono text-[11.5px]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-4 shrink-0">
                    <span className="text-ink-400 font-mono text-[11px] rounded bg-white/[0.04] px-2 py-1 border border-white/5">
                      {activeFile.content.length.toLocaleString('pt-BR')} chars ·{' '}
                      {activeFile.content.split('\n').length} linhas
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCurrent}
                      className="flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-[11px] text-ink-200 hover:text-white transition-colors"
                    >
                      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* Markdown Editor */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="mb-1 flex items-center justify-between">
                    <FieldLabel>Conteúdo Markdown</FieldLabel>
                    <span className="text-[10px] text-ink-400 font-mono">Edições são salvas automaticamente</span>
                  </div>
                  <textarea
                    value={activeFile.content}
                    onChange={(e) => handleUpdateActiveFile({ content: e.target.value })}
                    placeholder="Conteúdo do arquivo Markdown..."
                    className="scroll-thin flex-1 resize-none rounded-xl border border-white/[0.08] bg-black/40 p-3.5 font-mono text-[12px] leading-relaxed text-ink-100 placeholder:text-ink-400 focus:border-military-500/70 focus:outline-none transition-colors"
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : (
              <div
                className={`flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 ${
                  dragging ? 'bg-military-500/10 border-2 border-dashed border-military-400' : ''
                }`}
              >
                <div className="size-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-military-400">
                  <Upload size={28} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">Carregue a pasta completa do seu Obsidian</h3>
                  <p className="mt-1 text-[12px] text-ink-300 max-w-md">
                    Você pode selecionar a pasta raiz do seu Vault ou simplesmente arrastá-la para esta janela.
                    Todas as subpastas e arquivos <Kbd>.md</Kbd> serão importados automaticamente!
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="md"
                    variant="primary"
                    icon={<FolderOpen size={13} />}
                    onClick={handleOpenFolderPicker}
                  >
                    Carregar Pasta Completa (Vault Raiz)
                  </Button>
                  <Button
                    size="md"
                    variant="subtle"
                    icon={<Plus size={13} />}
                    onClick={() => multiFileInputRef.current?.click()}
                  >
                    Adicionar Arquivos
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/[0.08] px-5 py-3 bg-ink-900/70 gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <Toggle
              checked={useInAudit}
              onChange={setUseInAudit}
              label={
                <span className="text-[11px] font-medium text-white flex items-center gap-1.5">
                  <Sparkles size={12} className="text-neon-400" /> Usar na IA ({enabledFiles.length} notas)
                </span>
              }
            />
            <Toggle
              checked={useInPrompt}
              onChange={setUseInPrompt}
              label={
                <span className="text-[11px] font-medium text-white flex items-center gap-1.5">
                  <FileText size={12} className="text-military-400" /> Incluir no Prompt Final
                </span>
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Button size="md" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="md" variant="primary" onClick={handleSaveAndClose}>
              Confirmar &amp; Salvar Vault ({enabledFiles.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
