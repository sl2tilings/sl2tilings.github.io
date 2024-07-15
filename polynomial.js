'use strict';

class LaurentPolynomial {
	static nvars; // number of variables
	
	constructor(num_terms, den) {
		this.num_terms = num_terms; // Numerator. Must be a Map, keys are lists of nonnegative exponents of variables of length nvars, values are coefficients.
		this.den = den; // Denominator. List of exponents of length nvars.
		this.cleanup();
	}
	// Note: be careful when working with num_terms, as its keys are arrays, which by default are not compared termwise.
	// All (non-static) methods of this class do not expose the array objects.
	
	cleanup() {
		for (const [e, c] of this.num_terms) { // delete terms with coefficient 0
			if (c === 0) {
				this.num_terms.delete(e);
			}
		}
		for (let i = 0; i < this.constructor.nvars; i++) { // cancel common factors in num and den
			let min_exp = this.den[i];
			for (const e of this.num_terms.keys()) {
				min_exp = Math.min(min_exp, e[i]);
			}
			if (min_exp === 0) {
				continue;
			}
			this.den[i] -= min_exp;
			this.num_terms = new Map([...this.num_terms.entries()].map(ec => {
				const e = [...ec[0]];
				e[i] -= min_exp;
				return [e, ec[1]];
			}));
		}
	}
	
	static x(i) {
		const e = Array(this.nvars).fill(0);
		if (i !== null) {
			e[i] = 1;
		}
		const num_terms = new Map([[e, 1]]);
		const den = Array(this.nvars).fill(0);
		return new this(num_terms, den);
	}
	
	static one() {
		return this.x(null);
	}
	
	add_num_term(e, c) {
		add_to_map_polynomial(this.num_terms, e, c);
	}
	
	common_denominator(den2) {
		const diff_den_exp = [...Array(this.constructor.nvars).keys()].map(i => Math.max(this.den[i], den2[i]) - this.den[i]);
		const den_new = this.den.map((e, i) => e + diff_den_exp[i]);
		const num_terms_new = new Map([...[...this.num_terms.entries()].map(ec => [ec[0].map((e, i) => e + diff_den_exp[i]), ec[1]])]);
		const result = this.constructor.one(); // constructor does cleanup, and we don't want it
		result.num_terms = num_terms_new;
		result.den = den_new;
		return result;
	}
	
	add(rhs) {
		const [p1, p2] = [this.common_denominator(rhs.den), rhs.common_denominator(this.den)];
		for (const [e, c] of p2.num_terms) {
			p1.add_num_term(e, c);
		}
		p1.cleanup();
		return p1;
	}
	
	mul(rhs) {
		const den_new = [...Array(this.constructor.nvars).keys()].map(i => this.den[i] + rhs.den[i]);
		const num_terms_new = new Map();
		multiply_maps_polynomials_adding_to(num_terms_new, this.num_terms, rhs.num_terms);
		const p = new this.constructor(num_terms_new, den_new);
		p.cleanup();
		return p;
	}
	
	div(dividend) { // Divide by another Laurent polynomial. It is assumed that the division results in another Laurent polynomial.
		if (dividend.num_terms.size === 1) {
			const [e, c] = dividend.num_terms.entries().next().value;
			const inv = new this.constructor(new Map([[dividend.den, 1/c]]), e);
			return this.mul(inv);
		}
		const p = new this.constructor(Polynomial.from_map(this.num_terms).div(Polynomial.from_map(dividend.num_terms)).into_map(), this.den);
		const inv = new this.constructor(new Map([[dividend.den, 1]]), Array(this.constructor.nvars).fill(0));
		return p.mul(inv);
	}
	
	evaluate(vars) {
		let num = 0;
		for (const [e, c] of this.num_terms) {
			num += this.constructor.evaluate_monomial(vars, e, c);
		}
		const den = this.constructor.evaluate_monomial(vars, this.den);
		return num / den; // Numbers in js are internally floats anyway. For integers below 2^53 this must work fine.
	}
	
	static evaluate_monomial(vars, e, c = 1) {
		let r = c;
		for (let i = 0; i < this.nvars; i++) {
			r *= vars[i]**e[i];
		}
		return r;
	}
	
	evaluate_partially(vars) { // In this function, vars is a map.
		const den_new = [...this.den];
		let c = 1;
		for (const [i, v] of vars.entries()) {
			c /= v**den_new[i]; // v is assumed to be nonzero
			den_new[i] = 0;
		}
		const num_terms_new = new Map();
		for (const [e, c0] of this.num_terms.entries()) {
			const e_new = [...e];
			let c_new = c * c0;
			for (const [i, v] of vars.entries()) {
				c_new *= v**e[i]; // v is assumed to be nonzero
				e_new[i] = 0;
			}
			add_to_map_polynomial(num_terms_new, e_new, c_new);
		}
		const p = new this.constructor(num_terms_new, den_new);
		p.cleanup();
		return p;
	}
	
	mutation(incoming, outgoing) {
		return this.constructor.product(incoming).add(this.constructor.product(outgoing)).div(this);
	}
	
	static product(p) {
		if (p.length === 0) {
			return this.one();
		} else if (p.length === 1) {
			return p[0];
		}
		return p[0].mul(this.product(p.slice(1)));
	}
	
	latex() {
		let s = '';
		let plus = false;
		for (const [e, c] of this.num_terms.entries()) {
			s += var_product_latex(e, c, plus);
			plus = true;
		}
		const den = var_product_latex(this.den);
		if (den !== '1') {
			s = '\\frac{' + s + '}{' + den + '}';
		}
		return s;
	}
	
	html() {
		let s = '';
		let plus = false;
		for (const [e, c] of this.num_terms.entries()) {
			s += var_product_html(e, c, plus);
			plus = true;
		}
		const den = var_product_html(this.den);
		if (den !== '1') {
			if (this.num_terms.size > 1) {
				s = `<span class="hidden">(</span>${s}<span class="hidden">)</span>`;
			}
			s = `<span class="frac"><span class="num">${s}</span><span class="hidden">&frasl;</span><span class="den">${den}</span></span>`;
		}
		return s;
	}
	
//	eq() {}
		// Ideally, make unit tests.
}

function var_product_latex(e, c = 1, plus = false) {
	let s = '';
	for (const [i, p] of e.entries()) {
		if (p === 0) {
			continue;
		}
		s += 'x_' + (i>=9 ? '{'+(i+1)+'}' : (i+1));
		if (p > 1) {
			s += '^' + (p>9 ? '{'+p+'}' : p);
		}
	}
	return with_coeff(s, c, plus);
}

function var_product_html(e, c = 1, plus = false) {
	let s = '';
	for (const [i, p] of e.entries()) {
		if (p === 0) {
			continue;
		}
		s += `<i>x</i><sub>${i+1}</sub>`;
		if (p > 1) {
			s += `<sup>${p}</sup>`;
		}
	}
	return with_coeff(s, c, plus);
}

function with_coeff(s0, c, plus) {
	let s = s0;
	if (s === '') {
		s = '' + c;
	} else if (c === -1) {
		s = '-' + s;
	} else if (c !== 1) {
		s = '' + c + s;
	}
	if (plus && c > 0) {
		s = '+' + s;
	}
	return s;
}

class Polynomial {
	constructor(nvars, terms) {
		this.nvars = nvars;
		this.terms = terms; // Array of coefficients of the powers of the first variable. The coefficients are maps (representing polynoimials in the remaining variables), unless nvars=0, in which case the sole term/coefficient is a number.
	}
	
	static constant(x) {
		return new this(0, [x]);
	}
	
	static from_map(p) {
		const nvars = p.keys().next().value.length; // hence p must be nonempty
		if (nvars === 0) {
			return this.constant(p.values().next().value);
		}
		const degree = Math.max(...[...p.keys()].map(e => e[0]));
		const terms = [...Array(degree+1)].map(i => new Map());
		for (const [e, c] of p) {
			terms[e[0]].set([...e.slice(1)], c);
		}
		return new this(nvars, terms);
	}
	
	into_map() {
		if (this.nvars === 0) {
			return new Map(this.terms.length === 0 ? [] : [[[], this.terms[0]]]);
		}
		const m = new Map();
		for (const [i, a] of this.terms.entries()) {
			for (const [e0, c] of a) {
				const e = [...e0]; // just in case
				e.unshift(i);
				m.set(e, c);
			}
		}
		return m;
	}
	
	div(dividend) { // We heavily rely on the assumption that there is no remainder.
		console.assert(this.nvars === dividend.nvars, '%o', {dividend});
		if (this.nvars === 0) {
			return this.constructor.constant(this.terms[0] / dividend.terms[0]);
		}
		const result_terms = [...Array(this.terms.length - dividend.terms.length + 1)].map(i => new Map());
		let remaining = this;
		let de;
		while ((de = remaining.terms.length - dividend.terms.length) >= 0) {
			const a = this.constructor.from_map(remaining.terms[remaining.terms.length-1]);
			const b = this.constructor.from_map(dividend.terms[dividend.terms.length-1]);
			const q = a.div(b); // nvars of a, b, q are 1 less than nvars of this, dividend
			const qm = q.into_map();
			result_terms[de] = qm;
			const qxde_terms = [...Array(de)].map(i => new Map());
			qxde_terms.push(qm);
			remaining.sub_assign(dividend.mul(new this.constructor(this.nvars, qxde_terms))); // must be same as this.sub(dividend.mul(result))
		}
		console.assert(remaining.terms.length === 0, '%o', {remaining, dividend, result_terms});
		while (result_terms.length > 0 && result_terms[result_terms.length-1].size === 0) {
			result_terms.pop();
		}
		const result = new this.constructor(this.nvars, result_terms);
		return result;
	}
	
	cleanup() {
		for (const i of this.terms.keys()) {
			for (const [e, c] of this.terms[i]) {
				if (c === 0) {
					this.terms[i].delete(e);
				}
			}
		}
		while (this.terms.length > 0 && this.terms[this.terms.length-1].size === 0) {
			this.terms.pop();
		}
	}
	
	sub_assign(subtrahend) {
		let flag;
		console.assert(this.nvars === subtrahend.nvars, '%o', {subtrahend});
		for (let i = 0; i < Math.min(this.terms.length, subtrahend.terms.length); i++) {
			for (const [e, c] of subtrahend.terms[i]) {
				add_to_map_polynomial(this.terms[i], e, -c);
			}
		}
		while (this.terms.length < subtrahend.terms.length) {
			const m = new Map();
			for (const [e, c] of subtrahend.terms[this.terms.length]) {
				m.set(e, -c);
			}
			this.terms.push(m);
		}
		this.cleanup();
	}
	
	mul(rhs) {
		console.assert(this.nvars === rhs.nvars, '%o', {rhs});
		const m = new this.constructor(this.nvars, [...Array(this.terms.length + rhs.terms.length - 1)].map(i => new Map()));
		for (let i = 0; i < this.terms.length; i++) {
			for (let j = 0; j < rhs.terms.length; j++) {
				multiply_maps_polynomials_adding_to(m.terms[i+j], this.terms[i], rhs.terms[j]);
			}
		}
		return m;
	}
	
}

function multiply_maps_polynomials_adding_to(p, lhs, rhs) {
	for (const [e1, c1] of lhs) {
		for (const [e2, c2] of rhs) {
			const e = e1.map((v, i) => v + e2[i]);
			const c = c1 * c2;
			add_to_map_polynomial(p, e, c);
		}
	}
}

function add_to_map_polynomial(m, e, c) {
	for (const ec of m) {
		if (e.every((a, i) => a === ec[0][i])) { // e is equal to ec[0] termwise
			m.set(ec[0] /* not e! */, ec[1] + c);
			return;
		}
	}
	m.set(e, c);
}
