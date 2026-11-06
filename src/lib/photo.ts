/** Zdjęcie z aparatu zmniejszone do ~800 px (JPEG) – żeby zmieściło się w lokalnym magazynie makiety */
export async function compressPhoto(file: File, max = 800): Promise<string> {
	let url = URL.createObjectURL(file);
	try {
		let img = new Image();
		img.src = url;
		await img.decode();
		let scale = Math.min(1, max / Math.max(img.width, img.height));
		let canvas = document.createElement('canvas');
		canvas.width = Math.round(img.width * scale);
		canvas.height = Math.round(img.height * scale);
		canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL('image/jpeg', 0.6);
	} finally {
		URL.revokeObjectURL(url);
	}
}
