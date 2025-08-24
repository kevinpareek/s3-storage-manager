import React, { useEffect, useState } from 'react'
import useCredentials from '../../hooks/useCredentials'
import deleteFileOrFolder from '../../api/deleteFileOrFolder'

export default function BulkDeleteModal({ isOpen, onClose, items = [], onDone }) {
    const { s3, credentials } = useCredentials()
    const [busy, setBusy] = useState(false)
    const [progress, setProgress] = useState(0)
    const [confirmText, setConfirmText] = useState("")

    useEffect(() => {
        if (!isOpen) { setBusy(false); setProgress(0); setConfirmText("") }
    }, [isOpen])

    if (!isOpen) return null

    async function handleDelete() {
        if (busy) return
        // Require exact confirmation
        if ((confirmText || "").trim().toUpperCase() !== 'DELETE') return
        setBusy(true)
        try {
            let done = 0
            for (const it of items) {
                try {
                    await deleteFileOrFolder(s3, it.key, credentials.name)
                } catch (e) {
                    console.error('Bulk delete failed for', it?.key, e)
                }
                done += 1
                setProgress(Math.round((done / items.length) * 100))
            }
            onDone && onDone()
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='w-full h-full fixed top-0 left-0 bg-[#000]/50 backdrop-blur-sm flex items-center justify-center px-2 z-50'>
            <div className='w-full max-w-md card p-5'>
                <h1 className='font-semibold text-xl mb-4 text-red-300'>Delete {items.length} item(s)</h1>
                <p className='text-xs text-gray-400 mb-4'>This action cannot be undone.</p>
                {busy && (
                    <div className='w-full h-2 bg-[#111] rounded mb-3 overflow-hidden'>
                        <div className='h-2 bg-red-500 transition-all' style={{ width: `${progress}%` }} />
                    </div>
                )}
                {!busy && (
                    <div className='flex flex-col items-start gap-1 mb-4'>
                        <label htmlFor='confirm' className='text-sm text-gray-400'>
                            Type DELETE to confirm
                        </label>
                        <input
                            id='confirm'
                            type='text'
                            className='input w-full text-sm'
                            placeholder='DELETE'
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            autoFocus
                            disabled={busy}
                        />
                        {confirmText && confirmText.trim().toUpperCase() !== 'DELETE' && (
                            <span className='text-[11px] text-red-400'>Confirmation text must be exactly DELETE</span>
                        )}
                    </div>
                )}
                <div className='flex items-center flex-row-reverse gap-2'>
                    <button
                        className='btn btn-danger'
                        onClick={handleDelete}
                        disabled={busy || (confirmText || '').trim().toUpperCase() !== 'DELETE'}
                    >
                        {busy ? 'Deleting…' : 'Delete'}
                    </button>
                    <button className='btn btn-ghost' onClick={onClose} disabled={busy}>Cancel</button>
                </div>
            </div>
        </div>
    )
}
