import React, { useState, useMemo } from 'react'

function formatSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '-'
  const units = ['B','KB','MB','GB','TB']
  let i = 0
  let num = Math.abs(bytes)
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024
    i++
  }
  return `${bytes < 0 ? '-' : ''}${num.toFixed(2)} ${units[i]}`
}

function friendlyType(name, rawType) {
  if (!name) return rawType || 'other'
  const ext = name.toLowerCase().split('.').pop()
  const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv']
  const AUDIO_EXTS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma']
  const DOCUMENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp']
  const CODE_EXTS = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'rb', 'php', 'go', 'rs', 'swift', 'kt', 'html', 'css', 'json', 'xml', 'sh', 'bat', 'pl', 'm', 'scala', 'dart', 'sql', 'ipynb']
  const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'jar']
  if (IMAGE_EXTS.includes(ext)) return 'Image'
  if (VIDEO_EXTS.includes(ext)) return 'Video'
  if (AUDIO_EXTS.includes(ext)) return 'Audio'
  if (DOCUMENT_EXTS.includes(ext)) return 'Document'
  if (CODE_EXTS.includes(ext)) return 'Code'
  if (ARCHIVE_EXTS.includes(ext)) return 'Archive'
  return (rawType === 'folder') ? 'Folder' : 'Other'
}

export default function InfoModal({ isOpen, onClose, item, shareUrl, downloadUrl, isGenerating }) {
  const [copiedField, setCopiedField] = useState(null)

  const displayType = useMemo(() => friendlyType(item?.name, item?.type), [item])
  const displaySize = useMemo(() => formatSize(item?.size), [item])
  const displayPath = useMemo(() => item?.key || item?.path || '-', [item])
  const displayCreated = useMemo(() => {
    if (!item) return '-'
    if (item.created) return new Date(item.created).toLocaleString()
    if (item.lastModified) return new Date(item.lastModified).toLocaleString()
    return '-'
  }, [item])

  if (!isOpen) return null

  async function copy(text, field) {
    try {
      await navigator.clipboard.writeText(text || '')
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch (err) {
      console.warn('Copy failed', err)
    }
  }

  return (
    <div className="w-full h-full fixed top-0 left-0 bg-[#000]/50 backdrop-blur-sm flex items-center justify-center px-2 z-50">
      <div className="w-full max-w-lg card p-5">
        <h1 className="font-semibold text-xl mb-4 bg-clip-text text-white text-center">Object Details</h1>
        {!item ? (
          <div className="text-gray-400 text-sm">No item selected</div>
        ) : (
          <div className="text-xs font-mono text-gray-300 space-y-3">
            <div>
              <div className="text-gray-400 text-[11px]">Name</div>
              <div className="text-white break-words">{item.name}</div>
            </div>
            <div>
              <div className="text-gray-400 text-[11px]">Path</div>
              <div className="text-white break-words">{displayPath}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-400 text-[11px]">Type</div>
                <div className="text-white">{displayType}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[11px]">Size</div>
                <div className="text-white">{displaySize}</div>
              </div>
            </div>
            {item.lastModified && (
              <div>
                <div className="text-gray-400 text-[11px]">Last modified</div>
                <div className="text-white">{new Date(item.lastModified).toLocaleString()}</div>
              </div>
            )}
            <div>
              <div className="text-gray-400 text-[11px]">Created</div>
              <div className="text-white">{displayCreated}</div>
            </div>

            {item.type === 'file' && (
              <div className="space-y-2">
                <div className="text-gray-400 text-[11px]">URLs</div>
                {isGenerating ? (
                  <div className="text-gray-500">Generating URLs...</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input readOnly value={shareUrl || ''} className="flex-1 input px-2 py-1 text-[12px]" />
                      <button onClick={() => copy(shareUrl, 'share')} className="btn btn-ghost">{copiedField === 'share' ? 'Copied' : 'Copy'}</button>
                      <button onClick={() => shareUrl && window.open(shareUrl, '_blank')} className="btn btn-primary">View</button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input readOnly value={downloadUrl || ''} className="flex-1 input px-2 py-1 text-[12px]" />
                      <button onClick={() => copy(downloadUrl, 'download')} className="btn btn-ghost">{copiedField === 'download' ? 'Copied' : 'Copy'}</button>
                      <button onClick={() => downloadUrl && window.open(downloadUrl, '_blank')} className="btn btn-primary">Download</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-3">
              <button onClick={() => { onClose(); }} className="btn btn-ghost">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
