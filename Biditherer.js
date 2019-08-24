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
		this.wrappedPalette = palette.map(c => [ c ]);
		this.options = options;
		this.toDither = [];
		for (let y = 0; y < this.height; ++y) {
			this.toDither[y] = [];
			for (let x = 0; x < this.width; ++x)
				this.toDither[y][x] = true;
		}
		this.centreCandidates = this.palette.map((col, i) => [ col, this.palette[5 - i]]);
		const s = Date.now();
		// next, build up a 'palette' of the original six colours crossed together a bunch of times: essentially this is every option for a set of eight blocks, which we use both for the edges and the corners, but filtered differently. they're stored as indices rather than reproducing the colour values every time.
		console.log('crossing', s - Date.now());
		const palIs = this.palette.map((x, i) => i),
			pal2 = Biditherer.cross(palIs, palIs),
			pal4 = Biditherer.cross(pal2, pal2),
			pal8 = Biditherer.cross(pal4, pal4).map(Biditherer.flatten);
		// now we filter them to the combinations which (i think) can be made using the edge pieces (eg, they cant *all* be green) and the corner pieces
		console.log('filtering', s - Date.now());
		this.edgeCandidates = pal8
			.filter(Biditherer.edgesCanBeDone)
			.map(c => c.map(c => this.palette[c]));
		console.log('ideal 4-cubelet options:', pal8.length);
		console.log('edge options:', this.edgeCandidates.length);
		console.log('diff:', pal8.length - this.edgeCandidates.length);
		console.log('now corners', s - Date.now());
		this.cornerCandidates = pal8
			.filter(Biditherer.cornersCanBeDone)
			.map(c => c.map(c => this.palette[c]));
		console.log('corner options:', this.cornerCandidates.length);
		console.log('diff:', pal8.length - this.cornerCandidates.length);
		console.log('done filtering', s - Date.now());
		// lastly set a few tracking variables
		this.pixDone = 0;
		this.totalPix = this.width * this.height;
		this.hardPixels = this.easyPixels = 0;
	}

	// bad practice ahoy: these functions assume a lot about the palette:

	// very basic histogramming function:
	static countsPerColor(c) {
		const count = [0, 0, 0, 0, 0, 0];
		for (let i = c.length; i; ++count[c[--i]]);
		return count;
	}

	// for a given set of 8 colours, can it be made using the edge pieces of a rubik's cube?
	static edgesCanBeDone(c) {
		const counts = Biditherer.countsPerColor(c);
		for (let i = 0; i < 6; ++i) {
			const iCount = counts[i];
			// you can't have more than 4 of any colour
			if (iCount > 4) return false;
			// if you have four of one then you can't have four of an adjacent one or there's an edge you're using twice.
			if (iCount == 4)
				for (let j = 0; j < 6; ++j)
					if (j != i && j != 5 - i && counts[j] == 4)
						return false;
		}
		return true;
	}

	// for a given set of 8 colours, can it be made using the corner pieces of a rubik's cube?
	static cornersCanBeDone(c) {
		const counts = Biditherer.countsPerColor(c);
		for (let i = 0; i < 6; ++i) {
			const iCount = counts[i];
			// you can't have more than 4 of any colour
			if (iCount > 4) return false;
			// and if you have four the same...
			if (iCount < 4) continue;
			// ... then for the adjacent colours...
			for (let j = 0; j < 6; ++j) if (j != i && j != 5 - i) {
				const jCount = counts[j];
				/// ...you can't have three or more of any one of them
				if (jCount >= 3) return false;
				// and if you have two of one of them...
				if (jCount < 2) continue;
				// ...then you can't have a pair of any colour adjacent to both
				for (let k = 0; k < 6; ++k)
					if (k != i && k != 5 - i && k != j && k != 5 - j)
						if (counts[k] >= 2) return false;
			}
		}
		return true;
	}

	dither() {
		this.startTime = Date.now();
		console.log('dithering centres', this.startTime - Date.now());
		this.ditherCentres();
		console.log('dithering edges', this.startTime - Date.now());
		this.ditherEdges();
		console.log('dithering corners', this.startTime - Date.now());
		this.ditherCorners();
		console.log('done', this.startTime - Date.now());
		console.log(`hard pixels: ${this.hardPixels} (${this.hardPixels * 100 / (this.hardPixels + this.easyPixels)}%)`);
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
			], this.edgeCandidates,
			Biditherer.edgesCanBeDone);
	}

	ditherCorners() {
		for (const { x, y } of this.centreCoords())
			this.ditherPixels([
				{ x: x - 1, y: y + 1 }, { x: x + 1, y: y + 1 },
				{ x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 }
			], this.cornerCandidates,
			Biditherer.cornersCanBeDone);
	}

	*centreCoords() {
		// for (let y = 1; y < this.height; y += 3)
		// 	for (let x = 1; x < this.width; x += 3)
		// 		yield { x, y };
		for (const { x, y } of this.unfilteredCentreCoords())
			if (x > 0 && x < this.width && y > 0 && y < this.height)
				yield { x, y };
	}
	// the simple for-x-for-y version above kind of prioritises the top of the image which is not ideal really, this starts in the middle and sort-of spirals outwards so the middle is better and the corners are a bit pants, it is a wierd algorithm but it works, i think
	*unfilteredCentreCoords() {
		const cy = this.centreCentre(this.height),
			cx = this.centreCentre(this.width),
			d = cx + cy + 5;
		yield { x: cx, y: cy };
		for (let i = 3; i < d; i += 3) 
			for (let j = 0; j < i; j += 3) {
				yield { x: cx - j,     y: cy - i + j};
				yield { x: cx + j,     y: cy + i - j};
				yield { x: cx + i - j, y: cy - j};
				yield { x: cx - i + j, y: cy + j};
			}
	}
	// finds the centre of the cube nearest the middle, usually not the actual middle pixel
	centreCentre(len) { return Math.round(len / 6) * 3 - 2; }

	ditherPixel(x, y, candidates) {
		const col = this.getPixel(x, y),
			{ error, nearest } = this.nearest(col, candidates);
		this.setPixel(x, y, nearest);
		this.diffuseError(error, x, y);
	}
	// accepts a set of pixels and a set of candidate colour sets —
	// so if pixels is 4 long, candidates should be an array of four-long arrays.
	// also isValid is the function that checks if a particular combination is allowed,
	// because actually we do it naively first, check if it's ok,
	// and only use the supplied candidate list if it's not, because that's way slower.
	ditherPixels(pixels, candidates, isValid) {
		const cols = [];
		// let's just take the nearest colour to each pixel and really hope it makes a valid combination
		pixels.forEach(({ x, y }, i) => [cols[i], cols[i + 4]] = this.getPixel(x, y));
		let { error, nearest } = cols
			.map(c => this.nearest([ c ], this.wrappedPalette))
			.reduce((p, n) => ({
				error: p.error.concat(n.error),
				nearest: p.nearest.concat(n.nearest)
			}));
		// pretty sure the arrays are reference-copied so this should work:
		const indices = nearest.map(c => {
			const i = this.palette.indexOf(c);
			if (i < 0) throw new Error('Colour not found ' + c.toString());
			return i;
		});
		if (!isValid(indices)) {
			// i guess we have to actually check all a-million combinations...
			// console.log('oh dear'); return;
			({ error, nearest } = this.nearest(cols, candidates));
			++this.hardPixels;
		} else ++this.easyPixels;
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
				if (this.needsToDither(x + dx, y + dy))
					this.addError(x + dx, y + dy, error, this.ditheriness(dx, dy) / totalDiffusion);
	}
	ditheriness(x, y) { return (!x && !y) ? 0 : ((x && y) ? (this.options.cornerDitheriness || 0.25) : (this.options.sideDitheriness || 0.5)); }
	needsToDither(x, y) { return !!this.toDither[y] && this.toDither[y][x]; }
	addError(x, y, error, multiplier) {
		const i = (x + y * this.width) * 4,
			gamma = this.options.gamma || 1.2;
		error.forEach((c, k) => c.forEach((c, j) => {
			const real = (this.data[k][i + j] / 255) ** (1 / gamma),
				preGamma = real + c * multiplier / 255,
				newValue = ((preGamma > 0 ? preGamma : 0) ** gamma) * 255;
			if (isNaN(newValue)) throw new Error('error is nan');
			this.data[k][i + j] = newValue;
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
			console.log(`${this.pixDone} pixels done. (${this.pixDone * 100 / this.totalPix}%)`,
				this.startTime - Date.now());
	}

	// gives the distance between two vectors, in this case two colours.
	// this is weighted a bit because really who cares if the blue channel is fuzzy?
	// not the human eye, that's for sure!
	distance(a, b) {
		let d = 0, ai, i = a.length;
		while (i) {
			const ai = a[--i], bi = b[i];
			let j = ai.length;
			while (j) d += Math.abs(ai[--j] - bi[j]) * this.options.distanceFactor[j];
		}
		return d;
	}

	// finds the nearest candidate to the target
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

	// same as ditherer.join, but acts on inner arrays
	static join2(a, b, mapper) {
		return Ditherer.join(a, b,
			(a, b) => Ditherer.join(a, b, mapper));
	}

	// Flattens any depth of array
	static flatten(a) {
		return Array.isArray(a) ? Biditherer.flatten1(a.map(Biditherer.flatten)) : a;
	}

	// Flattens one layer of an array
	static flatten1(a) {
		return Array.isArray(a[0]) ? a.reduce((p, n) => p.concat(n)) : a;
	}

	// Returns the cross product of two arrays:
	// [ a1, a2 ] x [ b1, b2 ] would return
	// [ [a1,b1], [a1,b2], [a2,b1], [a2,b2] ]
	// which is to say every combination (in some logical order)
	static cross(a, b) {
		return Biditherer.flatten1(a.map(a => b.map(b => [ a, b ])));
	}
}
