import { CloudUpload, FileText, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import MultiPartUpload from '../api/MultiPartUpload'
import useCredentials from '../hooks/useCredentials'

export default function FileDropper({ currentDirectory = "", uploading = false, setUploading }) {
    const [isDragging, setIsDragging] = useState(false)
    const [files, setFiles] = useState([])
    const [uploadingIndex, setUploadingIndex] = useState(null)
    const { s3, credentials } = useCredentials()

    // Read all entries from a directory reader (Chrome/Safari webkit entries)
    async function readAllDirectoryEntries(directoryReader) {
        const entries = []
        // Keep calling readEntries() until it returns an empty array
        // to ensure we get all entries within this directory
        // (readEntries may return only a subset per call)
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const batch = await new Promise((resolve, reject) => {
                try {
                    directoryReader.readEntries(resolve, reject)
                } catch (err) {
                    reject(err)
                }
            })
            if (!batch || batch.length === 0) break
            entries.push(...batch)
        }
        return entries
    }

    // Traverse a FileSystemEntry (file or directory) and collect File objects
    async function traverseFileTree(entry, path = "") {
        return new Promise(async (resolve, reject) => {
            try {
                if (entry.isFile) {
                    entry.file((file) => {
                        // Preserve relative path for folder uploads
                        const relativePath = `${path}${file.name}`
                        try {
                            // Attach a synthetic relativePath if webkitRelativePath is unavailable
                            // This is safe and used only by our upload logic
                            // eslint-disable-next-line no-param-reassign
                            file.relativePath = relativePath
                        } catch (_) {
                            // If assignment fails, we still proceed using webkitRelativePath or name later
                        }
                        resolve([file])
                    }, reject)
                } else if (entry.isDirectory) {
                    const reader = entry.createReader()
                    const entries = await readAllDirectoryEntries(reader)
                    const nestedFilesArrays = await Promise.all(
                        entries.map((ent) => traverseFileTree(ent, `${path}${entry.name}/`))
                    )
                    resolve(nestedFilesArrays.flat())
                } else {
                    resolve([])
                }
            } catch (error) {
                reject(error)
            }
        })
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

    const handleDrop = useCallback(async (e) => {
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
            const collectedFiles = collectedArrays.flat()
            setFiles(prevFiles => [...prevFiles, ...collectedFiles])
        } else {
            const droppedFiles = Array.from(dtFiles)
            setFiles(prevFiles => [...prevFiles, ...droppedFiles])
        }
    }, [])

    const handleFileInput = useCallback((e) => {
        const selectedFiles = Array.from(e.target.files)
        setFiles(prevFiles => [...prevFiles, ...selectedFiles])
    }, [])

    const removeFile = useCallback((index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
    }, [])

    async function handleFilesUpload() {
        setUploading(true)

        for (let i = 0; i < files.length; i++) {
            setUploadingIndex(i)

            const file = files[i]
            const success = await MultiPartUpload(s3, file, currentDirectory, credentials.name)

            if (!success) {
                console.error(`Upload failed: ${file.name}`)
                break
            }
        }

        // Reset
        setFiles([])
        setUploadingIndex(null)
        setUploading(false)
    }

    useEffect(() => {
        console.log(uploading)
        if (files.length > 0 && !uploading) {
            handleFilesUpload()
        }
    }, [files, credentials, currentDirectory, uploading])

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

            {files.length > 0 && (
                <div className="mt-6 space-y-2">
                    <h5 className="font-mono text-xs text-gray-500 mb-2">
                        {uploading ? `Uploading files... (${uploadingIndex + 1}/${files.length})` : `Selected files (${files.length})`}
                    </h5>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className={`${(uploading == true && uploadingIndex > index) && 'hidden'} flex items-center justify-between p-3 rounded-md ${index === uploadingIndex ? 'bg-green-900 border border-green-600' : 'card'}`}
                            >
                                <div className="flex items-center space-x-2">
                                    <FileText size={18} className='text-gray-500' />
                                    <span className="font-mono text-xs text-gray-300 truncate max-w-xs">
                                        {file.webkitRelativePath || file.relativePath || file.name}
                                    </span>
                                </div>

                                {!uploading && (
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="text-gray-500 hover:text-gray-300"
                                    >
                                        <X size={18} className='text-gray-500 cursor-pointer' />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
