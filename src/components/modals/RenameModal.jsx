import React, { useState, useEffect } from 'react';


export default function RenameModal({ isOpen, handleClose, oldName, onRename }) {
    // Split oldName into base name and extension
    const getNameParts = (name) => {
        const lastDot = name.lastIndexOf('.');
        if (lastDot > 0 && lastDot < name.length - 1) {
            return [name.substring(0, lastDot), name.substring(lastDot)];
        }
        return [name, ''];
    };

    const [baseName, extension] = getNameParts(oldName || '');
    const [newBaseName, setNewBaseName] = useState(baseName);

    // Sync newBaseName with oldName whenever modal opens or oldName changes
    useEffect(() => {
        if (isOpen) {
            const [b, _e] = getNameParts(oldName || '');
            setNewBaseName(b);
        }
    }, [isOpen, oldName]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onRename(newBaseName + extension);
    };

    return (
        <div className="w-full h-full fixed top-0 left-0 bg-[#000]/50 backdrop-blur-sm flex items-center justify-center px-2">
            <div className="w-full max-w-lg card p-5">
                <h1 className="font-semibold text-xl mb-6 bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent">
                    Rename
                </h1>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex flex-col items-start gap-1">
                        <label htmlFor="rename" className="text-sm text-gray-400">New Name</label>
                        <div className="flex w-full">
                            <input
                                type="text"
                                name="rename"
                                value={newBaseName}
                                onChange={e => setNewBaseName(e.target.value)}
                                className="input rounded-r-none text-sm flex-1"
                                autoFocus
                                required
                            />
                            {extension && (
                                <span className="inline-flex items-center px-3 bg-[#232323] border border-l-0 border-[#232323] rounded-r-md text-gray-400 text-sm select-none cursor-not-allowed">
                                    {extension}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center flex-row-reverse gap-2">
                        <button onClick={handleClose} type="button" className="btn btn-ghost mt-4">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary mt-4">
                            Rename
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
