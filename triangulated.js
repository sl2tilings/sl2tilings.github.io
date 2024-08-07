'use strict';

let canvas, ctx, itinerary_table, frieze_table, cluster_vars_table, cluster_vars_text;
let vx, closest_diag, highlighted_vertex, highlighted_diag;
let negative_text_hidden = true;
let n = 6;
let diags = [...Array(n-3).keys()].map(i => [[0, i+2], 1]); // the itinerary 1, n-2, 1, 2, 2, 2...
let itinerary = null, cluster_vars;

function init() { // n, diags, and itinerary are assumed to be defined and consistent (itinerary can be null)
	vx = [...Array(n).keys()].map(i => {
		const [cx, cy] = [canvas.width / 2, canvas.height / 2];
		const r = cy - 10;
		const a = Math.PI * (2.0 * i / n - 0.5);
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	});
	if (itinerary === null) {
		set_itinerary_from_diags();
	}
	clear_highlights_and_draw();
	render_itinerary();
	render_frieze();
	render_cluster_vars();
//	console.log(itinerary);
//	console.log(diags);
}

function set_itinerary_from_diags() {
	itinerary = Array.from(vx, (_, i) => diags.filter(d => d[0][0] === i || d[0][1] === i).length + 1);
}

function render_itinerary() {
	const cells = [], cells_x = [], cells_f = [];
	let farey_edge = [[0, 1], [-1, 0]];
	for (const [i, u] of itinerary.entries()) {
		const iti_entry = document.createElement('td');
		iti_entry.appendChild(document.createTextNode(u));
		iti_entry.classList.add('itinerary-entry');
		iti_entry.addEventListener('mouseover', function () {
			highlighted_vertex = i;
			draw();
		});
		iti_entry.addEventListener('mouseout', clear_highlights_and_draw);
		const b1 = document.createElement('button');
		b1.classList.add('itinerary-button');
		b1.appendChild(document.createTextNode('1'));
		b1.setAttribute('id', 'b1-' + i);
		b1.addEventListener('click', function (e) {
			itinerary_insert_1(i);
		});
		const button_cell = document.createElement('td');
		button_cell.appendChild(b1);
		button_cell.addEventListener('mouseover', function () {
			highlighted_diag = (i === n-1 ? [i, 0] : [i+1, i]);
			draw();
		});
		button_cell.addEventListener('mouseout', clear_highlights_and_draw);
		cells.push(
			iti_entry,
			button_cell
		);
		const x_cell = document.createElement('td');
		if (u === 1) {
			const bx = document.createElement('button');
			bx.classList.add('itinerary-button');
			bx.appendChild(document.createTextNode('x'));
			bx.setAttribute('id', 'bx-' + i);
			bx.addEventListener('click', function (e) {
				itinerary_delete_1(i);
			});
			x_cell.addEventListener('mouseover', function () {
				highlighted_vertex = i;
				draw();
			});
			x_cell.addEventListener('mouseout', clear_highlights_and_draw);
			x_cell.appendChild(bx);
		}
		cells_x.push(
			x_cell,
			document.createElement('td')
		);
		farey_edge = matrix_product(farey_edge, [[0, -1], [1, u]]);
		const f_cell = document.createElement('td');
		f_cell.innerHTML = `<span class="frac"><sup class="num">${farey_edge[0][0]}</sup><span class="hidden"> &frasl; </span><sub class="den">${farey_edge[1][0]}</sub></span>`.replaceAll('-', '−');
		f_cell.classList.add('farey-fraction');
		f_cell.addEventListener('mouseover', function () {
			highlighted_vertex = i;
			draw();
		});
		f_cell.addEventListener('mouseout', clear_highlights_and_draw);
		cells_f.push(
			f_cell,
			document.createElement('td')
		);
	}
	const row_x = document.createElement('tr');
	for (const cell of cells_x) {
		row_x.appendChild(cell);
	}
	const row = document.createElement('tr');
	for (const cell of cells) {
		row.appendChild(cell);
	}
	const row_f = document.createElement('tr');
	for (const cell of cells_f) {
		row_f.appendChild(cell);
	}
	itinerary_table.replaceChildren(row_x, row, row_f);
}

function render_frieze() {
	const [f, not_in_den] = calculate_frieze();
	const rows = [];
	for (const [i, e] of f.entries()) {
		const row = document.createElement('tr');
		for (let j = 0; j < i; j++) {
			row.appendChild(document.createElement('td'));
		}
		let cell;
		for (const [j, a] of e.entries()) {
			cell = document.createElement('td');
			cell.appendChild(document.createTextNode(('' + a).replaceAll('-', '−')));
			const [v1, v2] = [i+j, j];
			cell.setAttribute('id', 'fr-' + v1 + '-' + v2);
			row.appendChild(cell);
			cell = document.createElement('td');
			row.appendChild(cell);
		}
		cell.remove();
		rows.push(row);
	}
	frieze_table.replaceChildren(...rows);
	for (const [i, d] of diags.entries()) {
		let [v1, v2] = d[0];
		if (v1 < v2) {
			v1 = d[0][1];
			v2 = d[0][0];
		}
		const cell = document.getElementById('fr-' + v1 + '-' + v2);
		cell.classList.add('frieze-entry-clustervar');
		if (not_in_den[i]) {
			cell.classList.add('frieze-entry-shmaurent');
		}
	}
	for (let i = 0; i < n-1; i++) {
		document.getElementById('fr-' + (i+1) + '-' + i).classList.add('frieze-entry-one');
	}
	document.getElementById('fr-' + (n-1)+ '-0').classList.add('frieze-entry-one');
	for (let v1 = 0; v1 < n; v1++) {
		for (let v2 = 0; v2 < v1; v2++) {
			const cell = document.getElementById('fr-' + v1 + '-' + v2);
			cell.addEventListener('mouseover', function () {
				highlighted_diag = [v1, v2];
				draw();
			});
			cell.addEventListener('mouseout', clear_highlights_and_draw);
		}
		const cell = document.getElementById('fr-' + v1 + '-' + v1);
		cell.addEventListener('mouseover', function () {
			highlighted_vertex = v1;
			draw();
		});
		cell.addEventListener('mouseout', clear_highlights_and_draw);
	}
}

function render_cluster_vars() { // the table cluster_vars is assumed to be defined
	cluster_vars_text.replaceChildren();
	for (const [i, d] of diags.entries()) {
		let [v1, v2] = d[0];
		if (v1 < v2) {
			v1 = d[0][1];
			v2 = d[0][0];
		}
		const x = document.createElement('span');
		x.innerHTML = `<i>x</i><sub>${i+1}</sub>`;
		x.addEventListener('mouseover', function () {
			highlighted_diag = [v1, v2];
			draw();
		});
		x.addEventListener('mouseout', clear_highlights_and_draw);
		cluster_vars_text.appendChild(x);
		if (i < n-4) {
			cluster_vars_text.appendChild(document.createTextNode(', '));
		}
	}
	const rows = [];
	for (let i = 2; i < n-1; i++) {
		const row = document.createElement('tr');
		for (let j = 2; j < i; j++) {
			row.appendChild(document.createElement('td'));
		}
		let cell;
		for (let j = 0; j < n-i; j++) {
			const [v1, v2] = [i+j, j];
			cell = document.createElement('td');
			const s = cluster_vars[v1][v2].html().replaceAll('-', '−');
			cell.innerHTML = s;
			cell.setAttribute('id', 'cv-' + v1 + '-' + v2);
			row.appendChild(cell);
			cell = document.createElement('td');
			row.appendChild(cell);
		}
		cell.remove();
		rows.push(row);
	}
	cluster_vars_table.replaceChildren(...rows);
	for (let v1 = 2; v1 < n; v1++) {
		for (let v2 = 0; v2 < v1-1; v2++) {
			if (cluster_vars[v1][v2] === null) {
				continue;
			}
			const cell = document.getElementById('cv-' + v1 + '-' + v2);
			cell.addEventListener('mouseover', function () {
				highlighted_diag = [v1, v2];
				draw();
			});
			cell.addEventListener('mouseout', clear_highlights_and_draw);
		}
	}
}

function matrix_product(a, b) {
	return [
		[a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
		[a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]
	];
}

function itinerary_insert_1(i) {
	itinerary[i]++;
	itinerary[(i+1)%n]++;
	itinerary.splice(i+1, 0, 1);
	n++;
	if (n > 3) {
		for (const d of diags) {
			if (d[0][0] > i) {
				d[0][0]++;
			}
			if (d[0][1] > i) {
				d[0][1]++;
			}
		}
		diags.push([[i, (i+2)%n], 1]);
	}
	init();
}

function itinerary_delete_1(i) {
	console.assert(itinerary[i] === 1, '%o', {itinerary, i});
	itinerary.splice(i, 1);
	n--;
	const i1 = (i+n-1)%n, i2 = i%n;
	itinerary[i1]--;
	itinerary[i2]--;
	for (const d of diags) {
		if (d[0][0] > i) {
			d[0][0]--;
		}
		if (d[0][1] > i) {
			d[0][1]--;
		}
	}
	diags = diags.filter(d => !(d[0][0] === i1 && d[0][1] === i2 || d[0][0] === i2 && d[0][1] === i1));
	init();
}

function flip(i) { // i is the index of the diagonal to flip
//	console.log('flipping ' + i);
	const d = diags.splice(i, 1)[0];
	const [vertices, sign] = d;
	const [i1, i2] = vertices;
	const neighbours = [...Array(n).keys()].filter(i => adjacent(i, i1) && adjacent(i, i2));
	console.assert(neighbours.length === 2, '%o', {vertices, neighbours});
	diags.push([neighbours, sign]);
	itinerary = null;
	init();
}

function flip_sign(i) {
	diags[i][1] = -diags[i][1];
	init();
	if (negative_text_hidden) {
		negative_text_hidden = false;
		for (const e of document.getElementsByClassName('negative')) {
			e.classList.add('negative-show');
		}
	}
}

function adjacent(i1, i2) {
	return adjacent_ordered(i1, i2) || adjacent_ordered(i2, i1);
}

function adjacent_ordered(i1, i2) {
	return i1-i2 === 1 || i1 === n-1 && i2 === 0 || diags.find(d => d[0][0] === i1 && d[0][1] === i2)
}

function calculate_frieze() {
	const frieze = [Array(n).fill(0), Array(n-1).fill(1)];
	for (let i = n-2; i > 1; i--) {
		frieze.push(Array(i).fill('-'));
	}
	if (n < 3) {
		return [frieze, []];
	}
	frieze.push([1]);
	calculate_cluster_vars();
	// evaluate cluster_vars to fill in the frieze
	// The coordinates on frieze are row number and the number of entry in the row number, counting from the starting diagonal in the frieze.
	// The coordinates on triangulations and cluster_vars are 1st vertex and 2nd vertex (i. e. axes are along two diagonals in the frieze).
	const vars = diags.map(d => d[1]);
	for (let i = 2; i < n; i++) {
		for (let j = (i === n-1 ? 1 : 0); j < i-1; j++) {
			frieze[i-j][j] = cluster_vars[i][j].evaluate(vars);
		}
	}
	const not_in_den = vars.map(i => true);
	let nv = not_in_den.length;
	const vars_neg1 = new Map();
	for (const [i, d] of diags.entries()) {
		if (d[1] === -1) {
			vars_neg1.set(i, -1);
			not_in_den[i] = false;
			nv -= 1;
		}
	}
	for (let i = 2; i < n; i++) {
		if (nv === 0) {
			break;
		}
		for (let j = (i === n-1 ? 1 : 0); j < i-1; j++) {
			if (nv === 0) {
				break;
			}
			const den = cluster_vars[i][j].evaluate_partially(vars_neg1).den;
			for (const [i, e] of den.entries()) {
				if (not_in_den[i] && e > 0) {
					not_in_den[i] = false;
					nv -= 1;
				}
			}
		}
	}
	return [frieze, not_in_den];
}

function calculate_cluster_vars() {
	const triangulation = [...Array(n)].map(i => Array(n).fill(false)); // basically the adjacency matrix - to be used only within this function
	for (let i = 0; i < n; i++) {
		const j = (i+1) % n; // sides
		triangulation[i][j] = triangulation[j][i] = true;
	}
	for (const d of diags) {
		const [v1, v2] = d[0];
		triangulation[v1][v2] = triangulation[v2][v1] = true;
	}
	LaurentPolynomial.nvars = n - 3;
	cluster_vars = [...Array(n).keys()].map(i => Array(i).fill(null));
	for (const [i, d] of diags.entries()) {
		const [v1, v2] = (d[0][0] >= d[0][1] ? d[0] : [d[0][1], d[0][0]]);
		cluster_vars[v1][v2] = LaurentPolynomial.x(i);
	}
	// mutate the triangulation until we have a diagonal of 1's in the frieze
	for (let i = 1; i < n; i++) {
		for (let j = n-1; j >= i+2; j--) {
			if (triangulation[i][j]) {
				triangulation[i][j] = triangulation[j][i] = false;
				let k;
				for (k = j-1; k > i || console.warn('This should never happen.'); k--)	{
					if (triangulation[j][k] && triangulation[k][i]) {
						break;
					}
				}
				triangulation[0][k] = triangulation[k][0] = true;
				const incoming = [], outgoing = [];
				if (n-j > 1) {
					incoming.push(cluster_vars[j][0]);
				}
				if (j-k > 1) {
					outgoing.push(cluster_vars[j][k]);
				}
				if (k-i > 1) {
					incoming.push(cluster_vars[k][i]);
				}
				if (i   > 1) {
					outgoing.push(cluster_vars[i][0]);
				}
				cluster_vars[k][0] = cluster_vars[j][i].mutation(incoming, outgoing);
			}
		}
	}
	// mutate further to go through all the cluster vars to fill in the remaining gaps in cluster_vars (we don't need triangulations here)
	for (let i = 3; i < n; i++) {
		for (let j = 1; j < i-1; j++) {
			if (cluster_vars[i][j] !== null) {
				continue;
			}
			const outgoing = [];
			if (i-j > 2) {
				outgoing.push(cluster_vars[i-1][j]);
			}
			if (i-j < n-2) {
				outgoing.push(cluster_vars[i][j-1]);
			}
			cluster_vars[i][j] = cluster_vars[i-1][j-1].mutation([], outgoing);
		}
	}
//	cluster_vars.forEach(row => console.log(row.map(cv => cv === null ? '1' : cv.latex()).join(',  ')));
}

const HIGHLIGHT_STYLE = '#F0F000', EDGE_STYLE = new Map([
   [ 1, 'black'],
   [-1, '#D000D0'],
]);

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (highlighted_diag !== null) {
		for (let v1 = 1; v1 < n; v1++) {
			for (let v2 = 0; v2 < v1; v2++) {
				draw_highlight(v1, v2);
			}
		}
	}
	for (let v = 0; v < n; v++) {
		draw_edge([[v, (v+1)%n], 1]);
	}
	for (const dd of diags.values()) {
		draw_edge(dd);
	}
	for (const [v, vv] of vx.entries()) {
		draw_vertex(vv, v);
	}
}

function draw_vertex(v, vx_i = null) {
	if (vx_i !== null && vx_i === highlighted_vertex) {
		ctx.beginPath();
		ctx.arc(v[0], v[1], 9, 0, 2*Math.PI);
		ctx.fillStyle = HIGHLIGHT_STYLE;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.arc(v[0], v[1], 5, 0, 2*Math.PI);
	ctx.fillStyle = 'black';
	ctx.fill();
}

function draw_highlight(i1, i2) { // [i1, i2] and highlighted_diag are always in the descending order
	if (i1 === highlighted_diag[0] && i2 === highlighted_diag[1]) {
		const [v1, v2] = [vx[i1], vx[i2]];
		ctx.lineWidth = 7;
		ctx.beginPath();
		ctx.moveTo(v1[0], v1[1]);
		ctx.lineTo(v2[0], v2[1]);
		ctx.strokeStyle = HIGHLIGHT_STYLE;
		ctx.stroke();
	}
}

function draw_edge(data) {
	const [vertices, style] = data;
	const [i1, i2] = vertices;
	const [v1, v2] = [vx[i1], vx[i2]];
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(v1[0], v1[1]);
	ctx.lineTo(v2[0], v2[1]);
	ctx.strokeStyle = EDGE_STYLE.get(style);
	ctx.stroke();
}

function clear_highlights_and_draw() {
	closest_diag = null;
	highlighted_vertex = null;
	highlighted_diag = null;
	draw();
}

function on_move(e) {
	const pos = mousePosition(e);
	const old_closest_diag = closest_diag;
	let min_distance = segment_to_point_distance([0, n-1], pos); // use distance from the segment instead of distance from its midpoint?
	closest_diag = null;
	for (let i = 0; i < n-1; i++) {
		min_distance = Math.min(min_distance, segment_to_point_distance([i, i+1], pos));
	}
	for (const d of diags.keys()) {
		const dist = segment_to_point_distance(diags[d][0], pos);
		if (dist < min_distance) {
			min_distance = dist;
			closest_diag = d;
		}
	}
	if (closest_diag !== null) {
		highlighted_diag = diags[closest_diag][0];
		if (highlighted_diag[0] < highlighted_diag[1]) {
			highlighted_diag.reverse();
		}
	} else {
		highlighted_diag = null;
	}
	if (closest_diag !== old_closest_diag) {
//		console.log(closest_diag, highlighted_diag);
		draw();
		// render_frieze() if we also highlight frieze entries corresponding to the diagonals
	}
}

function on_click(e) {
	if (closest_diag === null) {
		return
	}
	if (e.which === 1) {
		flip(closest_diag);
	} else if (e.which === 3) {
		flip_sign(closest_diag);
	}
	on_move(e); // needed for highlighting
}

function mdp_dist(e, p2) { // distance from the midpoint of edge e (a pair of indices of vertices) to point p2 (a pair of coordinates)
// (not used)
	const [u, v] = [vx[e[0]], vx[e[1]]];
	const p1 = [(u[0]+v[0])/2, (u[1]+v[1])/2];
	return eud(p1, p2);
}

function segment_to_point_distance(e, p) { // distance from the edge e (a pair of indices of vertices) to point p (a pair of coordinates)
	const [u, v] = [vx[e[0]], vx[e[1]]];
	if (acute(p, u, v) && acute(p, v, u)) {
		return altitude(p, u, v);
	} else {
		return Math.min(eud(u, p), eud(v, p));
	}
}

function eud(p1, p2) { // Euclidean distance between two points
	return Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2);
}

function acute(a, b, c) { // given points a, b, c, is the angle abc acute?
	return (a[0]-b[0])*(c[0]-b[0]) + (a[1]-b[1])*(c[1]-b[1]) > 0;
}

function altitude(p, u, v) {
	return Math.abs((u[0]-p[0])*(v[1]-p[1]) - (u[1]-p[1])*(v[0]-p[0])) / eud(u, v);
}

function mousePosition(e) {
	const box = e.target.getBoundingClientRect();
	return [e.clientX - box.left, e.clientY - box.top];
}

function init_once() {
	canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');
	itinerary_table = document.getElementById('itinerary');
	frieze_table = document.getElementById('frieze');
	cluster_vars_table = document.getElementById('clustervars');
	cluster_vars_text = document.getElementById('clustervars-text');
	init();
	canvas.addEventListener('mousemove', on_move);
	canvas.addEventListener('mouseup', on_click);
	canvas.addEventListener('contextmenu', e => e.preventDefault());
}

window.addEventListener('load', init_once);
