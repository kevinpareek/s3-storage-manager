
export default function isFile(name = "") {
    const lastSegment = name.split('/').pop() || name;
    const hasExtension = lastSegment.includes('.') && !lastSegment.startsWith('.');

    return hasExtension ? true : false;
}
