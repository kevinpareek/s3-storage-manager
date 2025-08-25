import { Folder, LoaderCircle, Home, MoreVertical, Info, Image as ImageIcon, Video as VideoIcon, Music as MusicIcon, FileText, Code, Archive } from 'lucide-react'
import deleteFileOrFolder from '../api/deleteFileOrFolder'
import getFilePreview from '../api/getFilePreview'
import useCredentials from '../hooks/useCredentials'
import { useState, useEffect } from 'react'
import DeleteConfirmModal from './modals/DeleteConfirmModal'
import { fileCategory } from '../helpers/mimeGuess'

export default function Finder({ contents = [], setCurrentDirectory, onRename, onDelete, onOpenInfo, onCopy, onMove, onPreview, onDownloadFolder, showItemPath = false, loading = false, selectedKeys = new Set(), onToggleSelect, onToggleSelectAll, onSelectFromContext }) {

    const { s3, credentials } = useCredentials()
    const [isDeletingFileOrFolder, setIsDeletingFileOrFolder] = useState(false)
    const [deletingFileOrFolderKey, setDeletingFileOrFolderKey] = useState(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null) // { key, type, name }
    const [openMenuKey, setOpenMenuKey] = useState(null)

    // Close the context menu on outside click or when pressing Escape
    useEffect(() => {
        function handleDocumentClick() {
            setOpenMenuKey(null)
        }
        function handleKeyDown(e) {
            if (e.key === 'Escape') setOpenMenuKey(null)
        }
        document.addEventListener('click', handleDocumentClick)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('click', handleDocumentClick)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    function handleFilePreview(item) {
        if (onPreview) onPreview(item)
    }

    async function handleDeleteFileOrFolder({ key, type }) {
        try {
            if (!s3 || !credentials) {
                console.error('S3 client or credentials not ready for delete');
                return;
            }
            setIsDeletingFileOrFolder(true)
            setDeletingFileOrFolderKey(key)
            await deleteFileOrFolder(s3, key, credentials.name)
        // Directory logic
        if (type === 'folder') {
            // Remove trailing slash if present
            let folderPath = key.endsWith('/') ? key.slice(0, -1) : key;
            const parts = folderPath.split('/').filter(Boolean);
            parts.pop(); // Remove deleted folder
            const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
            setCurrentDirectory(parentPath);
        } else {
            // For file, stay in same directory
            let filePath = key;
            const parts = filePath.split('/').filter(Boolean);
            parts.pop(); // Remove file name
            const currentDir = parts.length > 0 ? '/' + parts.join('/') : '/';
            setCurrentDirectory(currentDir);
        }
        } catch (err) {
            console.error('Error deleting file/folder', err)
        } finally {
            setDeletingFileOrFolderKey(null)
            setIsDeletingFileOrFolder(false)
            setDeleteModalOpen(false)
            setDeleteTarget(null)
        }
    // Trigger parent refresh if provided
    if (onDelete) onDelete();
    }

    async function handleFileDownload(key) {
        try {
            if (!s3 || !credentials) {
                console.error('S3 client or credentials not ready for download');
                return;
            }
            const previewUrl = await getFilePreview(s3, key, true, credentials.name, credentials.publicUrl)
            window.open(previewUrl, 'download')
        } catch (err) {
            console.error('Error downloading file', err)
        }
    }

    console.log(contents)

    return (
        <>
            <div className='divide-y divide-[#252525]'>
                {/* Header row with select all when there are contents */}
                {!loading && contents.length > 0 && (
                    <div className='flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0f0f0f] md:sticky md:top-[52px]'>
                        <label className='inline-flex items-center gap-2 text-xs text-gray-300'>
                            <input
                                type='checkbox'
                                checked={selectedKeys.size > 0 && selectedKeys.size === contents.length}
                                ref={el => {
                                    if (!el) return
                                    el.indeterminate = selectedKeys.size > 0 && selectedKeys.size < contents.length
                                }}
                                onChange={() => onToggleSelectAll && onToggleSelectAll()}
                            />
                            Select all
                        </label>
                        <span className='text-[11px] text-gray-500 font-mono'>Items: {contents.length}</span>
                    </div>
                )}
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <LoaderCircle size={22} className="animate-spin text-yellow-400" />
                    </div>
                ) : contents.length > 0 ? (
                    contents.map((content, index) => (
                        <div key={index} className={`relative flex items-center justify-between px-3 sm:px-4 py-3 hover:bg-[#0f0f0f] transition-colors ${selectedKeys.has(content.key) ? 'bg-[#0c0c0c]' : ''}`}>
                            <span className='flex items-center gap-3 min-w-0'>
                                <input type='checkbox' checked={selectedKeys.has(content.key)} onChange={() => onToggleSelect && onToggleSelect(content)} />
                                {content.type === 'folder' ? (
                                    <Folder size={18} className='text-yellow-500' />
                                ) : (
                                    (() => {
                                        const cat = fileCategory(content.name)
                                        switch (cat) {
                                            case 'image': return <ImageIcon size={18} className='text-pink-400' />
                                            case 'video': return <VideoIcon size={18} className='text-purple-400' />
                                            case 'audio': return <MusicIcon size={18} className='text-green-400' />
                                            case 'document': return <FileText size={18} className='text-blue-400' />
                                            case 'code': return <Code size={18} className='text-cyan-400' />
                                            case 'archive': return <Archive size={18} className='text-orange-400' />
                                            default: return <FileText size={18} className='text-gray-400' />
                                        }
                                    })()
                                )}

                                <div className='min-w-0'>
                                    <p
                                        className={`text-yellow-500 cursor-pointer text-xs font-mono truncate max-w-[55vw] sm:max-w-none`}
                                        onClick={() => {
                                            if (content.type === 'folder') {
                                                setCurrentDirectory('/' + content.key)
                                            } else {
                                                handleFilePreview(content)
                                            }
                                        }}
                                    >
                                        {content.name}
                                    </p>
                                    {/* Show path only when searching/filtering, because items can be from different folders */}
                                    {showItemPath && content.key && content.key.split('/').filter(Boolean).length > 1 && (() => {
                                        // Remove the trailing slash for folders
                                        let path = content.key;
                                        if (content.type === 'folder' && path.endsWith('/')) path = path.slice(0, -1);
                                        // Remove the file/folder name from the end
                                        const parts = path.split('/').filter(Boolean);
                                        parts.pop();
                                        // Breadcrumbs: each folder clickable
                                        let breadcrumb = [];
                                        // Home icon
                                        breadcrumb.push(
                                            <span key="home">
                                                <Home
                                                    size={12}
                                                    className="inline align-middle text-blue-400 cursor-pointer hover:underline mr-1"
                                                    onClick={() => setCurrentDirectory('/')}
                                                />
                                                {parts.length > 0 && <span className="text-gray-400"> / </span>}
                                            </span>
                                        );
                                        for (let idx = 0; idx < parts.length; idx++) {
                                            // Build absolute path for each segment
                                            const absPath = '/' + parts.slice(0, idx + 1).join('/');
                                            // breadcrumb for each folder segment
                                            breadcrumb.push(
                                                <span key={absPath}>
                                                    <span
                                                        className="text-blue-400 cursor-pointer hover:underline"
                                                        onClick={() => setCurrentDirectory(absPath)}
                                                    >
                                                        {parts[idx]}
                                                    </span>

                                                    {idx < parts.length - 1 && <span className="text-gray-400"> / </span>}
                                                </span>
                                            );
                                        }
                                        return (
                                            <span className="block text-[10px] font-mono ml-1 break-words">
                                                {breadcrumb}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </span>
                            <div className='flex items-center gap-4 ml-3 flex-shrink-0'>
                                <Info
                                    size={18}
                                    className='text-blue-300 cursor-pointer'
                                    onClick={() => onOpenInfo && onOpenInfo(content)}
                                />
                                <MoreVertical
                                    size={18}
                                    className='text-gray-300 cursor-pointer'
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuKey((k) => k === content.key ? null : content.key) }}
                                />
                                {deletingFileOrFolderKey == content.key && isDeletingFileOrFolder && (
                                    <LoaderCircle size={18} className='text-yellow-300 animate-spin' />
                                )}
                            </div>
                            {openMenuKey === content.key && (
                                <div className='absolute right-4 top-full mt-1 w-44 bg-[#181818] border border-[#232323] rounded-md shadow-lg z-40'
                                     onClick={(e) => e.stopPropagation()}>
                    {content.type === 'folder' ? (
                                        <div>
                                            <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); setCurrentDirectory('/' + content.key) }}>Open</div>
                        <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onDownloadFolder && onDownloadFolder(content) }}>Download as ZIP</div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); handleFilePreview(content) }}>Preview</div>
                                            <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); handleFileDownload(content.key) }}>Download</div>
                                        </div>
                                    )}
                                    <div className='border-t border-[#232323]' />
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onSelectFromContext && onSelectFromContext(content) }}>{selectedKeys.has(content.key) ? 'Deselect' : 'Select'}</div>
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onCopy && onCopy(content) }}>Copy to…</div>
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onMove && onMove(content) }}>Move to…</div>
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onRename && onRename(content) }}>Rename</div>
                                    <div className='border-t border-[#232323]' />
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs text-red-300 hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); setDeleteModalOpen(true); setDeleteTarget({ key: content.key, type: content.type, name: content.name }) }}>Delete</div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-500 font-mono ">
                        No files or folders in this directory.
                    </div>
                )}
            </div>
            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                handleClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
                onConfirm={() => deleteTarget && handleDeleteFileOrFolder(deleteTarget)}
                type={deleteTarget?.type}
                name={deleteTarget?.name}
            />
        </>
    )
}
