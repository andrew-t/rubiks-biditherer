class Ditherer {
	constructor(imgData, palette, options) {
		this.imgData = imgData;
		this.width = imgData.width;
		this.height = imgData.height;
		this.data = Array.from(imgData.data);
		this.palette = palette;
		this.options = options || {};
	}

	dither() {
		let cumError = [0, 0, 0];
		for (let { x, y, col } of this.pixels()) {
			switch (this.options.diffusion) {
				case 'none': break;
					this.setPixel(x, y, this.nearest(col).nearest);
				case undefined:
				case 'simple-decay':
					col = Ditherer.join(col, cumError, (a, b) => a + b);
					const { error, nearest } = this.nearest(col);
					this.setPixel(x, y, nearest);
					Ditherer.mapInPlace(cumError, c => c * this.options.diffusionDecay || 0.8);
					cumError = Ditherer.join(cumError, error, (a, b) => a + b);
					break;
				default: throw new Error('Bad diffusion: ', this.options.diffusion);
			}
		}
	}

	*pixelCoords() {
		switch (this.options.pixelOrder) {
			case 'naive': // naive looping across each 
				for (let y = 0; y < this.height; ++y)
					for (let x = 0; x < this.width; ++x)
						yield { x, y };
				break;
			case 'serpentine': // back and forth like snakes and ladders 
				for (let y = 0; y < this.height; ++y) {
					for (let x = 0; x < this.width; ++x)
						yield { x, y };
					if (++y < this.height)
						for (let x = this.width - 1; x >= 0; --x)
							yield { x, y };
				}
				break;
			case 'hilbert':
			case undefined: // this is the default
				const hilbert = new HilbertCurve().drawToSize(Math.max(this.width, this.height));
				for (const { x, y } of hilbert)
					if (x < this.width && y < this.height)
						yield { x, y };
				break;
			default: throw new Error('Bad pixelOrder: ', this.options.pixelOrder);
		}
	}

	*pixels() {
		for (let { x, y } of this.pixelCoords())
			yield { x, y, col: this.getPixel(x, y) };
	}

	getPixel(x, y) {
		const i = (x + y * this.width) * 4,
			gamma = 1 / (this.options.gamma || 1.2);
		return this.data.slice(i, i + 3) // opacity be damned
			.map(c => ((c / 256) ** gamma) * 256);
	}

	setPixel(x, y, col) {
		const i = (x + y * this.width) * 4,
			gamma = this.options.gamma || 1.2;
		col.forEach((c, j) => this.imgData.data[i + j] = ((c / 256) ** gamma) * 256);
	}

	distance(a, b) {
		// euclidian distance
		return Math.sqrt(
			Ditherer.join(a, b, (a, b) => (a - b) * (a - b))
				.reduce((p, n) => p + n));
	}

	nearest(target) {
		let error = Infinity, best = null;
		this.palette.forEach(candidate => {
			const dist = this.distance(target, candidate);
			if (dist < error) {
				error = dist;
				best = candidate;
			}
		});
		// if (Math.random() < 0.00001) console.log(target, best)
		return {
			error: Ditherer.join(target, best, (a, b) => a - b),
			distance: error,
			nearest: best
		};
	}

	static join(a, b, mapper) {
		if (a.length != b.length)
			throw new Error('Length mismatch');
		let arr = [];
		for (let i = 0; i < a.length; ++i)
			arr[i] = { a: a[i], b: b[i] };
		return mapper
			? arr.map(({ a, b }) => mapper(a, b))
			: arr;
	}

	static mapInPlace(arr, func) {
		arr.forEach((n, i) => arr[i] = func(n, i));
	}
}
