import React from 'react'

function Line({ depth, label, isLast }) {
  return (
    <div className="text-[11px] font-mono text-gray-300">
      <span className="text-gray-500">{Array(depth).fill('  ').join('')}</span>
      {label}{!isLast ? ',' : ''}
    </div>
  )
}

export default function JSONTree({ data }) {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data
    const pretty = JSON.stringify(json, null, 2)
    return (
      <pre className="text-[11px] leading-5 font-mono text-gray-200 whitespace-pre-wrap break-words">{pretty}</pre>
    )
  } catch {
    return <div className="text-xs text-red-400 font-mono">Invalid JSON</div>
  }
}
