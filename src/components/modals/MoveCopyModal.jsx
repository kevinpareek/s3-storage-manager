import React, { useEffect, useMemo, useState } from 'react'
import useCredentials from '../../hooks/useCredentials'
import copyObjectOrFolder from '../../api/copyObjectOrFolder'
import renameFileOrFolder from '../../api/renameFileOrFolder'
import deleteFileOrFolder from '../../api/deleteFileOrFolder'
import headObjectExists from '../../api/headObjectExists'

export default function MoveCopyModal({ isOpen, onClose, item, mode = 'copy', onDone }) {
	const { s3, credentials } = useCredentials()
	const [targetPrefix, setTargetPrefix] = useState('')
	const [action, setAction] = useState('skip') // skip | replace | rename
	const [busy, setBusy] = useState(false)

	// Prefill destination with current directory from localStorage
	useEffect(() => {
		if (isOpen) {
			const cur = localStorage.getItem('currentDirectory') || '/'
			let base = cur.trim()
			if (base === '/') base = ''
			else base = base.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
			setTargetPrefix(base)
			setAction('skip')
		}
	}, [isOpen])



	if (!isOpen || !item) return null

	async function handleSubmit(e) {
		e.preventDefault()
		if (busy) return
		setBusy(true)
		try {
			// Normalize destination base path entered by user
			let dst = (targetPrefix || '').trim()
			// allow absolute-like input, convert to key prefix
			dst = dst.replace(/^\/+/, '')
			// if user typed a directory-like path but item is folder and they didn't include trailing '/', we'll add it later when composing

			const src = item.key
			let finalDest = dst
			const srcIsFolder = item.type === 'folder'
			const lastSeg = dst.split('/').filter(Boolean).pop() || ''
			const dstLooksDir = (
				// empty means current directory
				dst === '' ||
				// explicit trailing slash
				dst.endsWith('/') ||
				// when moving/copying a folder, a path is a container path
				srcIsFolder ||
				// heuristic: a multi-segment path without an extension
				(dst.includes('/') && !lastSeg.includes('.'))
			)
			if (dstLooksDir) {
				const base = srcIsFolder
					? src.replace(/\/$/, '').split('/').pop() + '/'
					: src.split('/').pop()
				finalDest = (dst.endsWith('/') ? dst : (dst ? dst + '/' : '')) + base
			}

			// Prevent copying/moving folder into itself or into its children
			if (srcIsFolder) {
				const srcPrefix = src.endsWith('/') ? src : src + '/'
				const dstPrefix = finalDest.endsWith('/') ? finalDest : finalDest + '/'
				if (dstPrefix.startsWith(srcPrefix)) {
					throw new Error('Destination cannot be inside the source folder')
				}
			}

			// Conflict handling (replace means skip existence check)
			const exists = action === 'replace' ? false : await headObjectExists(s3, finalDest, credentials.name)
			let destKey = finalDest
			if (exists) {
				if (action === 'skip') {
					onDone && onDone(false)
					onClose()
					return
				}
				if (action === 'rename') {
					const parts = finalDest.split('/')
					const last = parts.pop() || ''
					const dot = last.lastIndexOf('.')
					const base = dot > 0 ? last.slice(0, dot) : last
					const ext = dot > 0 ? last.slice(dot) : ''
					let i = 1
					while (await headObjectExists(s3, parts.concat(`${base} (${i})${ext}`).join('/'), credentials.name)) {
						i++
					}
					destKey = parts.concat(`${base} (${i})${ext}`).join('/')
				}
			}

			if (mode === 'copy') {
				await copyObjectOrFolder(s3, src, destKey, credentials.name)
			} else {
				// move = copy then delete original
				await copyObjectOrFolder(s3, src, destKey, credentials.name)
				await deleteFileOrFolder(s3, src, credentials.name)
			}
			onDone && onDone(true)
			onClose()
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className='w-full h-full fixed top-0 left-0 bg-[#000]/50 backdrop-blur-sm flex items-center justify-center px-2 z-50'>
			<div className='w-full max-w-lg card p-5'>
				<h1 className='font-semibold text-xl mb-6 text-white'>{mode === 'copy' ? 'Copy' : 'Move'} Item</h1>
				<form onSubmit={handleSubmit} className='space-y-4'>
					<div>
						<label className='text-sm text-gray-400'>Destination path or folder</label>
						<input className='input w-full text-sm' placeholder='e.g. folder/subfolder/ or folder/newname.ext' value={targetPrefix} onChange={e => setTargetPrefix(e.target.value)} required />
					</div>
					<div>
						<label className='text-sm text-gray-400'>On conflict</label>
						<select className='input text-sm' value={action} onChange={e => setAction(e.target.value)}>
							<option value='skip'>Skip</option>
							<option value='replace'>Replace</option>
							<option value='rename'>Auto rename</option>
						</select>
					</div>
					<div className='flex items-center flex-row-reverse gap-2'>
						<button type='submit' className='btn btn-primary' disabled={busy}>{busy ? 'Working…' : (mode === 'copy' ? 'Copy' : 'Move')}</button>
						<button type='button' className='btn btn-ghost' onClick={onClose} disabled={busy}>Cancel</button>
					</div>
				</form>
			</div>
		</div>
	)
}


