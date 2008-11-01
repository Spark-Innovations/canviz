// $Id$

var Tokenizer = Class.create({
	initialize: function(str) {
		this.str = str;
	},
	takeChars: function(num) {
		if (!num) {
			num = 1;
		}
		var tokens = new Array();
		while (num--) {
			var matches = this.str.match(/^(\S+)\s*/);
			if (matches) {
				this.str = this.str.substr(matches[0].length);
				tokens.push(matches[1]);
			} else {
				tokens.push(false);
			}
		}
		if (1 == tokens.length) {
			return tokens[0];
		} else {
			return tokens;
		}
	},
	takeNumber: function(num) {
		if (!num) {
			num = 1;
		}
		if (1 == num) {
			return Number(this.takeChars());
		} else {
			var tokens = this.takeChars(num);
			while (num--) {
				tokens[num] = Number(tokens[num]);
			}
			return tokens;
		}
	},
	takeString: function() {
		var byte_count = Number(this.takeChars()), char_count = 0, char_code;
		if ('-' != this.str.charAt(0)) {
			return false;
		}
		while (0 < byte_count) {
			++char_count;
			char_code = this.str.charCodeAt(char_count);
			if (0x80 > char_code) {
				--byte_count;
			} else if (0x800 > char_code) {
				byte_count -= 2;
			} else {
				byte_count -= 3;
			}
		}
		var str = this.str.substr(1, char_count);
		this.str = this.str.substr(1 + char_count).replace(/^\s+/, '');
		return str;
	}
});

var Entity = Class.create({
	initialize: function(default_attr_hash_name, name, canviz, root_graph, parent_graph) {
		this.defaultAttrHashName = default_attr_hash_name;
		this.name = name;
		this.canviz = canviz;
		this.rootGraph = root_graph;
		this.parentGraph = parent_graph;
		this.attrs = $H();
		this.drawAttrs = $H();
	},
	getAttr: function(attr_name) {
		var attr_value = this.attrs.get(attr_name);
		if (Object.isUndefined(attr_value)) {
			var graph = this.parentGraph;
			while (!Object.isUndefined(graph)) {
				attr_value = graph[this.defaultAttrHashName].get(attr_name);
				if (Object.isUndefined(attr_value)) {
					graph = graph.parentGraph;
				} else {
					break;
				}
			}
		}
		return attr_value;
	},
	draw: function(ctx, ctx_scale, redraw_canvas_only) {
		var i, tokens;
		this.drawAttrs.each(function(draw_attr) {
			var command = draw_attr.value;
//			debug(command);
			var tokenizer = new Tokenizer(command);
			var token = tokenizer.takeChars();
			if (token) {
				var dash_style = 'solid';
				ctx.save();
				while (token) {
//					debug('processing token ' + token);
					switch (token) {
						case 'E': // filled ellipse
						case 'e': // unfilled ellipse
							var filled = ('E' == token);
							var cx = tokenizer.takeNumber();
							var cy = this.canviz.height - tokenizer.takeNumber();
							var rx = tokenizer.takeNumber();
							var ry = tokenizer.takeNumber();
							this.canviz.drawPath(ctx, new Ellipse(cx, cy, rx, ry), filled, dash_style);
							break;
						case 'P': // filled polygon
						case 'p': // unfilled polygon
						case 'L': // polyline
							var filled = ('P' == token);
							var closed = ('L' != token);
							var num_points = tokenizer.takeNumber();
							tokens = tokenizer.takeNumber(2 * num_points); // points
							var path = new Path();
							for (i = 2; i < 2 * num_points; i += 2) {
								path.addBezier([
									new Point(tokens[i - 2], this.canviz.height - tokens[i - 1]),
									new Point(tokens[i],     this.canviz.height - tokens[i + 1])
								]);
							}
							if (closed) {
								path.addBezier([
									new Point(tokens[2 * num_points - 2], this.canviz.height - tokens[2 * num_points - 1]),
									new Point(tokens[0],                  this.canviz.height - tokens[1])
								]);
							}
							this.canviz.drawPath(ctx, path, filled, dash_style);
							break;
						case 'B': // unfilled b-spline
						case 'b': // filled b-spline
							var filled = ('b' == token);
							var num_points = tokenizer.takeNumber();
							tokens = tokenizer.takeNumber(2 * num_points); // points
							var path = new Path();
							for (i = 2; i < 2 * num_points; i += 6) {
								path.addBezier([
									new Point(tokens[i - 2], this.canviz.height - tokens[i - 1]),
									new Point(tokens[i],     this.canviz.height - tokens[i + 1]),
									new Point(tokens[i + 2], this.canviz.height - tokens[i + 3]),
									new Point(tokens[i + 4], this.canviz.height - tokens[i + 5])
								]);
							}
							this.canviz.drawPath(ctx, path, filled, dash_style);
							break;
						case 'I': // image
							var x = tokenizer.takeNumber();
							var y = this.canviz.height - tokenizer.takeNumber();
							var w = tokenizer.takeNumber();
							var h = tokenizer.takeNumber();
							var src = tokenizer.takeString();
							if (!this.canviz.images[src]) {
								y -= h;
								this.canviz.images[src] = new GraphImage(this.canviz, src, x, y, w, h);
							}
							this.canviz.images[src].draw();
							break;
						case 'T': // text
							var x = Math.round(ctx_scale * tokenizer.takeNumber() + this.canviz.padding);
							var y = Math.round(ctx_scale * this.canviz.height + 2 * this.canviz.padding - (ctx_scale * (tokenizer.takeNumber() + this.canviz.bbScale * font_size) + this.canviz.padding));
							var text_align = tokenizer.takeNumber();
							var text_width = Math.round(ctx_scale * tokenizer.takeNumber());
							var str = tokenizer.takeString();
							if (!redraw_canvas_only && !str.match(/^\s*$/)) {
//								debug('draw text ' + str + ' ' + x + ' ' + y + ' ' + text_align + ' ' + text_width);
								str = str.escapeHTML();
								do {
									matches = str.match(/ ( +)/);
									if (matches) {
										var spaces = ' ';
										matches[1].length.times(function() {
											spaces += '&nbsp;';
										});
										str = str.replace(/  +/, spaces);
									}
								} while (matches);
								var text = new Element('div').update(str);
								text.setStyle({
									fontSize: Math.round(font_size * ctx_scale * this.canviz.bbScale) + 'px',
									fontFamily: font_family,
									color: ctx.strokeStyle,
									position: 'absolute',
									textAlign: (-1 == text_align) ? 'left' : (1 == text_align) ? 'right' : 'center',
									left: (x - (1 + text_align) * text_width) + 'px',
									top: y + 'px',
									width: (2 * text_width) + 'px'
								});
								this.canviz.texts.appendChild(text);
							}
							break;
						case 'C': // set fill color
						case 'c': // set pen color
							var fill = ('C' == token);
							var color = this.parseColor(tokenizer.takeString());
							if (fill) {
								ctx.fillStyle = color;
							} else {
								ctx.strokeStyle = color;
							}
							break;
						case 'F': // set font
							font_size = tokenizer.takeNumber();
							font_family = tokenizer.takeString();
							switch (font_family) {
								case 'Times-Roman':
									font_family = 'Times New Roman';
									break;
								case 'Courier':
									font_family = 'Courier New';
									break;
								case 'Helvetica':
									font_family = 'Arial';
									break;
								default:
									// nothing
							}
//							debug('set font ' + font_size + 'pt ' + font_family);
							break;
						case 'S': // set style
							var style = tokenizer.takeString();
							switch (style) {
								case 'solid':
								case 'filled':
									// nothing
									break;
								case 'dashed':
								case 'dotted':
									dash_style = style;
									break;
								case 'bold':
									ctx.lineWidth = 2;
									break;
								default:
									matches = style.match(/^setlinewidth\((.*)\)$/);
									if (matches) {
										ctx.lineWidth = Number(matches[1]);
									} else {
										debug('unknown style ' + style);
									}
							}
							break;
						default:
							debug('unknown token ' + token);
							return;
					}
					token = tokenizer.takeChars();
				}
				ctx.restore();
			}
		}.bind(this));
	},
	parseColor: function(color) {
		// rgb/rgba
		var matches = color.match(/^#([0-9a-f]{2})\s*([0-9a-f]{2})\s*([0-9a-f]{2})\s*([0-9a-f]{2})?$/i);
		if (matches) {
			if (matches[4]) { // rgba
				return 'rgba(' + parseInt(matches[1], 16) + ',' + parseInt(matches[2], 16) + ',' + parseInt(matches[3], 16) + ',' + (parseInt(matches[4], 16) / 255) + ')';
			} else { // rgb
				return '#' + matches[1] + matches[2] + matches[3];
			}
		}
		// hsv
		matches = color.match(/^(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)$/);
		if (matches) {
			return this.canviz.hsvToRgbColor(matches[1], matches[2], matches[3]);
		}
		// named color
		var color_scheme = this.getAttr('colorscheme');
		var color_name = color;
		matches = color.match(/^\/(.*)\/(.*)$/);
		if (matches) {
			if (matches[1]) {
				color_scheme = matches[1];
			}
			color_name = matches[2];
		} else {
			matches = color.match(/^\/(.*)$/);
			if (matches) {
				color_scheme = 'X11';
				color_name = matches[1];
			}
		}
		color_name = color_name.toLowerCase();
		var color_scheme_name = color_scheme.toLowerCase();
		if (this.canviz.colors.get(color_scheme_name)) {
			if (this.canviz.colors.get(color_scheme_name)[color_name]) {
				return (3 == this.canviz.colors.get(color_scheme_name)[color_name].length ? 'rgb(' : 'rgba(') + this.canviz.colors.get(color_scheme_name)[color_name].join(',') + ')';
			}
		} else {
			debug('unknown color scheme ' + color_scheme);
		}
		// unknown
		debug('unknown color ' + color + '; color scheme is ' + color_scheme);
		return '#000000';
	}
});

var Node = Class.create(Entity, {
	initialize: function($super, name, canviz, root_graph, parent_graph) {
		$super('nodeAttrs', name, canviz, root_graph, parent_graph);
	}
});

var Edge = Class.create(Entity, {
	initialize: function($super, name, canviz, root_graph, parent_graph, from_node, to_node) {
		$super('edgeAttrs', name, canviz, root_graph, parent_graph);
		this.fromNode = from_node;
		this.toNode = to_node;
	}
});

var Graph = Class.create(Entity, {
	initialize: function($super, name, canviz, root_graph, parent_graph) {
		$super('attrs', name, canviz, root_graph, parent_graph);
		this.nodeAttrs = $H();
		this.edgeAttrs = $H();
		this.nodes = $A();
		this.edges = $A();
		this.subgraphs = $A();
	},
	draw: function($super, ctx, ctx_scale, redraw_canvas_only) {
		$super(ctx, ctx_scale, redraw_canvas_only);
		[this.subgraphs, this.nodes, this.edges].each(function(type) {
			type.each(function(entity) {
				entity.draw(ctx, ctx_scale, redraw_canvas_only);
			});
		});
	}
});

var Canviz = Class.create({
	maxXdotVersion: '1.2',
	colors: $H({
		x11:{
			black:[0,0,0],
			lightgrey:[211,211,211],
			white:[255,255,255]
		}
	}),
	initialize: function(container, url) {
		this.canvas = new Element('canvas');
		this.texts = new Element('div');
		this.texts.makePositioned();
		this.container = $(container);
		this.container.appendChild(this.texts);
		this.container.appendChild(this.canvas);
		this.ctx = this.canvas.getContext('2d');
		this.scale = 1;
		this.padding = 8;
		this.dashLength = 6;
		this.dotSpacing = 4;
		this.graphs = $A();
		this.images = new Hash();
		this.numImages = 0;
		this.numImagesFinished = 0;
		if (url) {
			this.load(url);
		}
	},
	setScale: function(scale) {
		this.scale = scale;
	},
	setImagePath: function(imagePath) {
		this.imagePath = imagePath;
	},
	load: function(url) {
		$('debug_output').innerHTML = '';
		new Ajax.Request(url, {
			method: 'get',
			onComplete: function(response) {
				this.parse(response.responseText);
			}.bind(this)
		});
	},
	parse: function(xdot) {
		this.graphs = $A();
		this.width = 0;
		this.height = 0;
		this.maxWidth = false;
		this.maxHeight = false;
		this.bbEnlarge = false;
		this.bbScale = 1;
		this.dpi = 96;
		this.bgcolor = '#ffffff';
		var lines = xdot.split(/\r?\n/);
		var i = 0;
		var line, lastchar, matches, root_graph, is_graph, entity, entity_name, attrs, attr_name, attr_value, attr_hash, draw_attr_hash;
		var containers = $A();
		while (i < lines.length) {
			line = lines[i++].replace(/^\s+/, '');
			if ('' != line && '#' != line.substr(0, 1)) {
				while (i < lines.length && ';' != (lastchar = line.substr(line.length - 1, line.length)) && '{' != lastchar && '}' != lastchar) {
					if ('\\' == lastchar) {
						line = line.substr(0, line.length - 1);
					}
					line += lines[i++];
				}
//				debug(line);
				if (0 == containers.length) {
					matches = line.match(this.graphMatchRe);
					if (matches) {
						root_graph = new Graph(matches[3], this);
						containers.unshift(root_graph);
						containers[0].strict = !Object.isUndefined(matches[1]);
						containers[0].type = ('graph' == matches[2]) ? 'undirected' : 'directed';
						containers[0].attrs.set('xdotversion', '1.0');
						containers[0].attrs.set('colorscheme', 'X11');
						containers[0].nodeAttrs.set('colorscheme', 'X11');
						containers[0].edgeAttrs.set('colorscheme', 'X11');
						this.graphs.push(containers[0]);
//						debug('graph: ' + containers[0].name);
					}
				} else {
					matches = line.match(this.subgraphMatchRe);
					if (matches) {
						containers.unshift(new Graph(matches[1], this, root_graph, containers[0]));
						containers[1].subgraphs.push(containers[0]);
//						debug('subgraph: ' + containers[0].name);
					}
				}
				if (matches) {
//					debug('begin container ' + containers[0].name);
				} else if ('}' == line) {
//					debug('end container ' + containers[0].name);
					containers.shift();
					if (0 == containers.length) {
						break;
					}
				} else {
					matches = line.match(this.nodeMatchRe);
					if (matches) {
						entity_name = matches[2];
						attrs = matches[5];
						draw_attr_hash = containers[0].drawAttrs;
						is_graph = false;
						switch (entity_name) {
							case 'graph':
								attr_hash = containers[0].attrs;
								is_graph = true;
								break;
							case 'node':
								attr_hash = containers[0].nodeAttrs;
								break;
							case 'edge':
								attr_hash = containers[0].edgeAttrs;
								break;
							default:
								entity = new Node(entity_name, this, root_graph, containers[0]);
								attr_hash = entity.attrs;
								draw_attr_hash = entity.drawAttrs;
								containers[0].nodes.push(entity);
						}
//						debug('node: ' + entity_name);
					} else {
						matches = line.match(this.edgeMatchRe);
						if (matches) {
							entity_name = matches[1];
							attrs = matches[8];
							entity = new Edge(entity_name, this, root_graph, containers[0], matches[2], matches[5]);
							attr_hash = entity.attrs;
							draw_attr_hash = entity.drawAttrs;
							containers[0].edges.push(entity);
//							debug('edge: ' + entity_name);
						}
					}
					if (matches) {
						do {
							if (0 == attrs.length) {
								break;
							}
							matches = attrs.match(this.attrMatchRe);
							if (matches) {
								attrs = attrs.substr(matches[0].length);
								attr_name = matches[1];
								attr_value = this.unescape(matches[2]);
								if (attr_name.match(/^_.*draw_$/)) {
									draw_attr_hash.set(attr_name, attr_value);
								} else {
									attr_hash.set(attr_name, attr_value);
								}
//								debug(attr_name + ' ' + attr_value);
								if (is_graph && 1 == containers.length) {
									switch (attr_name) {
										case 'bb':
											var bb = attr_value.split(/,/);
											this.width  = Number(bb[2]);
											this.height = Number(bb[3]);
											break;
										case 'bgcolor':
											this.bgcolor = root_graph.parseColor(attr_value);
											break;
										case 'dpi':
											this.dpi = attr_value;
											break;
										case 'size':
											var size = attr_value.match(/^(\d+|\d*(?:\.\d+)),\s*(\d+|\d*(?:\.\d+))(!?)$/);
											if (size) {
												this.maxWidth  = 72 * Number(size[1]);
												this.maxHeight = 72 * Number(size[2]);
												this.bbEnlarge = ('!' == size[3]);
											} else {
												debug('can\'t parse size');
											}
											break;
										case 'xdotversion':
											if (0 > this.versionCompare(this.maxXdotVersion, attr_hash.get('xdotversion'))) {
												debug('unsupported xdotversion ' + attr_hash.get('xdotversion') + '; this script currently supports up to xdotversion ' + this.maxXdotVersion);
											}
											break;
									}
								}
							} else {
								debug('can\'t read attributes for entity ' + entity_name + ' from ' + attrs);
							}
						} while (matches);
					}
				}
			}
		}
/*
		if (this.maxWidth && this.maxHeight) {
			if (this.width > this.maxWidth || this.height > this.maxHeight || this.bbEnlarge) {
				this.bbScale = Math.min(this.maxWidth / this.width, this.maxHeight / this.height);
				this.width  = Math.round(this.width  * this.bbScale);
				this.height = Math.round(this.height * this.bbScale);
			}
		}
*/
//		debug('done');
		this.draw();
	},
	draw: function(redraw_canvas_only) {
		if (Object.isUndefined(redraw_canvas_only)) redraw_canvas_only = false;
		var ctx_scale = this.scale * this.dpi / 72;
		var width  = Math.round(ctx_scale * this.width  + 2 * this.padding);
		var height = Math.round(ctx_scale * this.height + 2 * this.padding);
		if (!redraw_canvas_only) {
			this.canvas.width  = width;
			this.canvas.height = height;
			this.canvas.setStyle({
				width:  width  + 'px',
				height: height + 'px'
			});
			this.container.setStyle({
				width:  width  + 'px'
			});
			while (this.texts.firstChild) {
				this.texts.removeChild(this.texts.firstChild);
			}
		}
		this.ctx.save();
		this.ctx.lineCap = 'round';
		this.ctx.fillStyle = this.bgcolor;
		this.ctx.fillRect(0, 0, width, height);
		this.ctx.translate(this.padding, this.padding);
		this.ctx.scale(ctx_scale, ctx_scale);
		this.graphs[0].draw(this.ctx, ctx_scale, redraw_canvas_only);
		this.ctx.restore();
	},
	drawPath: function(ctx, path, filled, dash_style) {
		if (filled) {
			ctx.beginPath();
			path.draw(ctx);
			ctx.fill();
		}
		if (ctx.fillStyle != ctx.strokeStyle || !filled) {
			switch (dash_style) {
				case 'dashed':
					ctx.beginPath();
					path.drawDashed(ctx, this.dashLength);
					break;
				case 'dotted':
					var oldLineWidth = ctx.lineWidth;
					ctx.lineWidth *= 2;
					ctx.beginPath();
					path.drawDotted(ctx, this.dotSpacing);
					break;
				case 'solid':
				default:
					if (!filled) {
						ctx.beginPath();
						path.draw(ctx);
					}
			}
			ctx.stroke();
			if (oldLineWidth) ctx.lineWidth = oldLineWidth;
		}
	},
	unescape: function(str) {
		var matches = str.match(/^"(.*)"$/);
		if (matches) {
			return matches[1].replace(/\\"/g, '"');
		} else {
			return str;
		}
	},
	hsvToRgbColor: function(h, s, v) {
		var i, f, p, q, t, r, g, b;
		h *= 360;
		i = Math.floor(h / 60) % 6;
		f = h / 60 - i;
		p = v * (1 - s);
		q = v * (1 - f * s);
		t = v * (1 - (1 - f) * s);
		switch (i) {
			case 0: r = v; g = t; b = p; break;
			case 1: r = q; g = v; b = p; break;
			case 2: r = p; g = v; b = t; break;
			case 3: r = p; g = q; b = v; break;
			case 4: r = t; g = p; b = v; break;
			case 5: r = v; g = p; b = q; break;
		}
		return 'rgb(' + Math.round(255 * r) + ',' + Math.round(255 * g) + ',' + Math.round(255 * b) + ')';
	},
	versionCompare: function(a, b) {
		a = a.split('.');
		b = b.split('.');
		var a1, b1;
		while (a.length || b.length) {
			a1 = a.length ? a.shift() : 0;
			b1 = b.length ? b.shift() : 0;
			if (a1 < b1) return -1;
			if (a1 > b1) return 1;
		}
		return 0;
	},
	// an alphanumeric string or a number or a double-quoted string or an HTML string
	idMatch: '([a-zA-Z\u0080-\uFFFF_][0-9a-zA-Z\u0080-\uFFFF_]*|-?(?:\\.\\d+|\\d+(?:\\.\\d*)?)|"(?:\\\\"|[^"])*"|<(?:<[^>]*>|[^<>]+?)+>)'
});
Object.extend(Canviz.prototype, {
	// ID or ID:port or ID:compass_pt or ID:port:compass_pt
	nodeIdMatch: Canviz.prototype.idMatch + '(?::' + Canviz.prototype.idMatch + ')?(?::' + Canviz.prototype.idMatch + ')?'
});
Object.extend(Canviz.prototype, {
	graphMatchRe: new RegExp('^(strict\\s+)?(graph|digraph)(?:\\s+' + Canviz.prototype.idMatch + ')?\\s*{$', 'i'),
	subgraphMatchRe: new RegExp('^(?:subgraph\\s+)?' + Canviz.prototype.idMatch + '?\\s*{$', 'i'),
	nodeMatchRe: new RegExp('^(' + Canviz.prototype.nodeIdMatch + ')\\s+\\[(.+)\\];$'),
	edgeMatchRe: new RegExp('^(' + Canviz.prototype.nodeIdMatch + '\\s*-[->]\\s*' + Canviz.prototype.nodeIdMatch + ')\\s+\\[(.+)\\];$'),
	attrMatchRe: new RegExp('^' + Canviz.prototype.idMatch + '=' + Canviz.prototype.idMatch + '(?:[,\\s]+|$)')
});

var GraphImage = Class.create({
	initialize: function(graph, src, x, y, w, h) {
		this.graph = graph;
		++this.graph.numImages;
		this.src = this.graph.imagePath + src;
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.loaded = false;
		this.img = new Image();
		this.img.onload = this.succeeded.bind(this);
		this.img.onerror = this.finished.bind(this);
		this.img.onabort = this.finished.bind(this);
		this.img.src = this.src;
	},
	succeeded: function() {
		this.loaded = true;
		this.finished();
	},
	finished: function() {
		++this.graph.numImagesFinished;
		if (this.graph.numImages == this.graph.numImagesFinished) {
			this.graph.draw(true);
		}
	},
	draw: function() {
		if (this.loaded) {
			this.graph.ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
		}
	}
});

function debug(str, escape) {
	str = String(str);
	if (Object.isUndefined(escape)) {
		escape = true;
	}
	if (escape) {
		str = str.escapeHTML();
	}
	$('debug_output').innerHTML += '&raquo;' + str + '&laquo;<br />';
}
