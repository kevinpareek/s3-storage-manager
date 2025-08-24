// Simple client-side zipping using JSZip. For very large selections,
// prefer a server-side zip or streamed archive.
import JSZip from 'jszip'

export default async function zipAndDownload(files, fileName = 'archive.zip') {
	const zip = new JSZip()
	for (const f of files) {
		// f: { name: 'path/in/zip.ext', blob | arrayBuffer }
		if (f.blob) zip.file(f.name, f.blob)
		else if (f.arrayBuffer) zip.file(f.name, f.arrayBuffer)
	}
	const blob = await zip.generateAsync({ type: 'blob' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = fileName
	document.body.appendChild(a)
	a.click()
	setTimeout(() => {
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}, 0)
}


