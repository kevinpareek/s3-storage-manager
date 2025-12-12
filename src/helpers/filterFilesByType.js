import { fileCategory } from './mimeGuess';

export default function filterFilesByType(files, type) {
    if (!type || type === 'all') return files;
    return files.filter(file => {
        if (file.type === 'folder') return false;
        const cat = fileCategory(file.name);
        return cat === type;
    });
}
