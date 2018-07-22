const canvas = document.getElementById('canvas'),
	canvas2 = document.getElementById('canvas2'),
	palette = [
		// p[5-n] is opposite p[n]
		[248,219,14], // yellow
		[194,1,21],   // red
		[7,24,179],   // blue
		[12,156,13],  // green
		[251,126,7],  // orange
		[255,255,255] // white
	].map(c => c.map(c => ((c / 255) ** 1.2) * 255)),
	fudgeOffset = 0.2, fudgeMax = 0.9, fudgeGamma = 1.2,
//	w = 120, h = 90;
	w = 90, h = 57; // which is like 5000 rubiks cubes i mean really

let ditherer;

function load(el) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(e);
		img.src = document.getElementById(el).getAttribute('src');
	});
}

load('original').then(init);

function getImageData(img, w, h) {
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, w, h);
	const imgData = ctx.getImageData(0, 0, w, h);
	// fudge the image into range
	for (let i = 0; i < imgData.data.length; ++i) if (i % 4 != 3)
		imgData.data[i] = Math.pow(Math.pow(imgData.data[i] / 255, fudgeGamma)
			* (fudgeMax - fudgeOffset) + fudgeOffset,
			1 / fudgeGamma) * 256;
	return imgData;
}

async function init(img) {
	const img2 = await load('original2');
	canvas.width = w;
	canvas.height = h;
	canvas2.width = w;
	canvas2.height = h;
	const ctx = canvas.getContext('2d'),
		ctx2 = canvas2.getContext('2d');
	const imgData = getImageData(img, w, h),
		imgData2 = getImageData(img2, w, h);
	ditherer = new Biditherer(imgData, imgData2, palette, {
		distanceFactor: [ 0.8, 1.0, 0.6 ]
	});
	ditherer.dither();
	ctx.putImageData(imgData, 0, 0);
	ctx2.putImageData(imgData2, 0, 0);
}
