var debug = {
	time: new Date(),
	loadTime: null,
	processingTime: null,
	requests: [],
	stripped: [],
	cssLength: 0
};

var fs = require("fs"),
	webpage = require("webpage"),
	system = require("system");

phantom.onError = function (msg, trace) {
	var msgStack = ["PHANTOM ERROR: " + msg];
	if (trace && trace.length) {
		msgStack.push("TRACE:");
		trace.forEach(function (t) {
			msgStack.push(" -> " + (t.file || t.sourceURL) + ": " + t.line + (t.function ? " (in function " + t.function + ")" : ""));
		});
	}
	system.stderr.write(msgStack.join("\n"));
	phantom.exit(1);
};

var args = [].slice.call(system.args, 1), arg,
	html, url, fakeUrl,
	value,
	width = 1200,
	height = 0,
	matchMQ,
	required,
	prefetch,
	cssOnly = false,
	cssId,
	cssToken,
	exposeStylesheets,
	stripResources,
	localStorage,
	outputDebug;

while (args.length) {
	arg = args.shift();
	switch (arg) {

		case "-f":
		case "--fake-url":
			value = (args.length) ? args.shift() : "";
			if (value) {
				if (!value.match(/(\/|\.[^./]+)$/)) {
					value += "/";
				}
				fakeUrl = value;
			}
			else {
				fail("Expected string for '--fake-url' option");
			}
			break;

		case "-w":
		case "--width":
			value = (args.length) ? args.shift() : "";
			if (value.match(/^\d+$/)) {
				width = value;
			}
			else {
				fail("Expected numeric value for '--width' option");
			}
			break;

		case "-h":
		case "--height":
			value = (args.length) ? args.shift() : "";
			if (value.match(/^\d+$/)) {
				height = value;
			}
			else {
				fail("Expected numeric value for '--height' option");
			}
			break;

		case "-m":
		case "--match-media-queries":
			matchMQ = true;
			break;

		case "-r":
		case "--required-selectors":
			value = (args.length) ? args.shift() : "";
			if (value) {
				value = parseString(value);
				if (typeof value == "string") {
					value = value.split(/\s*,\s*/).map(function (string) {
						return "(?:" + string.replace(/([.*+?=^!:${}()|[\]\/\\])/g, '\\$1') + ")";
					}).join("|");

					value = [value];
				}

				required = value;
			}
			else {
				fail("Expected a string for '--required-selectors' option");
			}
			break;

		case "-e":
		case "--expose-stylesheets":
			value = (args.length) ? args.shift() : "";
			if (value) {
				exposeStylesheets = ((value.indexOf(".") > -1) ? "" : "var ") + value;
			}
			else {
				fail("Expected a string for '--expose-stylesheets' option");
			}
			break;

		case "-p":
		case "--prefetch":
			prefetch = true;
			break;

		case "-t":
		case "--insertion-token":
			value = (args.length) ? args.shift() : "";
			if (value) {
				cssToken = parseString(value);
			}
			else {
				fail("Expected a string for '--insertion-token' option");
			}
			break;

		case "-i":
		case "--css-id":
			value = (args.length) ? args.shift() : "";
			if (value) {
				cssId = value;
			}
			else {
				fail("Expected a string for '--css-id' option");
			}
			break;

		case "-s":
		case "--strip-resources":
			value = (args.length) ? args.shift() : "";
			if (value) {
				value = parseString(value);
				if (typeof value == "string") {
					value = [value];
				}
				value = value.map(function (string) {
					//throw new Error(string);
					return new RegExp(string, "i");
				});
				stripResources = value;
			}
			else {
				fail("Expected a string for '--strip-resources' option");
			}
			break;

		case "-l":
		case "--local-storage":
			value = (args.length) ? args.shift() : "";
			if (value) {
				localStorage = parseString(value);
			}
			else {
				fail("Expected a string for '--local-storage' option");
			}
			break;

		case "-c":
		case "--css-only":
			cssOnly = true;
			break;

		case "-d":
		case "--debug":
			outputDebug = true;
			break;

		default:
			if (!url && !arg.match(/^--?[a-z]/)) {
				url = arg;
			}
			else {
				fail("Unknown option");
			}
			break;
	}

}

var page = webpage.create();

page.viewportSize = {
	width: width,
	height: height || 800
};

if (stripResources) {
	var baseUrl = url || fakeUrl;
	page.onResourceRequested = function (requestData, request) {
		var _url = requestData["url"];
		if (_url.indexOf(baseUrl) > -1) {
			_url = _url.slice(baseUrl.length);
		}
		if (!_url.match(/^data/) && debug.requests.indexOf(_url) < 0) {
			debug.requests.push(_url);
		}
		var i = 0,
			l = stripResources.length;
		// /http:\/\/.+?\.(jpg|png|svg|gif)$/gi
		while (i < l) {
			if (stripResources[i++].test(_url)) {
				debug.stripped.push(_url);
				request.abort();
				break;
			}
		}
	};
}

page.onCallback = function (response) {
	page.close();
	if ("css" in response) {
		var result;
		if (cssOnly) {
			result = response.css;
		}
		else {
			result = inlineCSS(response.css);
		}
		if (outputDebug) {
			debug.cssLength = response.css.length;
			debug.time = new Date() - debug.time;
			debug.processingTime = debug.time - debug.loadTime;
			result += "\n<!--\n\t" + JSON.stringify(debug) + "\n-->";
		}
		system.stdout.write(result);
		phantom.exit();
	}
	else {
		system.stdout.write(response);
		phantom.exit();
	}
};

page.onError = function (msg, trace) {
	var msgStack = ['ERROR: ' + msg];
	if (trace && trace.length) {
		msgStack.push('TRACE:');
		trace.forEach(function (t) {
			msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
		});
	}
	fail(msgStack.join('\n'));
};

page.onLoadFinished = function () {

	if (!html) {
		html = page.evaluate(function () {
			var xhr = new XMLHttpRequest(),
				html;
			xhr.open("get", window.location.href, false);
			xhr.onload = function () {
				html = xhr.responseText;
			};
			xhr.send();
			return html;
		});
	}

	debug.loadTime = new Date() - debug.loadTime;

	var options = {};

	if (matchMQ) {
		options.matchMQ = true;
	}

	if (required) {
		options.required = required;
	}

	if (localStorage) {
		page.evaluate(function (data) {
			var storage = window.localStorage;
			if (storage) {
				for (var key in data) {
					storage.setItem(key, data[key]);
				}
			}
		}, localStorage);
	}

	if (Object.keys(options).length) {
		page.evaluate(function (options) {
			window.extractCSSOptions = options;
		}, options);
	}

	if (!height) {
		var _height = page.evaluate(function () {
			return document.body.offsetHeight;
		});
		page.viewportSize = {
			width: width,
			height: _height
		};
	}

	var scriptPath = phantom.libraryPath + "/extractCSS.js";

	if (!fs.isFile(scriptPath)) {
		fail("Unable to locate script at: " + scriptPath);
	}

	var injection = page.injectJs(scriptPath);
	if (!injection) {
		fail("Unable to inject script in page");
	}

};

if (url) {

	debug.loadTime = new Date();
	page.open(url);

}
else {

	if (!fakeUrl) {
		fail("Missing 'fake-url' option");
	}

	html = system.stdin.read();
	system.stdin.close();

	debug.loadTime = new Date();
	page.setContent(html, fakeUrl);

}



function inlineCSS(css) {

	var tokenAtFirstStylesheet = !cssToken, // auto-insert css if no cssToken has been specified.
		insertToken = function (m) {
			var string = "";
			if (tokenAtFirstStylesheet) {
				tokenAtFirstStylesheet = false;
				var whitespace = m.match(/^[^<]+/);
				string = ((whitespace) ? whitespace[0] : "") + cssToken;
			}
			return string;
		},
		links = [],
		stylesheets = [];

	if (!cssToken) {
		cssToken = "<!-- inline CSS insertion token -->";
	}

	html = html.replace(/[ \t]*<link [^>]*rel=["']?stylesheet["'][^>]*\/>[ \t]*(?:\n|\r\n)?/g, function (m) {
		links.push(m);
		return insertToken(m);
	});

	stylesheets = links.map(function (link) {
		var urlMatch = link.match(/href="([^"]+)"/),
			mediaMatch = link.match(/media="([^"]+)"/),
			url = urlMatch && urlMatch[1],
			media = mediaMatch && mediaMatch[1];

		return { url: url, media: media };
	});

	var index = html.indexOf(cssToken),
		length = cssToken.length;

	if (index == -1) {
		fail("token not found:\n" + cssToken);
	}

	var replacement = "<style " + ((cssId) ? "id=\"" + cssId + "\" " : "") + "media=\"screen\">\n\t\t\t" + css + "\n\t\t</style>\n";

	if (exposeStylesheets) {
		replacement += "\t\t<script>\n\t\t\t" + exposeStylesheets + " = [" + stylesheets.map(function (link) {
			return "{href:\"" + link.url + "\", media:\"" + link.media + "\"}";
		}).join(",") + "];\n\t\t</script>\n";
	}

	if (prefetch) {
		replacement += stylesheets.map(function (link) {
			return "\t\t<link rel=\"prefetch\" href=\"" + link.url + "\" />\n";
		}).join("");
	}

	return html.slice(0, index - 1) + replacement + html.slice(index + length);

}

function fail(message) {
	system.stderr.write(message);
	phantom.exit();
}

function parseString(value) {
	if (value.match(/^(["']).*\1$/)) {
		value = JSON.parse(value);
	}
	if (typeof value == "string") {
		if (value.match(/^\{.*\}$/) || value.match(/^\[.*\]$/)) {
			value = JSON.parse(value);
		}
	}
	return value;
}