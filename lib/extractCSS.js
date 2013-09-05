(function (global, doc) {

	var html = doc.documentElement,
		width = 800,
		height = 1200,
		stylesheets = [],
		mediaStylesheets = [],
		left,
		matchesSelector = html.matchesSelector || html.mozMatchesSelector || html.webkitMatchesSelector || html.msMatchesSelector || html.oMatchesSelector;


	function init () {
		width = html.offsetWidth;
		height = global.innerHeight;
		mediaStylesheets = Array.prototype.slice.call(doc.styleSheets).filter(function (stylesheet) {
			return (!stylesheet.media || stylesheet.media[0] == "screen" || stylesheet.media[0] == "all");
		});
		left = mediaStylesheets.slice(0);

		var base = global.location.href.replace(/\/[^/]+$/, "/");

		mediaStylesheets.forEach(function (stylesheet) {
			fetchStylesheet(stylesheet.href, function (text) {
				var index = left.indexOf(stylesheet);
				if (index > -1) {
					left.splice(index, 1);
				}
				text = text.replace(/\/\*[\s\S]+?\*\//g, "").replace(/[\n\r]+/g, "").replace(/url\((["']|)(\.\.\/[^"'\(\)]+)\1\)/g, function (m, quote, url) {
					return "url(\"" + pathRelativeToPage(base, stylesheet.href, url) + "\")";
				});
				stylesheets.push(text);
				if (left.length == 0) {
					complete();
				}
			});
		});

		function complete () {
			var elements = Array.prototype.slice.call(doc.getElementsByTagName("*")),
				inview = [];
			
			// get elements within viewport
			inview = elements.filter(function (element) {
				var rect = element.getBoundingClientRect();
				return (rect.top < height);
			})
			
			var CSS = stylesheets.map(function (css) {
				return outputRules(filterCSS(css, inview));
			}).join("");
			
			message("complete", CSS);
			
		}

	}

	function message (message, data) {
		var response = {
			message: message,
			data: data
		};
		if (typeof global.callPhantom === 'function') {
			global.callPhantom(response);
		}
		else {
			console.log(response);
		}
	}

	function outputRules (rules) {
		return rules.map(function (rule) {
			return rule.selectors.join(",") + "{" + rule.css + "}";
		}).join("");
	}

	function matchSelectors (selectors, elements) {
		
		return selectors.map(function (selector) {
			// strip comments
			return selector.replace(/\/\*[\s\S]+?\*\//g, "");
		}).filter(function (selector) {
			selector = selector.replace(/(?::?)(?:after|before)\s*$/, "");
			if (!selector || selector.match(/@/)) {
				return false;
			}
			else if (selector.match(/^::/)) { // wildcard ::pseudo-selectors 
				return true;
			} 
			return elements.some(function (element) {
				return matchesSelector.call(element, selector);
			});
		});
	}

	function filterCSS (css, inview) {

		var rules = parseRules(css),
			matchedRules = [];

		rules.forEach(function (rule) {
			var matchingSelectors = [];
			atRuleMatch = rule.selectors[0].match(/^\s*(@[a-z\-]+)/);
			if (rule.selectors) {
				if (atRuleMatch) {

					switch (atRuleMatch[1]) {
						case "@font-face":
							matchingSelectors = ["@font-face"];
							break;
						case "@media":
							var matchedSubRules = filterCSS(rule.css, inview);
							if (matchedSubRules.length) {
								matchingSelectors = rule.selectors;
								rule.css = outputRules(matchedSubRules);
							}
							break;
					}

				}
				else {
					matchingSelectors = matchSelectors(rule.selectors, inview);
				}
			}
			if (matchingSelectors.length) {
				rule.selectors = matchingSelectors;
				matchedRules.push(rule);
			}
		});

		return matchedRules;

	}

	function parseRules (css) {
		var matches = css.replace(/\n+/g, " ").match(/(?:[^{}]+\s*\{[^{}]+\})|(?:[^{}]+\{\s*(?:[^{}]+\{[^{}]+\})+\s*\})/g),
			rules = [];

		if (matches) {
			matches.forEach(function (match) {
				var rule = parseRule(match);
				if (rule) {
					rules.push(rule);
				}
			});
		}
		
		return rules;
	} 

	function parseRule (rule) {
		var match = rule.match(/^\s*([^{}]+)\s*\{\s*((?:[^{}]+\{[^{}]+\})+|[^{}]+)\s*\}$/);
		return {
			selectors: match && match[1].split(/\s*,\s*/),
			css: match && match[2]
		}
	}

	function pathRelativeToPage (basepath, csspath, sourcepath) {
		while (sourcepath.indexOf("../") == 0) {
			sourcepath = sourcepath.slice(3);
			csspath = csspath.replace(/\/[^/]+\/[^/]*$/, "/");
		}
		var path = csspath + sourcepath;
		return (path.indexOf(basepath) === 0) ? path.slice(basepath.length) : path;
	}
	
	function fetchStylesheet (url, callback) {
		var xhr = new XMLHttpRequest();
		
		xhr.open("GET", url, false);
		
		xhr.onload = function () {
			callback(xhr.responseText);
		};
		
		xhr.send(null);
		
		return xhr;
	}

	if (doc.readyState != "complete") {
		global.addEventListener("load", function () {
			init();
		}, false);
	}
	else {
		init();
	}


} (window, document));