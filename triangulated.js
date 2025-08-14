'use strict';

let svg_polygon, svg_farey, svg_farey_disk, itinerary_table, frieze_table, cluster_vars_table, cluster_vars_text;
let vx, closest_diag, highlighted_vertex = null, highlighted_diag = null;
let negative_text_hidden = true;
let n = 6;
let diags = [...Array(n-3).keys()].map(i => [[0, i+2], 1, false]); // the itinerary 1, n-2, 1, 2, 2, 2...
let itinerary = null, farey_path, cluster_vars;
let ford_circle_factor = 1, ford_circles, ford_circles_disk, ford_line, ford_slider, ford_slider_pressed = false;
const h_origin = [50, 200]; let h_scale; const disk_r = 120; let disk_origin;
const ns = 'http://www.w3.org/2000/svg';

function init() { // n, diags, and itinerary are assumed to be defined and consistent (itinerary can be null)
	vx = [...Array(n).keys()].map(i => {
		const [cx, cy] = [svg_polygon.getAttribute('width') / 2, svg_polygon.getAttribute('height') / 2];
		const r = cy - 10;
		const a = Math.PI * (2.0 * i / n - 0.5);
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	});
	if (itinerary === null) {
		set_itinerary_from_diags();
	}
	clear_highlights();
	draw_polygon();
	render_fractions();
	draw_farey();
	render_frieze();
	render_cluster_vars();
//	console.log(itinerary);
//	console.log(diags);
}

function set_itinerary_from_diags() {
	itinerary = Array.from(vx, (_, i) => diags.filter(d => d[0][0] === i || d[0][1] === i).length + 1);
}

function render_fractions() {
	const cells = [], cells_x = [], cells_f = [];
	let farey_edge = [[0, 1], [-1, 0]];
	farey_path = [];
	for (const [i, u] of itinerary.entries()) {
		const iti_entry = document.createElement('td');
		iti_entry.appendChild(document.createTextNode(u));
		iti_entry.classList.add('itinerary-entry');
		iti_entry.addEventListener('mouseover', () => highlight_vertex(i));
		iti_entry.addEventListener('mouseout', clear_highlights);
		const b1 = document.createElement('button');
		b1.classList.add('itinerary-button');
		b1.appendChild(document.createTextNode('1'));
		b1.setAttribute('id', 'b1-' + i);
		b1.addEventListener('click', function (e) {
			itinerary_insert_1(i);
		});
		const button_cell = document.createElement('td');
		button_cell.appendChild(b1);
		button_cell.addEventListener('mouseover', () => highlight_edge(i === n-1 ? [i, 0] : [i+1, i]));
		button_cell.addEventListener('mouseout', clear_highlights);
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
			x_cell.addEventListener('mouseover', () => highlight_vertex(i));
			x_cell.addEventListener('mouseout', clear_highlights);
			x_cell.appendChild(bx);
		}
		cells_x.push(
			x_cell,
			document.createElement('td')
		);
		farey_edge = matrix_product(farey_edge, [[0, -1], [1, u]]);
		farey_path.push([farey_edge[0][0], farey_edge[1][0]]);
		const f_cell = document.createElement('td');
		f_cell.setAttribute('id', 'f_cell-' + i);
		f_cell.innerHTML = `<span class="frac"><sup class="num">${farey_edge[0][0]}</sup><span class="hidden"> &frasl; </span><sub class="den">${farey_edge[1][0]}</sub></span>`.replaceAll('-', '−');
		f_cell.classList.add('farey-fraction');
		f_cell.addEventListener('mouseover', () => highlight_vertex(i));
		f_cell.addEventListener('mouseout', clear_highlights);
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
		if (d[2]) {
			cell.classList.add('frieze-entry-frozen');
		}
		if (not_in_den[i]) {
			cell.classList.add('frieze-entry-shmaurent');
		}
	}
	for (let i = 0; i < n-1; i++) {
		document.getElementById('fr-' + (i+1) + '-' + i).classList.add('frieze-entry-one', 'frieze-entry-frozen');
	}
	document.getElementById('fr-' + (n-1)+ '-0').classList.add('frieze-entry-one', 'frieze-entry-frozen');
	for (let v1 = 0; v1 < n; v1++) {
		for (let v2 = 0; v2 < v1; v2++) {
			const cell = document.getElementById('fr-' + v1 + '-' + v2);
			cell.addEventListener('mouseover', () => highlight_edge([v1, v2]));
			cell.addEventListener('mouseout', clear_highlights);
		}
		const cell = document.getElementById('fr-' + v1 + '-' + v1);
		cell.addEventListener('mouseover', () => highlight_vertex(v1));
		cell.addEventListener('mouseout', clear_highlights);
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
		x.addEventListener('mouseover', () => highlight_edge([v1, v2]));
		x.addEventListener('mouseout', clear_highlights);
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
			cell.addEventListener('mouseover', () => highlight_edge([v1, v2]));
			cell.addEventListener('mouseout', clear_highlights);
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
		diags.push([[i, (i+2)%n], 1, false]);
	}
	ford_circle_factor = 1;
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
	ford_circle_factor = 1;
	init();
}

function flip(i) { // i is the index of the diagonal to flip
//	console.log('flipping ' + i);
	const d = diags.splice(i, 1)[0];
	const [vertices, sign, is_frozen] = d;
	const [i1, i2] = vertices;
	const neighbours = [...Array(n).keys()].filter(i => adjacent(i, i1) && adjacent(i, i2));
	console.assert(neighbours.length === 2, '%o', {vertices, neighbours});
	diags.push([neighbours, sign, is_frozen]);
	itinerary = null;
	init();
}

function right_click_action(i) {
	// cyclically go from unfrozen 1 to frozen -1 to frozen 1 to unfrozen 1
	if (diags[i][2]) {
		if (diags[i][1] === -1) {
			diags[i][1] = 1;
		} else {
			diags[i][2] = false;
		}
	} else {
		diags[i][1] = -1;
		diags[i][2] = true;
		if (negative_text_hidden) {
			negative_text_hidden = false;
			for (const e of document.getElementsByClassName('negative')) {
				e.classList.add('negative-show');
			}
		}
	}
	init();
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
	const vars_frozen = new Map();
	for (const [i, d] of diags.entries()) {
		if (d[2]) {
			vars_frozen.set(i, d[1]);
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
			cluster_vars[i][j] = cluster_vars[i][j].evaluate_partially(vars_frozen);
			const den = cluster_vars[i][j].den;
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

const FORD_STROKE = 'SteelBlue', FAREY_EDGE_STROKE = 'gray', FORD_SLIDER_FILL = 'white', FORD_SLIDER_FILL_ACTIVE = 'gray', H_BOUNDARY_STROKE = 'black';

function draw_farey() { // farey_path is assumed to be defined
	const m = farey_path[1][0]; // position of the rightmost circle
	h_scale = m <= 3 ? 100 : 350 / (m + 0.5);
	svg_farey.replaceChildren();
	svg_farey_disk.replaceChildren();
	const line = document.createElementNS(ns, 'line'); // real axis
	line.setAttribute('x1', 0);
	line.setAttribute('y1', h_origin[1]);
	line.setAttribute('x2', 400);
	line.setAttribute('y2', h_origin[1]);
	line.setAttribute('stroke', H_BOUNDARY_STROKE);
	svg_farey.appendChild(line);
	disk_origin = [svg_farey_disk.getAttribute('width') - disk_r - 50, svg_farey_disk.getAttribute('height') / 2];
	const disk_boundary = document.createElementNS(ns, 'circle'); // real axis
	disk_boundary.setAttribute('cx', disk_origin[0]);
	disk_boundary.setAttribute('cy', disk_origin[1]);
	disk_boundary.setAttribute('r', disk_r);
	disk_boundary.setAttribute('stroke', H_BOUNDARY_STROKE);
	disk_boundary.setAttribute('fill', 'none');
	svg_farey_disk.appendChild(disk_boundary);
	ford_circles = [];
	ford_circles_disk = [];
	for (let i = 0; i < n; i++) {
		draw_ford_circle(farey_path[i], i % 2);
		for (let j = 0; j < i; j++) {
			if (Math.abs(farey_path[i][0] * farey_path[j][1] - farey_path[i][1] * farey_path[j][0]) == 1) {
				draw_farey_edge(farey_path[i], farey_path[j]);
			}
		}
	}
	if (n % 2 == 0) {
		const [cx, cy] = h_rescale(0, 1);
		ford_slider = document.createElementNS(ns, 'circle');
		ford_slider.setAttribute('r', 0.1 * h_scale);
		ford_slider.setAttribute('cx', cx);
		ford_slider.setAttribute('stroke', 'black');
		ford_slider.setAttribute('stroke-width', 0.03 * h_scale);
		ford_slider.setAttribute('fill', FORD_SLIDER_FILL);
		svg_farey.appendChild(ford_slider);
		ford_slider.addEventListener('pointerdown', e => {
			ford_slider_pressed = true;
			ford_slider.setAttribute('fill', FORD_SLIDER_FILL_ACTIVE);
			ford_slider.setPointerCapture(e.pointerId);
		});
		ford_slider.addEventListener('pointerup', e => {
			ford_slider_pressed = false;
			ford_slider.setAttribute('fill', FORD_SLIDER_FILL);
		});
		ford_slider.addEventListener('pointermove', e => {
			if (!ford_slider_pressed) {
				return;
			}
			const [px, py] = mousePosition(svg_farey, e);
			ford_circle_factor = Math.max((h_origin[1] - Math.max(py, 3)) / h_scale, 0.1);
			update_ford_circles();
		});
		ford_slider.addEventListener('contextmenu', e => {
			e.preventDefault();
			ford_circle_factor = 1;
			update_ford_circles();
		});
	} else {
		ford_slider = null;
	}
	update_ford_circles();
}

function draw_ford_circle(ff, odd) {
	const [p, q] = ff;
	if (q == 0) {
		const y = h_origin[1] - h_scale;
		ford_line = document.createElementNS(ns, 'line');
		ford_line.setAttribute('x1', 0);
//		ford_line.setAttribute('y1', y);
		ford_line.setAttribute('x2', 400);
//		ford_line.setAttribute('y2', y);
		ford_line.setAttribute('stroke', FORD_STROKE);
		svg_farey.appendChild(ford_line);
	} else {
		const [x, r] = [p/q, 1/(2*q*q)];
		const [cx, cy] = h_rescale(x, r);
		const c = document.createElementNS(ns, 'circle');
		c.setAttribute('cx', cx);
//    c.setAttribute('cy', cy);
//    c.setAttribute('r', r * h_scale);
		c.setAttribute('stroke', FORD_STROKE);
		c.setAttribute('fill', 'none');
		svg_farey.appendChild(c);
		ford_circles.push([c, r, odd]);
	// add labels?
//    const [tx, ty] = h_rescale(x, -r*1.5);
//    const txt = document.createElementNS(ns, 'text');
//    txt.setAttribute('x', tx);
//    txt.setAttribute('y', ty);
//    txt.setAttribute('font-size', `${h_scale/(q*q)}px`);
//    txt.appendChild(document.createTextNode(q));
//    txt.innerHTML = `<span class="frac"><sup class="num">${p}</sup><span class="hidden"> &frasl; </span><sub class="den">${q}</sub></span>`.replaceAll('-', '−');
//    svg_farey.appendChild(txt);
	}
	const cd = document.createElementNS(ns, 'circle');
	cd.setAttribute('stroke', FORD_STROKE);
	cd.setAttribute('fill', 'none');
	svg_farey_disk.appendChild(cd);
	ford_circles_disk.push([cd, disk_pq2xy(p, q), 1/(p*p+q*q), odd]);
}

function update_ford_circles() {
	const y = h_origin[1] - h_scale * ford_circle_factor;
	ford_line.setAttribute('y1', y);
	ford_line.setAttribute('y2', y);
	for (let [c, r, odd] of ford_circles) {
		if (odd) {
			r *= ford_circle_factor;
		} else {
			r /= ford_circle_factor;
		}
		const [cx, cy] = h_rescale(0, r);
		c.setAttribute('cy', cy);
		c.setAttribute('r', r * h_scale);
	}
	if (ford_slider) {
		ford_slider.setAttribute('cy', y);
	}
	for (let [c, xy, f, odd] of ford_circles_disk) {
		if (odd) {
			f *= ford_circle_factor;
		} else {
			f /= ford_circle_factor;
		}
		const [x, y] = xy;
		const c_factor = 1 / (1 + f);
		const [cx, cy] = disk_position(x * c_factor, y * c_factor);
		c.setAttribute('cx', cx);
		c.setAttribute('cy', cy);
		c.setAttribute('r', disk_r * (1 - c_factor));
	}
}

function draw_farey_edge(ff1, ff2) { // expecting 0 <= fraction_1 < fraction_2 (possibly 1/0)
	const [p1, q1] = ff1;
	const [p2, q2] = ff2;
	const [x1d, y1d] = disk_pq2xy(p1, q1);
	const [x2d, y2d] = disk_pq2xy(p2, q2);
	const [dp1, dp2] = [disk_position(x1d, y1d), disk_position(x2d, y2d)];
	if (x1d + x2d == 0) {
		const line = document.createElementNS(ns, 'line');
		line.setAttribute('x1', dp1[0]);
		line.setAttribute('y1', dp1[1]);
		line.setAttribute('x2', dp2[0]);
		line.setAttribute('y2', dp2[1]);
		line.setAttribute('stroke', FAREY_EDGE_STROKE);
		svg_farey_disk.appendChild(line);
	} else {
		const arc_r = disk_r * (y1d - y2d) / (x1d + x2d);
		const arc_d = document.createElementNS(ns, 'path');
		arc_d.setAttribute('d', `M${dp1[0]},${dp1[1]} A${arc_r},${arc_r} 0 0,1 ${dp2[0]},${dp2[1]}`);
		arc_d.setAttribute('stroke', FAREY_EDGE_STROKE);
		arc_d.setAttribute('fill', 'none');
		svg_farey_disk.appendChild(arc_d);
	}
	const f1 = p1 / q1;
	if (q2 == 0) {
		const [x, y] = h_rescale(f1, 0);
		const line = document.createElementNS(ns, 'line');
		line.setAttribute('x1', x);
		line.setAttribute('y1', y);
		line.setAttribute('x2', x);
		line.setAttribute('y2', 0);
		line.setAttribute('stroke', FAREY_EDGE_STROKE);
		svg_farey.appendChild(line);
		return;
	}
	const f2 = p2 / q2;
	const [x1, y1] = h_rescale(f1, 0);
	const [x2, y2] = h_rescale(f2, 0);
	const r = (f2 - f1) / 2;
	const arc = document.createElementNS(ns, 'path');
	arc.setAttribute('d', `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`);
	arc.setAttribute('stroke', FAREY_EDGE_STROKE);
	arc.setAttribute('fill', 'none');
	svg_farey.appendChild(arc);
}

function disk_pq2xy(p, q) {
	const ns = p*p + q*q;
	return [2*p*q/ns, (p*p-q*q)/ns];
}

function h_rescale(x, y) {
	return u_rescale(x, y, h_origin, h_scale);
}

function disk_position(x, y) {
	return u_rescale(x, y, disk_origin, disk_r);
}

function u_rescale(x, y, o, r) {
	return [o[0] + x * r, o[1] - y * r];
}

function neg_diags() {
	for (const [d, l, f] of diags) {
		if (l !== 1) return true;
	}
	return false;
}

const HIGHLIGHT_STYLE = '#F0F000', EDGE_STYLE = new Map([
	['unfrozen', 'slategray'],
	[ 1, 'black'],
	[-1, '#D000D0'],
]);

function draw_polygon() {
	svg_polygon.replaceChildren();
	for (let v1 = 1; v1 < n; v1++) {
		for (let v2 = 0; v2 < v1; v2++) {
			draw_edge_highlight(v1, v2);
		}
	}
	for (let v = 0; v < n; v++) {
		draw_edge([[v, (v+1)%n], 1, true]);
	}
	for (const dd of diags.values()) {
		draw_edge(dd);
	}
	for (const [v, vv] of vx.entries()) {
		draw_vertex(vv, v);
	}
}

function draw_vertex(v, vx_i = null) {
	const hc = document.createElementNS(ns, 'circle');
	hc.setAttribute('cx', v[0]);
	hc.setAttribute('cy', v[1]);
	hc.setAttribute('r', 9);
	hc.setAttribute('fill', HIGHLIGHT_STYLE);
	hc.setAttribute('visibility', 'hidden');
	hc.setAttribute('id', 'pol-vx-hl-'+vx_i);
	svg_polygon.appendChild(hc);
	const c = document.createElementNS(ns, 'circle');
	c.setAttribute('cx', v[0]);
	c.setAttribute('cy', v[1]);
	c.setAttribute('r', 5);
	c.setAttribute('fill', 'black');
	svg_polygon.appendChild(c);
}

function draw_edge(data) {
	const [vertices, value, is_frozen] = data;
	const style = (is_frozen ? value : 'unfrozen');
	const [i1, i2] = vertices;
	const [v1, v2] = [vx[i1], vx[i2]];
	const line = document.createElementNS(ns, 'line');
	line.setAttribute('x1', v1[0]);
	line.setAttribute('y1', v1[1]);
	line.setAttribute('x2', v2[0]);
	line.setAttribute('y2', v2[1]);
	line.setAttribute('stroke-width', 3);
	line.setAttribute('stroke-linecap', 'round');
	line.setAttribute('stroke', EDGE_STYLE.get(style));
	svg_polygon.appendChild(line);
}

function draw_edge_highlight(v1, v2) {
	const [u1, u2] = [vx[v1], vx[v2]];
	const line = document.createElementNS(ns, 'line');
	line.setAttribute('x1', u1[0]);
	line.setAttribute('y1', u1[1]);
	line.setAttribute('x2', u2[0]);
	line.setAttribute('y2', u2[1]);
	line.setAttribute('stroke-width', 7);
	line.setAttribute('stroke-linecap', 'round');
	line.setAttribute('stroke', HIGHLIGHT_STYLE);
	line.setAttribute('visibility', 'hidden');
	line.setAttribute('id', 'pol-edge-hl-'+v1+'-'+v2);
	svg_polygon.appendChild(line);
}

function clear_highlights() {
	closest_diag = null;
	highlight_edge();
	highlight_vertex();
}

function highlight_edge(e = null) {
	if (highlighted_diag === null && e === null ||
		highlighted_diag !== null && e !== null &&
		highlighted_diag[0] === e[0] && highlighted_diag[1] === e[1])
		return;
	if (highlighted_diag !== null) {
		set_edge_highlighting(highlighted_diag, false);
	}
	if (e !== null) {
		set_edge_highlighting(e, true);
	}
	highlighted_diag = e;
}

function set_edge_highlighting(e, h) {
	const [v1, v2] = e;
	const edge = document.getElementById('pol-edge-hl-'+v1+'-'+v2);
	console.assert(edge, '%o', {e});
	edge.setAttribute('visibility', h ? 'visible' : 'hidden');
	if (!neg_diags()) {
		for (const v of e) {
			const f_cell = document.getElementById('f_cell-' + v);
			if (h) {
				f_cell.classList.add('highlighted');
			} else {
				f_cell.classList.remove('highlighted');
			}
		}
	}
}

function highlight_vertex(v = null) {
	if (highlighted_vertex === v) return;
	if (highlighted_vertex !== null) {
		set_vertex_highlighting(highlighted_vertex, false);
	}
	if (v !== null) {
		set_vertex_highlighting(v, true);
	}
	highlighted_vertex = v;
}

function set_vertex_highlighting(v, h) {
	const vertex = document.getElementById('pol-vx-hl-'+v);
	vertex.setAttribute('visibility', h ? 'visible' : 'hidden');
}

function on_move(e) {
	const pos = mousePosition(svg_polygon, e);
	const old_closest_diag = closest_diag;
	let min_distance = segment_to_point_distance([0, n-1], pos);
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
		let t = diags[closest_diag][0];
		if (t[0] < t[1]) {
			t.reverse();
		}
		highlight_edge(t);
	} else {
		highlight_edge();
	}
}

function on_click(e) {
	if (closest_diag === null) {
		return
	}
	if (e.which === 1) {
		flip(closest_diag);
	} else if (e.which === 3) {
		right_click_action(closest_diag);
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

function mousePosition(o, e) {
	const box = o.getBoundingClientRect();
	return [e.clientX - box.left, e.clientY - box.top];
}

function init_once() {
	svg_polygon = document.getElementById('triangulation');
	svg_farey = document.getElementById('farey');
	svg_farey_disk = document.getElementById('farey_disk');
	itinerary_table = document.getElementById('itinerary');
	frieze_table = document.getElementById('frieze');
	cluster_vars_table = document.getElementById('clustervars');
	cluster_vars_text = document.getElementById('clustervars-text');
	init();
	svg_polygon.addEventListener('mousemove', on_move);
	svg_polygon.addEventListener('mouseup', on_click);
	svg_polygon.addEventListener('contextmenu', e => { if (closest_diag !== null) e.preventDefault() });
}

window.addEventListener('DOMContentLoaded', init_once);
