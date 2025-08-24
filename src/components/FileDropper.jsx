import { CloudUpload, FileText, X, LoaderCircle, Check, Folder } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import MultiPartUpload from '../api/MultiPartUpload'
import { HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import useCredentials from '../hooks/useCredentials'

export default function FileDropper({ currentDirectory = "", uploading = false, setUploading }) {
    const [isDragging, setIsDragging] = useState(false)
    // files: array of { file: File, id, progress (0-100), status: 'pending'|'uploading'|'done'|'error'|'conflict'|'skipped', controller, targetKey? }
    const [files, setFiles] = useState([])
    const filesRef = useRef([])
    // per-file upload index not needed; we track per-file state in `files`
    const { s3, credentials } = useCredentials()
    // cache listings per prefix during the session to avoid repeated ListObjects calls
    const listCacheRef = useRef(new Map())

    // Clear listing cache when credentials/bucket changes to avoid stale results
    useEffect(() => {
        listCacheRef.current.clear()
    }, [credentials?.name])

    // Read all entries from a directory reader (Chrome/Safari webkit entries)
    async function readAllDirectoryEntries(directoryReader) {
        const entries = []
        // Keep calling readEntries() until it returns an empty array
        // to ensure we get all entries within this directory
        // (readEntries may return only a subset per call)
        // eslint-disable-next-line no-constant-condition
        while (true) {
                const batch = await new Promise((resolve, reject) => {
                    directoryReader.readEntries(resolve, reject)
                })
            if (!batch || batch.length === 0) break
            entries.push(...batch)
        }
        return entries
    }

    // Traverse a FileSystemEntry (file or directory) and collect File objects
    async function traverseFileTree(entry, path = "") {
        try {
            if (entry.isFile) {
                const file = await new Promise((res, rej) => entry.file(res, rej))
                // Preserve relative path for folder uploads
                const relativePath = `${path}${file.name}`
                try {
                    // Attach a synthetic relativePath if webkitRelativePath is unavailable
                    // This is safe and used only by our upload logic
                    // eslint-disable-next-line no-param-reassign
                    file.relativePath = relativePath
                } catch {
                    // ignore assignment failures
                }
                return [file]
            }

            if (entry.isDirectory) {
                const reader = entry.createReader()
                const entries = await readAllDirectoryEntries(reader)
                const nestedFilesArrays = await Promise.all(
                    entries.map((ent) => traverseFileTree(ent, `${path}${entry.name}/`))
                )
                return nestedFilesArrays.flat()
            }

            return []
        } catch (error) {
            throw error
        }
    }

    const handleDragEnter = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    async function handleDrop(e) {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const { items, files: dtFiles } = e.dataTransfer

        // Prefer entries when available to support directories
        const supportsEntries = items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function'
        if (supportsEntries) {
            const itemEntries = Array.from(items)
                .filter((it) => it.kind === 'file')
                .map((it) => it.webkitGetAsEntry())
                .filter(Boolean)

            const collectedArrays = await Promise.all(itemEntries.map((entry) => traverseFileTree(entry)))
            const collectedFiles = collectedArrays.flat().map(f => ({ file: f, id: Math.random().toString(36).slice(2), progress: 0, status: 'pending', controller: null }))
            await addFiles(collectedFiles)
        } else {
            const droppedFiles = Array.from(dtFiles).map(f => ({ file: f, id: Math.random().toString(36).slice(2), progress: 0, status: 'pending', controller: null }))
            await addFiles(droppedFiles)
        }
    }

    async function handleFileInput(e) {
    const selectedFiles = Array.from(e.target.files).map(f => ({ file: f, id: Math.random().toString(36).slice(2), progress: 0, status: 'pending', controller: null }))
    await addFiles(selectedFiles)
    }

    const [dupWarning, setDupWarning] = useState('')
    const dupWarningTimer = useRef(null)

    // Human readable bytes
    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return ''
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let i = 0
        let v = bytes
        while (v >= 1024 && i < units.length - 1) {
            v = v / 1024
            i++
        }
        return `${Math.round(v * 10) / 10} ${units[i]}`
    }

    // (removed unused helper getFileOriginalPath)

    // keep ref in sync to avoid stale closures when checking queued files
    useEffect(() => { filesRef.current = files }, [files])

    // Add files with duplicate detection by original path/name and check S3 for existing objects
    async function addFiles(newItems) {
        // First dedupe against already queued files (use ref for up-to-date value)
        const prevFilesSnapshot = filesRef.current || []
        const existingPaths = new Set(prevFilesSnapshot.map(p => (p.file?.webkitRelativePath || p.file?.relativePath || p.file?.name)))
        const unique = []
        let localSkipped = 0
        for (const it of newItems) {
            const p = it.file?.webkitRelativePath || it.file?.relativePath || it.file?.name
            if (!p) continue
            if (existingPaths.has(p)) {
                localSkipped++
                continue
            }
            existingPaths.add(p)
            unique.push(it)
        }

        // If no S3 client or credentials, just add unique items and warn that bucket couldn't be checked
        if (!s3 || !credentials || !credentials.name) {
            if (localSkipped > 0) setDupWarning(`Skipped ${localSkipped} duplicate file(s) locally`)
            setFiles(prev => [...prev, ...unique])
            if (localSkipped > 0 && dupWarningTimer.current) {
                clearTimeout(dupWarningTimer.current)
                dupWarningTimer.current = setTimeout(() => setDupWarning(''), 4000)
            }
            return
        }

        // Normalize currentDirectory similar to MultiPartUpload
        let dir = currentDirectory.trim()
        if (dir === "/") {
            dir = ""
        } else {
            dir = dir.replace(/^\/+/, "").replace(/\/+$/, "") + "/"
        }

    const toAdd = []
    const conflictItems = []
    let existsConflicts = 0
    const existsNames = []
        // Optimize existence checks by listing S3 keys by prefix.
        // Group files by their immediate prefix (to limit list scope).
        const filesByPrefix = new Map()
        for (const it of unique) {
            const p = it.file?.webkitRelativePath || it.file?.relativePath || it.file?.name
            if (!p) continue
            // Use first path segment as grouping key to reduce list calls
            const parts = p.split('/').filter(Boolean)
            const group = parts.length > 1 ? parts[0] + '/' : ''
            const fullKey = (dir + p).replace(/^\/+/, "")
            if (!filesByPrefix.has(group)) filesByPrefix.set(group, [])
            filesByPrefix.get(group).push({ item: it, relPath: p, fullKey })
        }

        // Fetch existing keys for each group in parallel with caching and pagination
        const existingKeys = new Set()
    const listPromises = Array.from(filesByPrefix.entries()).map(async ([group, list]) => {
            // prefix to list on S3
            const prefix = dir + group
            // check cache first
            if (listCacheRef.current.has(prefix)) {
                const cached = listCacheRef.current.get(prefix)
                cached.forEach(k => existingKeys.add(k))
                return
            }

            const collected = []
            let continuationToken = undefined
            try {
                while (true) {
                    const res = await s3.send(new ListObjectsV2Command({ Bucket: credentials.name, Prefix: prefix, ContinuationToken: continuationToken }))
                    const keys = (res.Contents || []).map(c => c.Key)
                    keys.forEach(k => {
                        collected.push(k)
                        existingKeys.add(k)
                    })
                    if (!res.IsTruncated) break
                    continuationToken = res.NextContinuationToken
                }
                // cache the collected keys for this prefix
                listCacheRef.current.set(prefix, collected)
            } catch (err) {
                // If listing fails (permissions/network), fall back to per-file Head checks for this group
                console.warn('ListObjectsV2 failed for prefix', prefix, err)
                for (const entry of list) {
                    try {
                        await s3.send(new HeadObjectCommand({ Bucket: credentials.name, Key: entry.fullKey }))
                        existingKeys.add(entry.fullKey)
                    } catch (headErr) {
                        const status = headErr?.$metadata?.httpStatusCode
                        if (status === 404) {
                            // not exists
                        } else {
                            existingKeys.add(entry.fullKey)
                            console.warn('Could not confirm object existence via HEAD; treating as conflict:', entry.fullKey, headErr)
                        }
                    }
                }
            }
        })

        await Promise.all(listPromises)

        // Now determine which files conflict based on collected existingKeys
    for (const [group, list] of filesByPrefix.entries()) {
            for (const entry of list) {
                if (existingKeys.has(entry.fullKey)) {
                    existsConflicts++
                    existsNames.push(entry.relPath)
            conflictItems.push({ ...entry.item, status: 'conflict', skipReason: 'exists', targetKey: entry.fullKey })
                } else {
            toAdd.push({ ...entry.item, targetKey: entry.fullKey })
                }
            }
        }

        // Update UI and warnings for duplicates/conflicts
        if (localSkipped > 0 || existsConflicts > 0) {
            const parts = []
            if (localSkipped > 0) parts.push(`${localSkipped} duplicate locally`)
            if (existsConflicts > 0) {
                // Show a short list of filenames that exist on S3 (limit to 5)
                const sample = existsNames.slice(0, 5).map(n => n.split('/').pop())
                const sampleText = sample.length ? `: ${sample.join(', ')}${existsNames.length > sample.length ? ', ...' : ''}` : ''
                parts.push(`${existsConflicts} conflict on bucket${sampleText}`)
            }
            const msg = `Conflicts: ${parts.join(', ')}`
            setDupWarning(msg)
            if (dupWarningTimer.current) clearTimeout(dupWarningTimer.current)
            dupWarningTimer.current = setTimeout(() => setDupWarning(''), 6000)
        }

        if (toAdd.length > 0 || conflictItems.length > 0) setFiles(prev => [...prev, ...toAdd.map(i => ({ ...i, status: 'pending' })), ...conflictItems])
    }

    useEffect(() => {
        return () => {
            if (dupWarningTimer.current) clearTimeout(dupWarningTimer.current)
        }
    }, [])

    const removeFile = useCallback((index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
    }, [])

    // Bulk actions for conflicts
    const replaceAllConflicts = useCallback(() => {
        setFiles(prev => prev.map(p => p.status === 'conflict' ? { ...p, status: 'pending', progress: 0, skipReason: undefined } : p))
    }, [])

    const skipAllConflicts = useCallback(() => {
        setFiles(prev => prev.map(p => p.status === 'conflict' ? { ...p, status: 'skipped', skipReason: 'user-skip' } : p))
    }, [])

    function deriveKeepBothKey(originalKey) {
        // Insert " (1)" before the extension, or append if none
        const idx = originalKey.lastIndexOf('/')
        const prefix = idx >= 0 ? originalKey.slice(0, idx + 1) : ''
        const base = idx >= 0 ? originalKey.slice(idx + 1) : originalKey
        const dot = base.lastIndexOf('.')
        const name = dot > 0 ? base.slice(0, dot) : base
        const ext = dot > 0 ? base.slice(dot) : ''
        return `${prefix}${name} (1)${ext}`
    }

    async function pickAvailableKey(startKey) {
        // Try startKey, then (1), (2), ... until free
        if (!s3 || !credentials) return startKey
        let key = startKey
        let attempt = 1
        while (true) {
            try {
                await s3.send(new HeadObjectCommand({ Bucket: credentials.name, Key: key }))
                // exists -> bump index
                const idx = key.lastIndexOf('/')
                const prefix = idx >= 0 ? key.slice(0, idx + 1) : ''
                const base = idx >= 0 ? key.slice(idx + 1) : key
                const dot = base.lastIndexOf('.')
                const name = dot > 0 ? base.slice(0, dot) : base
                const ext = dot > 0 ? base.slice(dot) : ''
                attempt += 1
                key = `${prefix}${name} (${attempt})${ext}`
            } catch (e) {
                const code = e?.$metadata?.httpStatusCode
                if (code === 404) return key
                // On other errors, bail out and use the proposed key
                return key
            }
        }
    }

    async function handleFilesUpload() {
        setUploading(true)

        // Process pending items until none remain. Using filesRef ensures we always read current queue.
        while (true) {
            const next = (filesRef.current || []).find(f => f.status === 'pending')
            if (!next) break

            const item = next
            const controller = new AbortController()
            setFiles(prev => prev.map((it) => it.id === item.id ? { ...it, controller, status: 'uploading', progress: 0 } : it))

            const fileObj = item.file
            const success = await MultiPartUpload(s3, fileObj, currentDirectory, credentials.name, {
                onProgress: (uploaded, total) => {
                    const pct = Math.round((uploaded / total) * 100)
                    setFiles(prev => prev.map((it) => it.id === item.id ? { ...it, progress: pct } : it))
                },
                signal: controller.signal,
                concurrency: 4,
                targetKey: item.targetKey // may be keep-both or normal
            })

            if (!success) {
                console.error(`Upload failed: ${fileObj.name}`)
                // If the controller was aborted, mark as canceled, else error — check latest state by id
                setFiles(prev => prev.map((it) => it.id === item.id ? { ...it, status: (it.controller && it.controller.signal && it.controller.signal.aborted) ? 'canceled' : 'error' } : it))
                // continue processing remaining pending files
                continue
            }

            setFiles(prev => prev.map((it) => it.id === item.id ? { ...it, status: 'done', progress: 100 } : it))
        }

    // Reset
    setUploading(false)
    }

    function cancelAllUploads() {
        setFiles(prev => prev.map((it) => {
            if (it.controller && it.controller.abort && it.status === 'uploading') {
                try { it.controller.abort() } catch { /* ignore */ }
                return { ...it, status: 'canceled' }
            }
            return it
        }))
        setUploading(false)
        
    }

    useEffect(() => {
        if (files.length > 0 && !uploading) {
            handleFilesUpload()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files])

    const borderColor = uploading ? 'border-green-500 bg-green-950' : isDragging ? 'border-[#3a3a3a] bg-[#171717]' : 'border-[#252525] bg-[#101010]'

    return (
        <div
            className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors ${borderColor}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-center justify-center space-y-4">
                <CloudUpload size={50} className='stroke-[1.5] text-gray-500' />

                <div className="text-center">
                    <p className="font-mono text-sm text-gray-400">
                        {uploading
                            ? 'Uploading...'
                            : isDragging
                                ? 'Drop files here'
                                : 'Drag & drop files here, or click to select'}
                    </p>
                    <p className="font-mono text-xs text-gray-600 mt-1">
                        Supports multiple files and folders
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <label className="btn btn-ghost cursor-pointer">
                        <input
                            type="file"
                            className="hidden"
                            multiple
                            onChange={handleFileInput}
                            disabled={uploading}
                        />
                        Select Files
                    </label>
                    <label className="btn btn-ghost cursor-pointer">
                        <input
                            type="file"
                            className="hidden"
                            onChange={handleFileInput}
                            disabled={uploading}
                            webkitdirectory=""
                            mozdirectory=""
                            directory=""
                        />
                        Select Folder
                    </label>
                </div>
            </div>

                {/* Show duplicate warning even if no files were added (e.g. all skipped because they exist on S3) */}
                {dupWarning && (
                    <div className="mt-6">
                        <div className="w-full p-2 bg-yellow-900 text-yellow-200 rounded text-xs font-mono mb-2 flex items-center justify-between">
                            <div>{dupWarning}</div>
                            <div className="flex items-center gap-2">
                                <button onClick={replaceAllConflicts} className="btn btn-ghost btn-sm">Replace All</button>
                                <button onClick={skipAllConflicts} className="btn btn-ghost btn-sm">Skip All</button>
                            </div>
                        </div>
                    </div>
                )}

                {files.length > 0 && (
                <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h5 className="font-mono text-sm text-gray-200">Upload queue</h5>
                            <div className="font-mono text-xs text-gray-400">{`${files.filter(f => f.status === 'done').length}/${files.length} files uploaded`}</div>
                        </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setFiles([])} className="btn btn-ghost">Clear</button>
                                    <button onClick={replaceAllConflicts} className="btn btn-ghost">Replace All</button>
                                    <button onClick={skipAllConflicts} className="btn btn-ghost">Skip All</button>
                                    <button onClick={() => setFiles(prev => prev.filter(p => p.status !== 'skipped' && p.status !== 'conflict'))} className="btn btn-ghost">Clear Skipped/Conflicts</button>
                                    {uploading ? (
                                        <button onClick={cancelAllUploads} className="btn btn-ghost text-red-400">Cancel All</button>
                                    ) : (
                                        <button onClick={handleFilesUpload} className="btn btn-primary">Upload Now</button>
                                    )}
                                </div>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto">
                        {/* group files by top-level folder for a friendly view */}
                        {(() => {
                            const groups = new Map()
                            files.forEach(it => {
                                const rp = it.file.webkitRelativePath || it.file.relativePath || it.file.name
                                const parts = rp.split('/').filter(Boolean)
                                if (parts.length > 1) {
                                    const g = parts[0]
                                    const display = parts.slice(1).join('/')
                                    if (!groups.has(g)) groups.set(g, [])
                                    groups.get(g).push({ ...it, displayName: display, originalPath: rp })
                                } else {
                                    if (!groups.has('_root')) groups.set('_root', [])
                                    groups.get('_root').push({ ...it, displayName: rp, originalPath: rp })
                                }
                            })

                            return Array.from(groups.entries()).map(([groupName, items]) => (
                                <div key={groupName} className="mb-2 border-b border-[#151515] pb-2">
                                    {groupName !== '_root' && (
                                        <div className="flex items-center gap-2 font-mono text-sm text-gray-300 mb-2">
                                            <Folder size={16} className="text-yellow-400" />
                                            <span>{groupName}</span>
                                            <span className="text-xs text-gray-500">{`(${items.length})`}</span>
                                        </div>
                                    )}
                                    {items.map((it) => (
                                        <div
                                            key={it.id}
                                            className={`flex items-center justify-between p-2 rounded-md ${it.status === 'uploading' ? 'bg-green-900 border border-green-600' : 'card'}`}
                                        >
                                            <div className="flex items-center space-x-2 w-full">
                                                <FileText size={16} className='text-gray-500' />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono text-xs text-gray-300 truncate max-w-xs">
                                                            {it.displayName}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs text-gray-400 ml-2">{formatBytes(it.file.size)}</span>
                                                            <span className="font-mono text-xs text-gray-400 ml-2">
                                                                {it.status === 'uploading' ? `${it.progress}%` : (it.status === 'done' ? 'Done' : (it.status === 'error' ? 'Error' : (it.status === 'canceled' ? 'Canceled' : (it.status === 'skipped' ? 'Skipped' : (it.status === 'conflict' ? 'Conflict' : 'Pending')))))}
                                                            </span>
                                                            {it.status === 'done' && <Check size={14} className='text-green-400' />}
                                                            {it.status === 'uploading' && <LoaderCircle size={14} className='animate-spin text-yellow-400' />}
                                                            {(it.status === 'error' || it.status === 'canceled') && <X size={14} className='text-red-400' />}
                                                        </div>
                                                    </div>
                                                    <div className="h-1 bg-[#111] rounded mt-2 overflow-hidden">
                                                        <div style={{ width: `${it.progress}%` }} className="h-1 bg-green-500 transition-all" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="ml-3 flex items-center gap-2">
                                                {it.status === 'uploading' && (
                                                    <button onClick={() => {
                                                        if (it.controller) it.controller.abort()
                                                        setFiles(prev => prev.map((p) => p.id === it.id ? { ...p, status: 'canceled' } : p))
                                                    }} className="btn btn-ghost">Cancel</button>
                                                )}
                                                {it.status === 'error' && (
                                                    <button onClick={() => {
                                                        // mark pending to re-queue
                                                        setFiles(prev => prev.map((p) => p.id === it.id ? { ...p, status: 'pending', progress: 0 } : p))
                                                    }} className="btn btn-ghost">Retry</button>
                                                )}
                                                {it.status !== 'uploading' && it.status !== 'done' && it.status !== 'skipped' && it.status !== 'conflict' && (
                                                    <button onClick={() => removeFile(files.findIndex(f => f.id === it.id))} className="text-gray-500 hover:text-gray-300">
                                                        <X size={16} className='text-gray-500 cursor-pointer' />
                                                    </button>
                                                )}
                                                {it.status === 'skipped' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-yellow-300 font-mono">Skipped</span>
                                                        <button onClick={() => setFiles(prev => prev.map(p => p.id === it.id ? { ...p, status: 'pending', progress: 0, skipReason: undefined } : p))} className="btn btn-ghost">Upload anyway</button>
                                                    </div>
                                                )}

                                                {it.status === 'conflict' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-yellow-300 font-mono">Conflict</span>
                                                        <button onClick={async () => {
                                                            // Replace: mark pending and set a flag to force upload (we'll reuse existing upload which overwrites by default)
                                                            setFiles(prev => prev.map(p => p.id === it.id ? { ...p, status: 'pending', progress: 0, skipReason: undefined, /* keep same key to overwrite */ targetKey: it.targetKey } : p))
                                                        }} className="btn btn-ghost">Replace</button>
                                                        <button onClick={() => setFiles(prev => prev.map(p => p.id === it.id ? { ...p, status: 'skipped', skipReason: 'user-skip' } : p))} className="btn btn-ghost">Skip</button>
                                                        <button onClick={async () => {
                                                            // Keep both: compute a new available key and upload there
                                                            const baseKey = deriveKeepBothKey(it.targetKey || '')
                                                            const freeKey = await pickAvailableKey(baseKey)
                                                            setFiles(prev => prev.map(p => p.id === it.id ? { ...p, status: 'pending', progress: 0, skipReason: undefined, targetKey: freeKey } : p))
                                                        }} className="btn btn-ghost">Keep Both</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            )}
        </div>
    )
}
