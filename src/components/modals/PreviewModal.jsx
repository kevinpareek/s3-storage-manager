import React, { useEffect, useMemo, useState } from 'react'
import useCredentials from '../../hooks/useCredentials'
import getFilePreview from '../../api/getFilePreview'
import putTextObject from '../../api/putTextObject'
import JSONTree from '../JSONTree'
import { isImage, isVideo, isAudio, isPDF, isCSV, isMarkdown, isTextLike } from '../../helpers/mimeGuess'

export default function PreviewModal({ isOpen, onClose, item }) {
  const { s3, credentials } = useCredentials()
  const [url, setUrl] = useState(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tooLarge, setTooLarge] = useState(false)

  const canEdit = useMemo(() => item && item.type === 'file' && (isTextLike(item.name) || isMarkdown(item.name) || item.name?.toLowerCase().endsWith('.json')), [item])
  const viewMode = useMemo(() => {
    if (!item) return 'none'
    const name = item.name || ''
    if (isImage(name)) return 'image'
    if (isVideo(name)) return 'video'
    if (isAudio(name)) return 'audio'
    if (isPDF(name)) return 'pdf'
    if (name.toLowerCase().endsWith('.json')) return 'json'
    if (isCSV(name)) return 'csv'
    if (isMarkdown(name)) return 'markdown'
    if (isTextLike(name)) return 'text'
    return 'download'
  }, [item])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isOpen || !item || item.type !== 'file') return
      setLoading(true)
      setError(null)
      try {
        const signedUrl = await getFilePreview(s3, item.key, false, credentials?.name)
        if (cancelled) return
        setUrl(signedUrl)
        // For editor/text-like modes, fetch the content via fetch; signedUrl is temporary
        if (['text','markdown','json','csv'].includes(viewMode)) {
          // guard: only auto-load small files (<1.5MB)
          const max = 1.5 * 1024 * 1024
          if (typeof item.size === 'number' && item.size > max) {
            setTooLarge(true)
          } else {
            try {
              const res = await fetch(signedUrl)
              const text = await res.text()
              if (cancelled) return
              setBody(text)
            } catch (e) {
              setError('Unable to fetch file content in-browser (CORS). Use Open link.')
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, item, viewMode])

  async function handleSave() {
    if (!canEdit || !item) return
    setSaving(true)
    setError(null)
    try {
      let ctype = 'text/plain; charset=utf-8'
      const n = item.name?.toLowerCase() || ''
      if (n.endsWith('.json')) ctype = 'application/json; charset=utf-8'
      else if (n.endsWith('.md') || n.endsWith('.markdown')) ctype = 'text/markdown; charset=utf-8'
      else if (n.endsWith('.csv')) ctype = 'text/csv; charset=utf-8'
      await putTextObject(s3, item.key, credentials?.name, body, ctype)
    } catch (e) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  function renderCSV(text) {
    const rows = []
    const lines = (text || '').split(/\r?\n/)
    for (const line of lines) {
      if (line === '') continue
      const cells = []
      let cur = ''
      let inQ = false
      for (let i=0;i<line.length;i++) {
        const ch = line[i]
        if (inQ) {
          if (ch === '"') {
            if (line[i+1] === '"') { cur += '"'; i++ } else { inQ = false }
          } else { cur += ch }
        } else {
          if (ch === ',') { cells.push(cur); cur = '' }
          else if (ch === '"') { inQ = true }
          else { cur += ch }
        }
      }
      cells.push(cur)
      rows.push(cells)
    }
    return (
      <div className="overflow-auto">
        <table className="min-w-full text-[11px] font-mono border-collapse">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i===0? 'bg-[#161616]':''}>
                {r.map((c, j) => (
                  <td key={j} className="border border-[#242424] px-2 py-1 text-gray-200 whitespace-pre">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="w-full h-full fixed top-0 left-0 bg-[#000]/60 backdrop-blur-sm flex items-center justify-center px-2 z-50">
      <div className="w-full max-w-4xl h-[80vh] card p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-mono text-gray-300 truncate">Preview: {item?.name}</div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            )}
            {url && (
              <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">Open</a>
            )}
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : (
          <div className="flex-1 overflow-auto rounded border border-[#242424] bg-[#0e0e0e] p-3">
            {viewMode === 'image' && url && (
              <img src={url} alt={item?.name} className="max-w-full max-h-full object-contain mx-auto" />
            )}
            {viewMode === 'video' && url && (
              <video src={url} controls className="w-full h-full max-h-[70vh]" />
            )}
            {viewMode === 'audio' && url && (
              <audio src={url} controls className="w-full" />
            )}
            {viewMode === 'pdf' && url && (
              <iframe title="pdf" src={`${url}#toolbar=1&navpanes=0`} className="w-full h-full" />
            )}
            {viewMode === 'json' && (
              <JSONTree data={body} />
            )}
            {viewMode === 'csv' && (tooLarge ? (
              <div className="text-xs text-gray-300">File too large to render as table inline. Use Open to view.</div>
            ) : renderCSV(body))}
            {viewMode === 'markdown' && (tooLarge ? (
              <div className="text-xs text-gray-300">File too large to edit inline. Use Open.</div>
            ) : (
              <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full h-full input p-2 font-mono text-[12px]" spellCheck={false} />
            ))}
            {viewMode === 'text' && (tooLarge ? (
              <div className="text-xs text-gray-300">File too large to edit inline. Use Open.</div>
            ) : (
              <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full h-full input p-2 font-mono text-[12px]" spellCheck={false} />
            ))}
            {viewMode === 'download' && url && (
              <div className="text-xs text-gray-300">
                Inline preview not supported for this file. <a className="text-blue-400 underline" href={url} target="_blank" rel="noreferrer">Open</a> or download.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
