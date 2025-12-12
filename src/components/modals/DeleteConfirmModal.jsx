import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, handleClose, onConfirm, type, name }) {
  const [input, setInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false)
      setInput('')
    }
  }, [isOpen])

  if (!isOpen) return null;

  return (
    <div className="w-full h-full fixed top-0 left-0 bg-[#000]/50 backdrop-blur-sm flex items-center justify-center px-2 z-50">
      <div className="w-full max-w-lg card p-5">
        {type === 'folder' ? (
          <>
            <h1 className="font-semibold text-xl mb-6 bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent text-center">
              Delete Folder
            </h1>
            <div className="space-y-3">
              <div className="flex flex-col items-start gap-1">
                <label className="text-sm text-gray-400">Type folder name to confirm</label>
                <input
                  className="input text-sm w-full"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Type '${name}' to confirm`}
                  autoFocus
                  disabled={isDeleting}
                />
                <span className="mt-1 text-xs text-gray-500">Folder: <span className="font-mono bg-[#232323] px-2 py-0.5 rounded text-orange-200">{name}</span></span>
              </div>
              <div className="flex items-center flex-row-reverse gap-2">
                <button onClick={handleClose} type="button" className="btn btn-ghost mt-4" disabled={isDeleting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary mt-4 disabled:opacity-50"
                  disabled={input !== name || isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    setInput('');
                    try {
                      await onConfirm();
                    } catch (e) {
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-semibold text-xl mb-6 bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent text-center">
              Delete File
            </h1>
            <div className="space-y-3">
              <div className="flex flex-col items-start gap-1">
                <label className="text-sm text-gray-400">Are you sure you want to delete this file?</label>
                <span className="font-mono bg-[#232323] px-2 py-0.5 rounded text-orange-200 mt-1">{name}</span>
              </div>
              <div className="flex items-center flex-row-reverse gap-2">
                <button onClick={handleClose} type="button" className="btn btn-ghost mt-4" disabled={isDeleting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary mt-4 disabled:opacity-50"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await onConfirm();
                    } catch (e) {
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
