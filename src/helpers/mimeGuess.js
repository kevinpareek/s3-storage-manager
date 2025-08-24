// Lightweight helpers to decide preview support based on filename

export function extOf(name = '') {
  const base = (name || '').toLowerCase();
  const idx = base.lastIndexOf('.')
  return idx >= 0 ? base.slice(idx + 1) : ''
}

export function isImage(name) {
  const ext = extOf(name)
  return ['jpg','jpeg','png','gif','bmp','webp','svg'].includes(ext)
}
export function isVideo(name) {
  const ext = extOf(name)
  return ['mp4','webm','ogg','mov','mkv'].includes(ext)
}
export function isAudio(name) {
  const ext = extOf(name)
  return ['mp3','wav','ogg','aac','flac','m4a'].includes(ext)
}
export function isPDF(name) {
  return extOf(name) === 'pdf'
}
export function isCSV(name) {
  const ext = extOf(name)
  return ['csv','tsv'].includes(ext)
}
export function isMarkdown(name) {
  const ext = extOf(name)
  return ['md','markdown'].includes(ext)
}
export function isTextLike(name) {
  const ext = extOf(name)
  const textExts = ['txt','log','ini','cfg','conf','env','gitignore']
  const codeExts = ['js','jsx','ts','tsx','json','yml','yaml','xml','html','css','sh','py','rb','java','go','rs']
  return textExts.includes(ext) || codeExts.includes(ext)
}

export function isDocument(name) {
  const ext = extOf(name)
  const docs = ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','rtf','odt','ods','odp']
  return docs.includes(ext)
}
export function isCode(name) {
  const ext = extOf(name)
  const code = ['js','jsx','ts','tsx','py','java','c','cpp','cs','rb','php','go','rs','swift','kt','html','css','json','xml','sh','bat','pl','m','scala','dart','sql']
  return code.includes(ext)
}
export function isArchive(name) {
  const ext = extOf(name)
  const archives = ['zip','rar','7z','tar','gz','bz2','xz','iso','jar']
  return archives.includes(ext)
}

// Returns one of: 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive' | 'other'
export function fileCategory(name) {
  const n = name || ''
  if (isImage(n)) return 'image'
  if (isVideo(n)) return 'video'
  if (isAudio(n)) return 'audio'
  if (isArchive(n)) return 'archive'
  if (isCode(n)) return 'code'
  if (isDocument(n) || isPDF(n) || isCSV(n) || isMarkdown(n) || isTextLike(n)) return 'document'
  return 'other'
}
