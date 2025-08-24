
import { useEffect, useState, useCallback } from 'react'

import FileDropper from './FileDropper'
import Finder from './Finder'
import listFiles from '../api/listFiles'
import getFilePreview from '../api/getFilePreview'
import getFolderStats from '../api/getFolderStats'
import CreateFolderModal from './modals/CreateFolderModal'
import InfoModal from './modals/InfoModal'
import PreviewModal from './modals/PreviewModal'
import RenameModal from './modals/RenameModal'
import MoveCopyModal from './modals/MoveCopyModal'
import BulkDeleteModal from './modals/BulkDeleteModal'
import useCredentials from '../hooks/useCredentials'
import renameFileOrFolder from '../api/renameFileOrFolder'
import renameFolder from '../api/renameFolder'
import searchFilesAndFolders from '../api/searchFilesAndFolders'
import filterFilesByType from '../helpers/filterFilesByType'
import { Home } from 'lucide-react'
import useDebounce from '../hooks/useDebounce'


export default function Container() {
    const [refreshFlag, setRefreshFlag] = useState(0);
    const [files, setFiles] = useState([])
    const [continuationToken, setContinuationToken] = useState(null)
    const [hasMore, setHasMore] = useState(false)
    const [hasPaged, setHasPaged] = useState(false)
    const [folderName, setFolderName] = useState('')
    const [currentDirectory, setCurrentDirectory] = useState("/")
    const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
    const { s3, credentials } = useCredentials()
    const [uploading, setUploading] = useState(false)
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [renameTarget, setRenameTarget] = useState(null)
    const [moveCopyOpen, setMoveCopyOpen] = useState(false)
    const [moveCopyMode, setMoveCopyMode] = useState('copy')
    const [moveCopyItem, setMoveCopyItem] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const debouncedSearchTerm = useDebounce(searchTerm, 400)
    const [filterType, setFilterType] = useState('all')
    const [loading, setLoading] = useState(false)
    const [infoModalOpen, setInfoModalOpen] = useState(false)
    const [infoItem, setInfoItem] = useState(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewItem, setPreviewItem] = useState(null)
    const [shareUrl, setShareUrl] = useState(null)
    const [downloadUrl, setDownloadUrl] = useState(null)
    const [isGeneratingUrls, setIsGeneratingUrls] = useState(false)
    // Bulk selection
    const [selectedKeys, setSelectedKeys] = useState(new Set())
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

    const handleSetCurrentDirectory = useCallback(
        (location) => {
            localStorage.setItem('currentDirectory', location)
            setCurrentDirectory(location)
            // Clear selection on navigation
            setSelectedKeys(new Set())
        }, [])

    function handleBack() {
        const parts = currentDirectory.split("/").filter(Boolean);
        parts.pop();
        handleSetCurrentDirectory("/" + parts.join("/"));
    }

    useEffect(() => {
        const onPopState = () => {
            handleBack();
        };
        window.addEventListener("popstate", onPopState);

        return () => {
            window.removeEventListener("popstate", onPopState);
        };
    }, [currentDirectory])

    // Helper to load files for current directory (first page)
    const loadFiles = useCallback(async () => {
        // Don't attempt to list when credentials or S3 client are not ready
        if (!credentials || !s3) return;
        setLoading(true);
        try {
            const location = localStorage.getItem('currentDirectory') || '/';
            let contents = [];
            if (debouncedSearchTerm) {
                contents = await searchFilesAndFolders(s3, location, debouncedSearchTerm, credentials.name);
                setContinuationToken(null)
                setHasMore(false)
                setHasPaged(false)
            } else if (filterType && filterType !== 'all') {
                contents = await searchFilesAndFolders(s3, location, '', credentials.name);
                setContinuationToken(null)
                setHasMore(false)
                setHasPaged(false)
            } else {
                const res = await listFiles(s3, location, credentials.name);
                contents = res.items
                setContinuationToken(res.nextContinuationToken || null)
                setHasMore(Boolean(res.isTruncated))
                setHasPaged(false)
            }
            if (filterType && filterType !== 'all') {
                contents = filterFilesByType(contents, filterType);
            }
            setFiles(contents);
            // Drop selections that aren't in the current list anymore
            setSelectedKeys(prev => {
                const next = new Set()
                const keys = new Set((contents || []).map(c => c.key))
                prev.forEach(k => { if (keys.has(k)) next.add(k) })
                return next
            })
        } catch (err) {
            console.error('Error loading files', err);
            // clear files on error to avoid stale UI state
            setFiles([]);
            setContinuationToken(null)
            setHasMore(false)
        } finally {
            setLoading(false);
        }
    }, [credentials, s3, debouncedSearchTerm, filterType]);

    useEffect(() => {
        setCurrentDirectory(localStorage.getItem('currentDirectory') || '/');
    }, [credentials]);

    useEffect(() => {
        if (!isCreateFolderModalOpen) {
            loadFiles();
        }
        // eslint-disable-next-line
    }, [currentDirectory, uploading, isCreateFolderModalOpen, debouncedSearchTerm, filterType, refreshFlag, loadFiles]);

    const loadMore = useCallback(async () => {
        if (!credentials || !s3) return;
        if (!hasMore || !continuationToken) return;
        setLoading(true);
        try {
            const location = localStorage.getItem('currentDirectory') || '/';
            const res = await listFiles(s3, location, credentials.name, { continuationToken });
            let nextItems = res.items
            if (filterType && filterType !== 'all') {
                nextItems = filterFilesByType(nextItems, filterType)
            }
            setFiles(prev => [...prev, ...nextItems])
            setContinuationToken(res.nextContinuationToken || null)
            setHasMore(Boolean(res.isTruncated))
            setHasPaged(true)
        } catch (err) {
            console.error('Error loading more files', err)
        } finally {
            setLoading(false)
        }
    }, [credentials, s3, continuationToken, hasMore, filterType])

    // Generate signed URLs when info modal opens for a file
    useEffect(() => {
        let mounted = true
        async function genUrls() {
            setShareUrl(null)
            setDownloadUrl(null)
            if (!infoItem) return
            setIsGeneratingUrls(true)
            try {
                if (infoItem.type === 'file') {
                    const share = await getFilePreview(s3, infoItem.key, false, credentials.name)
                    const dl = await getFilePreview(s3, infoItem.key, true, credentials.name)
                    if (!mounted) return
                    setShareUrl(share)
                    setDownloadUrl(dl)
                    } else if (infoItem.type === 'folder') {
                    // compute total size and earliest date for the folder
                    try {
                        const stats = await getFolderStats(s3, infoItem.key, credentials.name)
                        if (!mounted) return
                        // set synthetic fields on infoItem for modal display
                        setInfoItem(i => ({ ...i, size: stats.totalSize, created: stats.earliestLastModified, lastModified: stats.latestLastModified }))
                        setShareUrl(null)
                        setDownloadUrl(null)
                    } catch (e) {
                        console.error('Error getting folder stats', e)
                    }
                }
            } catch (err) {
                console.error('Error generating URLs', err)
            } finally {
                if (mounted) setIsGeneratingUrls(false)
            }
        }
        if (infoModalOpen) genUrls()
        return () => { mounted = false }
    }, [infoModalOpen, infoItem])

    return (
        <div className='w-full px-4 py-4 pb-20'>
            <div className='w-full max-w-6xl mx-auto card divide-y divide-[#252525]'>
                <div className='w-full p-4 flex items-center justify-between'>
                    <h4 className='font-mono text-sm text-gray-300 select-none'>Storage</h4>
                    <div className='flex items-center gap-2'>
                        <input
                            type="text"
                            placeholder="Search files/folders"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input text-xs mr-2"
                        />
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="file-type-select input text-xs mr-2"
                        >
                            <option value="all">All Files</option>
                            <option value="image">Images</option>
                            <option value="video">Videos</option>
                            <option value="audio">Audio</option>
                            <option value="document">Documents</option>
                            <option value="code">Code</option>
                            <option value="archive">Archives</option>
                            <option value="other">Other</option>
                        </select>
                        {currentDirectory != "/" &&
                            <button onClick={handleBack} className='btn btn-ghost'>Back</button>
                        }
                        <button onClick={() => setIsCreateFolderModalOpen(true)} className='btn btn-primary'>Add Folder</button>
                    </div>
                </div>
                {/* Drag & Drop above path */}
                <div className='p-4 bg-[#101010]'>
                    <FileDropper
                        currentDirectory={currentDirectory}
                        uploading={uploading}
                        setUploading={setUploading}
                    />
                </div>
                {/* Breadcrumbs moved below header */}
                <div className='w-full px-4 py-2 bg-[#0f0f0f] border-t border-b border-[#202020]'>
                    <div className='font-mono text-[12px] text-gray-400 select-none flex items-center gap-1'>
                        {(() => {
                            let path = currentDirectory;
                            if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
                            const parts = path.split('/').filter(Boolean);
                            let breadcrumb = [];
                            breadcrumb.push(
                                <span key="home">
                                    <Home
                                        size={14}
                                        className="inline align-middle text-blue-400 cursor-pointer hover:underline mr-1"
                                        onClick={() => handleSetCurrentDirectory('/')}
                                    />
                                    {parts.length > 0 && <span className="text-gray-500">/</span>}
                                </span>
                            );
                            for (let idx = 0; idx < parts.length; idx++) {
                                const absPath = '/' + parts.slice(0, idx + 1).join('/');
                                breadcrumb.push(
                                    <span key={absPath}>
                                        <span
                                            className="text-blue-400 cursor-pointer hover:underline"
                                            onClick={() => handleSetCurrentDirectory(absPath)}
                                        >
                                            {parts[idx]}
                                        </span>
                                        {idx < parts.length - 1 && <span className="text-gray-500">/</span>}
                                    </span>
                                );
                            }
                            return <span className="flex items-center flex-wrap">{breadcrumb}</span>;
                        })()}
                    </div>
                </div>
                {selectedKeys.size > 0 && (
                    <div className='w-full p-3 bg-[#0e0e0e] border-t border-b border-[#202020] flex items-center justify-between'>
                        <div className='text-xs font-mono text-gray-300'>
                            {selectedKeys.size} selected
                        </div>
                        <div className='flex items-center gap-2'>
                            <button className='btn btn-ghost' onClick={() => { setMoveCopyItem(Array.from(selectedKeys).map(k => files.find(f => f.key === k)).filter(Boolean)); setMoveCopyMode('copy'); setMoveCopyOpen(true) }}>Copy</button>
                            <button className='btn btn-ghost' onClick={() => { setMoveCopyItem(Array.from(selectedKeys).map(k => files.find(f => f.key === k)).filter(Boolean)); setMoveCopyMode('move'); setMoveCopyOpen(true) }}>Move</button>
                            <button className='btn btn-danger' onClick={() => setBulkDeleteOpen(true)}>Delete</button>
                            <button className='btn btn-ghost' onClick={() => setSelectedKeys(new Set())}>Clear</button>
                        </div>
                    </div>
                )}
                <div className='bg-[#101010] rounded-b-xl'>
                    <div>
                        <Finder
                            contents={files}
                            currentDirectory={currentDirectory}
                            loading={loading}
                            setCurrentDirectory={handleSetCurrentDirectory}
                            showItemPath={Boolean(debouncedSearchTerm) || (filterType && filterType !== 'all')}
                            onPreview={(item) => { setPreviewItem(item); setPreviewOpen(true) }}
                            selectedKeys={selectedKeys}
                            onToggleSelect={(item) => {
                                setSelectedKeys(prev => {
                                    const next = new Set(prev)
                                    if (next.has(item.key)) next.delete(item.key)
                                    else next.add(item.key)
                                    return next
                                })
                            }}
                            onToggleSelectAll={() => {
                                setSelectedKeys(prev => {
                                    if (prev.size === files.length) return new Set()
                                    const next = new Set(files.map(f => f.key))
                                    return next
                                })
                            }}
                            onRename={(item) => {
                                setRenameTarget(item)
                                setIsRenameModalOpen(true)
                            }}
                            onDelete={() => setRefreshFlag(f => f + 1)}
                            onOpenInfo={(item) => {
                                setInfoItem(item)
                                setInfoModalOpen(true)
                            }}
                            onCopy={(item) => { setMoveCopyItem(item); setMoveCopyMode('copy'); setMoveCopyOpen(true) }}
                            onMove={(item) => { setMoveCopyItem(item); setMoveCopyMode('move'); setMoveCopyOpen(true) }}
                            onSelectFromContext={(item) => {
                                setSelectedKeys(prev => {
                                    const next = new Set(prev)
                                    if (next.has(item.key)) next.delete(item.key)
                                    else next.add(item.key)
                                    return next
                                })
                            }}
                        />
                        {(!debouncedSearchTerm && (!filterType || filterType === 'all')) && (
                            <div className='p-4 flex items-center justify-center text-sm'>
                                {hasMore && (
                                    <button disabled={loading} onClick={loadMore} className='btn btn-ghost'>
                                        {loading ? 'Loading…' : 'Load more'}
                                    </button>
                                )}
                                {!hasMore && hasPaged && (
                                    <span className='text-gray-500'>No more items</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Modals */}
            <CreateFolderModal
                folderName={folderName}
                setFolderName={setFolderName}
                isOpen={isCreateFolderModalOpen}
                handleClose={() => {
                    setIsCreateFolderModalOpen(false)
                    setFolderName('')
                }}
                currentDirectory={currentDirectory}
                setCurrentDirectory={handleSetCurrentDirectory}
            />
            <RenameModal
                isOpen={isRenameModalOpen}
                handleClose={() => setIsRenameModalOpen(false)}
                oldName={renameTarget?.name}
                onRename={async (newName) => {
                    if (!renameTarget) return;
                    if (renameTarget.type === 'folder') {
                        // Build new prefix keeping parent path (if any)
                        // renameTarget.key is expected to be like 'path/to/folder/'
                        let oldPrefix = renameTarget.key || '';
                        // Remove trailing slash for easier splitting
                        const trimmed = oldPrefix.endsWith('/') ? oldPrefix.slice(0, -1) : oldPrefix;
                        const parts = trimmed.split('/').filter(Boolean);
                        // Replace last segment with newName
                        parts[parts.length - 1] = newName;
                        const newPrefix = parts.length > 0 ? parts.join('/') + '/' : newName + '/';
                        // No-op if prefixes are identical
                        if (oldPrefix === newPrefix) {
                            setIsRenameModalOpen(false);
                            setRenameTarget(null);
                            return;
                        }
                        await renameFolder(s3, oldPrefix, newPrefix, credentials.name)
                    } else {
                        // Keep the file in the same directory, only change the file name
                        const oldKey = renameTarget.key;
                        const lastSlash = oldKey.lastIndexOf('/');
                        let newKey = newName;
                        if (lastSlash !== -1) {
                            newKey = oldKey.substring(0, lastSlash + 1) + newName;
                        }
                        await renameFileOrFolder(s3, oldKey, newKey, credentials.name)
                    }
                    setIsRenameModalOpen(false);
                    setRenameTarget(null);
                    setRefreshFlag(f => f + 1); // trigger file list reload
                }}
            />
            <MoveCopyModal
                isOpen={moveCopyOpen}
                onClose={() => setMoveCopyOpen(false)}
                item={Array.isArray(moveCopyItem) ? null : moveCopyItem}
                items={Array.isArray(moveCopyItem) ? moveCopyItem : null}
                mode={moveCopyMode}
                onDone={(ok) => {
                    if (ok && moveCopyMode === 'move') setRefreshFlag(f => f + 1)
                    setSelectedKeys(new Set())
                }}
            />
            {/* Bulk Delete */}
            <BulkDeleteModal
                isOpen={bulkDeleteOpen}
                onClose={() => setBulkDeleteOpen(false)}
                items={Array.from(selectedKeys).map(k => files.find(f => f.key === k)).filter(Boolean)}
                onDone={() => {
                    setBulkDeleteOpen(false)
                    setSelectedKeys(new Set())
                    setRefreshFlag(f => f + 1)
                }}
            />
            <InfoModal
                isOpen={infoModalOpen}
                onClose={() => setInfoModalOpen(false)}
                item={infoItem}
                shareUrl={shareUrl}
                downloadUrl={downloadUrl}
                isGenerating={isGeneratingUrls}
            />
            <PreviewModal
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
                item={previewItem}
            />
        </div>
    )
}
