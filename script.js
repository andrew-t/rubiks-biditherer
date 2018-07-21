const canvas = document.getElementById('canvas'),
	canvas2 = document.getElementById('canvas2'),
	palette = [
		[194,1,21],   // red
		[7,24,179],   // blue
		[251,126,7],  // orange
		[248,219,14], // yellow
		[12,156,13],  // green
		[255,255,255] // white
	],
	fudgeOffset = 0.15, fudgeMax = 0.9, fudgeGamma = 1.2,
	w = 91, h = 57; // which is like 5000 rubiks cubes i mean really

let ditherer;

function load(fn) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(e);
		img.src = fn;
	});
}

load('matt.jpeg').then(init);

function getImageData(img, w, h) {
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, w, h);
	const imgData = ctx.getImageData(0, 0, img.width, img.height);
	// fudge the image into range
	for (let i = 0; i < imgData.data.length; ++i) if (i % 4 != 3)
		imgData.data[i] = Math.pow(Math.pow(imgData.data[i] / 255, fudgeGamma)
			* (fudgeMax - fudgeOffset) + fudgeOffset,
			1 / fudgeGamma) * 256;
	return imgData;
}

async function init(img) {
	const img2 = await load('matt.jpg');
	canvas.width = w;
	canvas.height = h;
	canvas2.width = w;
	canvas2.height = h;
	const ctx = canvas.getContext('2d'),
		ctx2 = canvas2.getContext('2d');
	const imgData = getImageData(img, w, h),
		imgData2 = getImageData(img2, w, h);
	ditherer = new Ditherer(imgData, palette, {
		pixelOrder: 'hilbert'
	});
	ditherer.dither();
	ditherer = new Ditherer(imgData2, palette, {
		pixelOrder: 'hilbert'
	});
	ditherer.dither();
	ctx.putImageData(imgData, 0, 0);
	ctx2.putImageData(imgData2, 0, 0);
}
