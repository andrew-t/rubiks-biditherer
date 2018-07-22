class Biditherer {
	constructor(imgData1, imgData2, palette, options = {}) {
		// this whole thing assumes the coords in img2 match those in img1, which happens if you mirror img2
		this.imgData = [ imgData1, imgData2 ];
		if (imgData1.width != imgData2.width) throw new Error('Width mismatch');
		if (imgData1.height != imgData2.height) throw new Error('Height mismatch');
		if (imgData1.width % 3) throw new Error('Width must be threes');
		if (imgData1.height % 3) throw new Error('Height must be threes');
		this.width = imgData1.width;
		this.height = imgData1.height;
		this.data = this.imgData.map(x => Array.from(x.data));
		this.palette = palette;
		this.options = options;
		this.toDither = [];
		for (let y = 0; y < this.height; ++y) {
			this.toDither[y] = [];
			for (let x = 0; x < this.width; ++x)
				this.toDither[y][x] = true;
		}
		this.centreCandidates = this.palette.map((col, i) => [ col, this.palette[5 - i]]);
		const s = Date.now(); console.log('crossing', s - Date.now());
		const palIs = this.palette.map((x, i) => i),
			pal2 = Biditherer.cross(palIs, palIs),
			pal4 = Biditherer.cross(pal2, pal2),
			pal8 = Biditherer.cross(pal4, pal4);
		console.log('filtering', s - Date.now());
		this.otherCandidates = pal8
			.map(Biditherer.flatten)
			.filter((c, i) => {
				// you can't have more than 4 of any colour
				for (let i = 0; i < palIs.length; ++i)
					if (c.filter(c => c == i).length > 4)
						return false;
				// you also can't have all four be the same colour on both sides
				// unless those colours are opposites.
				if (c[0] == c[1] && c[1] == c[2] && c[2] == c[3] &&
					c[4] == c[5] && c[5] == c[6] && c[6] == c[7] &&
					c[4] == 5 - c[0])
						return false;
				return true;
			})
			.map(c => c.map(c => this.palette[c]));
		console.log('done', s - Date.now());
		console.log('ideal edge options:', pal8.length);
		console.log('edge options:', this.otherCandidates.length);
		this.pixDone = 0;
		this.totalPix = this.width * this.height;
	}

	dither() {
		const s = Date.now(); console.log('dithering centres', s - Date.now());
		this.ditherCentres();
		console.log('dithering edges', s - Date.now());
		this.ditherEdges();
		console.log('dithering corners', s - Date.now());
		this.ditherCorners();
		console.log('done', s - Date.now());
	}

	ditherCentres() {
		for (const { x, y } of this.centreCoords())
			this.ditherPixel(x, y, this.centreCandidates);
	}

	ditherEdges() {
		for (const { x, y } of this.centreCoords())
			this.ditherPixels([
				{ x: x + 1, y }, { x, y: y + 1 },
				{ x: x - 1, y }, { x, y: y - 1 }
			], this.otherCandidates);
	}

	ditherCorners() {
		for (const { x, y } of this.centreCoords())
			this.ditherPixels([
				{ x: x - 1, y: y + 1 }, { x: x + 1, y: y + 1 },
				{ x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 }
			], this.otherCandidates);
	}

	*centreCoords() {
		// for (let y = 1; y < this.height; y += 3)
		// 	for (let x = 1; x < this.width; x += 3)
		// 		yield { x, y };
		for (const { x, y } of this.unfilteredCentreCoords())
			if (x > 0 && x < this.width && y > 0 && y < this.height)
				yield { x, y };
	}
	*unfilteredCentreCoords() {
		const cy = this.centreCentre(this.height),
			cx = this.centreCentre(this.width),
			d = cx + cy + 2;
		yield { x: cx, y: cy };
		for (let i = 3; i < d; i += 3) 
			for (let j = 0; j < i; j += 3) {
				yield { x: cx - j,     y: cy - i + j};
				yield { x: cx + j,     y: cy + i - j};
				yield { x: cx + i - j, y: cy - j};
				yield { x: cx - i + j, y: cy + j};
			}
	}
	centreCentre(len) { return Math.round(len / 6) * 3 - 2; }

	ditherPixel(x, y, candidates) {
		const col = this.getPixel(x, y),
			{ error, nearest } = this.nearest(col, candidates);
		this.setPixel(x, y, nearest);
		this.diffuseError(error, x, y);
	}
	ditherPixels(pixels, candidates) {
		const cols = Biditherer.flatten1(pixels.map(({ x, y }) => this.getPixel(x, y))),
			{ error, nearest } = this.nearest(cols, candidates);
		pixels.forEach(({ x, y }, i) => {
			this.setPixel(x, y, [ nearest[i], nearest[i + 4] ]);
			this.diffuseError([ error[i], error[i + 4] ], x, y);
		});
	}

	diffuseError(error, x, y) {
		let totalDiffusion = 0;
		for (let dy = -1; dy < 2; ++dy)
			for (let dx = -1; dx < 2; ++dx)
				if (this.needsToDither(x + dx, y + dy))
					totalDiffusion += this.ditheriness(dx, dy);
		if (totalDiffusion == 0)
			return;
		for (let dy = -1; dy < 2; ++dy)
			for (let dx = -1; dx < 2; ++dx)
				this.addError(x + dx, y + dy, error, this.ditheriness(dx, dy) / totalDiffusion);
	}
	ditheriness(x, y) { return (!x && !y) ? 0 : ((x && y) ? (this.options.cornerDitheriness || 0.5) : (this.options.sideDitheriness || 0.5)); }
	needsToDither(x, y) { return !!this.toDither[y] && this.toDither[y][x]; }
	addError(x, y, error, multiplier) {
		return;
		const i = (x + y * this.width) * 4,
			gamma = this.options.gamma || 1.2;
		error.forEach((c, k) => c.forEach((c, j) => {
			const real = (this.data[k][i + j] / 255) ** (1 / gamma);
			this.data[k][i + j] = ((real + c / 255) ** gamma) * 256;
		}));
	}

	getPixel(x, y) {
		const i = (x + y * this.width) * 4,
			gamma = 1 / (this.options.gamma || 1.2),
			col = this.data.map(d => d.slice(i, i + 3) // opacity be damned
				.map(c => ((c / 256) ** gamma) * 256));
		// if (Biditherer.flatten(col).some(isNaN)) throw new Error('pix is nan');
		return col;
	}

	setPixel(x, y, cols) {
		this.toDither[y][x] = false;
		const i = (x + y * this.width) * 4,
			gamma = this.options.gamma || 1.2;
		cols.forEach((c, k) => c.forEach((c, j) =>
			this.imgData[k].data[i + j] = ((c / 256) ** gamma) * 256));
		if (++this.pixDone % 100 == 0)
			console.log(`${this.pixDone} pixels done. (${this.pixDone * 100 / this.totalPix}%)`);
	}

	distance(a, b) {
		// TODO - this should probably not add errors from different images
		// (and maybe not different pixels) in quadrature
		return Ditherer
			.join(Biditherer.flatten(a), Biditherer.flatten(b),
				(a, b) => Math.abs(a - b))
			.reduce((p, n) => p + n);
	}

	nearest(target, candidates) {
		let error = Infinity, best = null;
		candidates.forEach(candidate => {
			const dist = this.distance(target, candidate);
			if (dist < error) {
				error = dist;
				best = candidate;
			}
		});
		// if (Math.random() < 0.00001) console.log(target, best)
		const result = {
			error: Biditherer.join2(target, best, (a, b) => a - b),
			distance: error,
			nearest: best
		};
		// if (isNaN(result.distance)) throw new Error('distance is nan');
		// if (Biditherer.flatten(result.error).some(isNaN)) throw new Error('error is nan');
		// if (Biditherer.flatten(result.nearest).some(isNaN)) throw new Error('nearest is nan');
		return result;
	}

	static join2(a, b, mapper) {
		return Ditherer.join(a, b,
			(a, b) => Ditherer.join(a, b, mapper));
	}

	static flatten(a) {
		return Array.isArray(a) ? Biditherer.flatten1(a.map(Biditherer.flatten)) : a;
	}

	static flatten1(a) {
		return Array.isArray(a[0]) ? a.reduce((p, n) => p.concat(n)) : a;
	}

	static cross(a, b) {
		return Biditherer.flatten1(a.map(a => b.map(b => [ a, b ])));
	}
}
