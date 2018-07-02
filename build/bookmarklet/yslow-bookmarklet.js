/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
/**
 * The YUI module contains the components required for building the YUI seed
 * file.  This includes the script loading mechanism, a simple queue, and
 * the core utilities for the library.
 * @module yui
 * @submodule yui-base
 */

if (typeof YUI != 'undefined') {
    YUI._YUI = YUI;
}

/**
 * The YUI global namespace object.  If YUI is already defined, the
 * existing YUI object will not be overwritten so that defined
 * namespaces are preserved.  It is the constructor for the object
 * the end user interacts with.  As indicated below, each instance
 * has full custom event support, but only if the event system
 * is available.  This is a self-instantiable factory function.  You
 * can invoke it directly like this:
 *
 * YUI().use('*', function(Y) {
 *   // ready
 * });
 *
 * But it also works like this:
 *
 * var Y = YUI();
 *
 * @class YUI
 * @constructor
 * @global
 * @uses EventTarget
 * @param o* {object} 0..n optional configuration objects.  these values
 * are store in Y.config.  See config for the list of supported
 * properties.
 */
    /*global YUI*/
    /*global YUI_config*/
    var YUI = function() {
        var i = 0,
            Y = this,
            args = arguments,
            l = args.length,
            instanceOf = function(o, type) {
                return (o && o.hasOwnProperty && (o instanceof type));
            },
            gconf = (typeof YUI_config !== 'undefined') && YUI_config;

        if (!(instanceOf(Y, YUI))) {
            Y = new YUI();
        } else {
            // set up the core environment
            Y._init();

            // YUI.GlobalConfig is a master configuration that might span
            // multiple contexts in a non-browser environment.  It is applied
            // first to all instances in all contexts.
            if (YUI.GlobalConfig) {
                Y.applyConfig(YUI.GlobalConfig);
            }

            // YUI_Config is a page-level config.  It is applied to all
            // instances created on the page.  This is applied after
            // YUI.GlobalConfig, and before the instance level configuration
            // objects.
            if (gconf) {
                Y.applyConfig(gconf);
            }

            // bind the specified additional modules for this instance
            if (!l) {
                Y._setup();
            }
        }

        if (l) {
            // Each instance can accept one or more configuration objects.
            // These are applied after YUI.GlobalConfig and YUI_Config,
            // overriding values set in those config files if there is a '
            // matching property.
            for (; i < l; i++) {
                Y.applyConfig(args[i]);
            }

            Y._setup();
        }

        Y.instanceOf = instanceOf;

        return Y;
    };

(function() {

    var proto, prop,
        VERSION = '3.3.0',
        PERIOD = '.',
        BASE = 'http://yui.yahooapis.com/',
        DOC_LABEL = 'yui3-js-enabled',
        NOOP = function() {},
        SLICE = Array.prototype.slice,
        APPLY_TO_AUTH = { 'io.xdrReady': 1,   // the functions applyTo
                          'io.xdrResponse': 1,   // can call. this should
                          'SWF.eventHandler': 1 }, // be done at build time
        hasWin = (typeof window != 'undefined'),
        win = (hasWin) ? window : null,
        doc = (hasWin) ? win.document : null,
        docEl = doc && doc.documentElement,
        docClass = docEl && docEl.className,
        instances = {},
        time = new Date().getTime(),
        add = function(el, type, fn, capture) {
            if (el && el.addEventListener) {
                el.addEventListener(type, fn, capture);
            } else if (el && el.attachEvent) {
                el.attachEvent('on' + type, fn);
            }
        },
        remove = function(el, type, fn, capture) {
            if (el && el.removeEventListener) {
                // this can throw an uncaught exception in FF
                try {
                    el.removeEventListener(type, fn, capture);
                } catch (ex) {}
            } else if (el && el.detachEvent) {
                el.detachEvent('on' + type, fn);
            }
        },
        handleLoad = function() {
            YUI.Env.windowLoaded = true;
            YUI.Env.DOMReady = true;
            if (hasWin) {
                remove(window, 'load', handleLoad);
            }
        },
        getLoader = function(Y, o) {
            var loader = Y.Env._loader;
            if (loader) {
                loader.ignoreRegistered = false;
                loader.onEnd = null;
                loader.data = null;
                loader.required = [];
                loader.loadType = null;
            } else {
                loader = new Y.Loader(Y.config);
                Y.Env._loader = loader;
            }

            return loader;
        },

        clobber = function(r, s) {
            for (var i in s) {
                if (s.hasOwnProperty(i)) {
                    r[i] = s[i];
                }
            }
        },

        ALREADY_DONE = { success: true };

//  Stamp the documentElement (HTML) with a class of "yui-loaded" to
//  enable styles that need to key off of JS being enabled.
if (docEl && docClass.indexOf(DOC_LABEL) == -1) {
    if (docClass) {
        docClass += ' ';
    }
    docClass += DOC_LABEL;
    docEl.className = docClass;
}

if (VERSION.indexOf('@') > -1) {
    VERSION = '3.2.0'; // dev time hack for cdn test
}

proto = {
    /**
     * Applies a new configuration object to the YUI instance config.
     * This will merge new group/module definitions, and will also
     * update the loader cache if necessary.  Updating Y.config directly
     * will not update the cache.
     * @method applyConfig
     * @param {object} the configuration object.
     * @since 3.2.0
     */
    applyConfig: function(o) {

        o = o || NOOP;

        var attr,
            name,
            // detail,
            config = this.config,
            mods = config.modules,
            groups = config.groups,
            rls = config.rls,
            loader = this.Env._loader;

        for (name in o) {
            if (o.hasOwnProperty(name)) {
                attr = o[name];
                if (mods && name == 'modules') {
                    clobber(mods, attr);
                } else if (groups && name == 'groups') {
                    clobber(groups, attr);
                } else if (rls && name == 'rls') {
                    clobber(rls, attr);
                } else if (name == 'win') {
                    config[name] = attr.contentWindow || attr;
                    config.doc = config[name].document;
                } else if (name == '_yuid') {
                    // preserve the guid
                } else {
                    config[name] = attr;
                }
            }
        }

        if (loader) {
            loader._config(o);
        }
    },

    _config: function(o) {
        this.applyConfig(o);
    },

    /**
     * Initialize this YUI instance
     * @private
     */
    _init: function() {
        var filter,
            Y = this,
            G_ENV = YUI.Env,
            Env = Y.Env,
            prop;

        /**
         * The version number of the YUI instance.
         * @property version
         * @type string
         */
        Y.version = VERSION;

        if (!Env) {
            Y.Env = {
                mods: {}, // flat module map
                versions: {}, // version module map
                base: BASE,
                cdn: BASE + VERSION + '/build/',
                // bootstrapped: false,
                _idx: 0,
                _used: {},
                _attached: {},
                _yidx: 0,
                _uidx: 0,
                _guidp: 'y',
                _loaded: {},
                serviced: {},
                getBase: G_ENV && G_ENV.getBase ||

    function(srcPattern, comboPattern) {
        var b, nodes, i, src, match;
        // get from querystring
        nodes = (doc && doc.getElementsByTagName('script')) || [];
        for (i = 0; i < nodes.length; i = i + 1) {
            src = nodes[i].src;
            if (src) {

                match = src.match(srcPattern);
                b = match && match[1];
                if (b) {
                    // this is to set up the path to the loader.  The file
                    // filter for loader should match the yui include.
                    filter = match[2];

                    if (filter) {
                        match = filter.indexOf('js');

                        if (match > -1) {
                            filter = filter.substr(0, match);
                        }
                    }

                    // extract correct path for mixed combo urls
                    // http://yuilibrary.com/projects/yui3/ticket/2528423
                    match = src.match(comboPattern);
                    if (match && match[3]) {
                        b = match[1] + match[3];
                    }

                    break;
                }
            }
        }

        // use CDN default
        return b || Env.cdn;
    }
            };

            Env = Y.Env;

            Env._loaded[VERSION] = {};

            if (G_ENV && Y !== YUI) {
                Env._yidx = ++G_ENV._yidx;
                Env._guidp = ('yui_' + VERSION + '_' +
                             Env._yidx + '_' + time).replace(/\./g, '_');
            } else if (YUI._YUI) {

                G_ENV = YUI._YUI.Env;
                Env._yidx += G_ENV._yidx;
                Env._uidx += G_ENV._uidx;

                for (prop in G_ENV) {
                    if (!(prop in Env)) {
                        Env[prop] = G_ENV[prop];
                    }
                }

                delete YUI._YUI;
            }

            Y.id = Y.stamp(Y);
            instances[Y.id] = Y;

        }

        Y.constructor = YUI;

        // configuration defaults
        Y.config = Y.config || {
            win: win,
            doc: doc,
            debug: true,
            useBrowserConsole: true,
            throwFail: true,
            bootstrap: true,
            cacheUse: true,
            fetchCSS: true
        };

        Y.config.base = YUI.config.base ||
            Y.Env.getBase(/^(.*)yui\/yui([\.\-].*)js(\?.*)?$/,
                          /^(.*\?)(.*\&)(.*)yui\/yui[\.\-].*js(\?.*)?$/);

        if (!filter || (!('-min.-debug.').indexOf(filter))) {
            filter = '-min.';
        }

        Y.config.loaderPath = YUI.config.loaderPath ||
            'loader/loader' + (filter || '-min.') + 'js';

    },

    /**
     * Finishes the instance setup. Attaches whatever modules were defined
     * when the yui modules was registered.
     * @method _setup
     * @private
     */
    _setup: function(o) {
        var i, Y = this,
            core = [],
            mods = YUI.Env.mods,
            extras = Y.config.core || ['get',
                                        'rls',
                                        'intl-base',
                                        'loader',
                                        'yui-log',
                                        'yui-later',
                                        'yui-throttle'];

        for (i = 0; i < extras.length; i++) {
            if (mods[extras[i]]) {
                core.push(extras[i]);
            }
        }

        Y._attach(['yui-base']);
        Y._attach(core);

    },

    /**
     * Executes a method on a YUI instance with
     * the specified id if the specified method is whitelisted.
     * @method applyTo
     * @param id {string} the YUI instance id.
     * @param method {string} the name of the method to exectute.
     * Ex: 'Object.keys'.
     * @param args {Array} the arguments to apply to the method.
     * @return {object} the return value from the applied method or null.
     */
    applyTo: function(id, method, args) {
        if (!(method in APPLY_TO_AUTH)) {
            this.log(method + ': applyTo not allowed', 'warn', 'yui');
            return null;
        }

        var instance = instances[id], nest, m, i;
        if (instance) {
            nest = method.split('.');
            m = instance;
            for (i = 0; i < nest.length; i = i + 1) {
                m = m[nest[i]];
                if (!m) {
                    this.log('applyTo not found: ' + method, 'warn', 'yui');
                }
            }
            return m.apply(instance, args);
        }

        return null;
    },

    /**
     * Registers a module with the YUI global.  The easiest way to create a
     * first-class YUI module is to use the YUI component build tool.
     *
     * http://yuilibrary.com/projects/builder
     *
     * The build system will produce the YUI.add wrapper for you module, along
     * with any configuration info required for the module.
     * @method add
     * @param name {string} module name.
     * @param fn {Function} entry point into the module that
     * is used to bind module to the YUI instance.
     * @param version {string} version string.
     * @param details {object} optional config data:
     * requires: features that must be present before this module can be
     * attached.
     * optional: optional features that should be present if loadOptional
     * is defined.  Note: modules are not often loaded this way in YUI 3,
     * but this field is still useful to inform the user that certain
     * features in the component will require additional dependencies.
     * use: features that are included within this module which need to
     * be attached automatically when this module is attached.  This
     * supports the YUI 3 rollup system -- a module with submodules
     * defined will need to have the submodules listed in the 'use'
     * config.  The YUI component build tool does this for you.
     * @return {YUI} the YUI instance.
     *
     */
    add: function(name, fn, version, details) {
        details = details || {};
        var env = YUI.Env,
            mod = {
                name: name,
                fn: fn,
                version: version,
                details: details
            },
            loader,
            i, versions = env.versions;

        env.mods[name] = mod;
        versions[version] = versions[version] || {};
        versions[version][name] = mod;

        for (i in instances) {
            if (instances.hasOwnProperty(i)) {
                loader = instances[i].Env._loader;
                if (loader) {
                    if (!loader.moduleInfo[name]) {
                        loader.addModule(details, name);
                    }
                }
            }
        }

        return this;
    },

    /**
     * Executes the function associated with each required
     * module, binding the module to the YUI instance.
     * @method _attach
     * @private
     */
    _attach: function(r, fromLoader) {
        var i, name, mod, details, req, use, after,
            mods = YUI.Env.mods,
            Y = this, j,
            done = Y.Env._attached,
            len = r.length, loader;


        for (i = 0; i < len; i++) {
            if (!done[r[i]]) {
                name = r[i];
                mod = mods[name];
                if (!mod) {
                    loader = Y.Env._loader;


                    if (!loader || !loader.moduleInfo[name]) {
                        Y.message('NOT loaded: ' + name, 'warn', 'yui');
                    }
                } else {
                    done[name] = true;
                    details = mod.details;
                    req = details.requires;
                    use = details.use;
                    after = details.after;

                    if (req) {
                        for (j = 0; j < req.length; j++) {
                            if (!done[req[j]]) {
                                if (!Y._attach(req)) {
                                    return false;
                                }
                                break;
                            }
                        }
                    }

                    if (after) {
                        for (j = 0; j < after.length; j++) {
                            if (!done[after[j]]) {
                                if (!Y._attach(after)) {
                                    return false;
                                }
                                break;
                            }
                        }
                    }

                    if (use) {
                        for (j = 0; j < use.length; j++) {
                            if (!done[use[j]]) {
                                if (!Y._attach(use)) {
                                    return false;
                                }
                                break;
                            }
                        }
                    }

                    if (mod.fn) {
                        try {
                            mod.fn(Y, name);
                        } catch (e) {
                            Y.error('Attach error: ' + name, e, name);
                            return false;
                        }
                    }

                }
            }
        }

        return true;
    },

    /**
     * Attaches one or more modules to the YUI instance.  When this
     * is executed, the requirements are analyzed, and one of
     * several things can happen:
     *
     * - All requirements are available on the page --  The modules
     *   are attached to the instance.  If supplied, the use callback
     *   is executed synchronously.
     *
     * - Modules are missing, the Get utility is not available OR
     *   the 'bootstrap' config is false -- A warning is issued about
     *   the missing modules and all available modules are attached.
     *
     * - Modules are missing, the Loader is not available but the Get
     *   utility is and boostrap is not false -- The loader is bootstrapped
     *   before doing the following....
     *
     * - Modules are missing and the Loader is available -- The loader
     *   expands the dependency tree and fetches missing modules.  When
     *   the loader is finshed the callback supplied to use is executed
     *   asynchronously.
     *
     * @param modules* {string} 1-n modules to bind (uses arguments array).
     * @param *callback {function} callback function executed when
     * the instance has the required functionality.  If included, it
     * must be the last parameter.
     * <code>
     * // loads and attaches drag and drop and its dependencies
     * YUI().use('dd', function(Y) &#123;&#125);
     * // attaches all modules that are available on the page
     * YUI().use('*', function(Y) &#123;&#125);
     * // intrinsic YUI gallery support (since 3.1.0)
     * YUI().use('gallery-yql', function(Y) &#123;&#125);
     * // intrinsic YUI 2in3 support (since 3.1.0)
     * YUI().use('yui2-datatable', function(Y) &#123;&#125);.
     * </code>
     *
     * @return {YUI} the YUI instance.
     */
    use: function() {
        var args = SLICE.call(arguments, 0),
            callback = args[args.length - 1],
            Y = this,
            key;

        // The last argument supplied to use can be a load complete callback
        if (Y.Lang.isFunction(callback)) {
            args.pop();
        } else {
            callback = null;
        }

        if (Y._loading) {
            Y._useQueue = Y._useQueue || new Y.Queue();
            Y._useQueue.add([args, callback]);
        } else {
            key = args.join();

            if (Y.config.cacheUse && Y.Env.serviced[key]) {
                Y._notify(callback, ALREADY_DONE, args);
            } else {
                Y._use(args, function(Y, response) {
                    if (Y.config.cacheUse) {
                        Y.Env.serviced[key] = true;
                    }
                    Y._notify(callback, response, args);
                });
            }
        }

        return Y;
    },

    _notify: function(callback, response, args) {
        if (!response.success && this.config.loadErrorFn) {
            this.config.loadErrorFn.call(this, this, callback, response, args);
        } else if (callback) {
            try {
                callback(this, response);
            } catch (e) {
                this.error('use callback error', e, args);
            }
        }
    },

    _use: function(args, callback) {

        if (!this.Array) {
            this._attach(['yui-base']);
        }

        var len, loader, handleBoot,
            Y = this,
            G_ENV = YUI.Env,
            mods = G_ENV.mods,
            Env = Y.Env,
            used = Env._used,
            queue = G_ENV._loaderQueue,
            firstArg = args[0],
            YArray = Y.Array,
            config = Y.config,
            boot = config.bootstrap,
            missing = [],
            r = [],
            ret = true,
            fetchCSS = config.fetchCSS,
            process = function(names, skip) {

                if (!names.length) {
                    return;
                }

                YArray.each(names, function(name) {

                    // add this module to full list of things to attach
                    if (!skip) {
                        r.push(name);
                    }

                    // only attach a module once
                    if (used[name]) {
                        return;
                    }

                    var m = mods[name], req, use;

                    if (m) {
                        used[name] = true;
                        req = m.details.requires;
                        use = m.details.use;
                    } else {
                        // CSS files don't register themselves, see if it has
                        // been loaded
                        if (!G_ENV._loaded[VERSION][name]) {
                            missing.push(name);
                        } else {
                            used[name] = true; // probably css
                        }
                    }

                    // make sure requirements are attached
                    if (req && req.length) {
                        process(req);
                    }

                    // make sure we grab the submodule dependencies too
                    if (use && use.length) {
                        process(use, 1);
                    }
                });
            },

            handleLoader = function(fromLoader) {
                var response = fromLoader || {
                        success: true,
                        msg: 'not dynamic'
                    },
                    redo, origMissing,
                    ret = true,
                    data = response.data;


                Y._loading = false;

                if (data) {
                    origMissing = missing;
                    missing = [];
                    r = [];
                    process(data);
                    redo = missing.length;
                    if (redo) {
                        if (missing.sort().join() ==
                                origMissing.sort().join()) {
                            redo = false;
                        }
                    }
                }

                if (redo && data) {
                    Y._loading = false;
                    Y._use(args, function() {
                        if (Y._attach(data)) {
                            Y._notify(callback, response, data);
                        }
                    });
                } else {
                    if (data) {
                        ret = Y._attach(data);
                    }
                    if (ret) {
                        Y._notify(callback, response, args);
                    }
                }

                if (Y._useQueue && Y._useQueue.size() && !Y._loading) {
                    Y._use.apply(Y, Y._useQueue.next());
                }

            };


        // YUI().use('*'); // bind everything available
        if (firstArg === '*') {
            ret = Y._attach(Y.Object.keys(mods));
            if (ret) {
                handleLoader();
            }
            return Y;
        }


        // use loader to expand dependencies and sort the
        // requirements if it is available.
        if (boot && Y.Loader && args.length) {
            loader = getLoader(Y);
            loader.require(args);
            loader.ignoreRegistered = true;
            loader.calculate(null, (fetchCSS) ? null : 'js');
            args = loader.sorted;
        }

        // process each requirement and any additional requirements
        // the module metadata specifies
        process(args);

        len = missing.length;

        if (len) {
            missing = Y.Object.keys(YArray.hash(missing));
            len = missing.length;
        }

        // dynamic load
        if (boot && len && Y.Loader) {
            Y._loading = true;
            loader = getLoader(Y);
            loader.onEnd = handleLoader;
            loader.context = Y;
            loader.data = args;
            loader.ignoreRegistered = false;
            loader.require(args);
            loader.insert(null, (fetchCSS) ? null : 'js');
            // loader.partial(missing, (fetchCSS) ? null : 'js');

        } else if (len && Y.config.use_rls) {

            // server side loader service
            Y.Get.script(Y._rls(args), {
                onEnd: function(o) {
                    handleLoader(o);
                },
                data: args
            });

        } else if (boot && len && Y.Get && !Env.bootstrapped) {

            Y._loading = true;

            handleBoot = function() {
                Y._loading = false;
                queue.running = false;
                Env.bootstrapped = true;
                if (Y._attach(['loader'])) {
                    Y._use(args, callback);
                }
            };

            if (G_ENV._bootstrapping) {
                queue.add(handleBoot);
            } else {
                G_ENV._bootstrapping = true;
                Y.Get.script(config.base + config.loaderPath, {
                    onEnd: handleBoot
                });
            }

        } else {
            ret = Y._attach(args);
            if (ret) {
                handleLoader();
            }
        }

        return Y;
    },


    /**
     * Returns the namespace specified and creates it if it doesn't exist
     * <pre>
     * YUI.namespace("property.package");
     * YUI.namespace("YAHOO.property.package");
     * </pre>
     * Either of the above would create YUI.property, then
     * YUI.property.package (YAHOO is scrubbed out, this is
     * to remain compatible with YUI2)
     *
     * Be careful when naming packages. Reserved words may work in some browsers
     * and not others. For instance, the following will fail in Safari:
     * <pre>
     * YUI.namespace("really.long.nested.namespace");
     * </pre>
     * This fails because "long" is a future reserved word in ECMAScript
     *
     * @method namespace
     * @param  {string*} arguments 1-n namespaces to create.
     * @return {object}  A reference to the last namespace object created.
     */
    namespace: function() {
        var a = arguments, o = this, i = 0, j, d, arg;
        for (; i < a.length; i++) {
            // d = ('' + a[i]).split('.');
            arg = a[i];
            if (arg.indexOf(PERIOD)) {
                d = arg.split(PERIOD);
                for (j = (d[0] == 'YAHOO') ? 1 : 0; j < d.length; j++) {
                    o[d[j]] = o[d[j]] || {};
                    o = o[d[j]];
                }
            } else {
                o[arg] = o[arg] || {};
            }
        }
        return o;
    },

    // this is replaced if the log module is included
    log: NOOP,
    message: NOOP,

    /**
     * Report an error.  The reporting mechanism is controled by
     * the 'throwFail' configuration attribute.  If throwFail is
     * not specified, the message is written to the Logger, otherwise
     * a JS error is thrown
     * @method error
     * @param msg {string} the error message.
     * @param e {Error|string} Optional JS error that was caught, or an error string.
     * @param data Optional additional info
     * and throwFail is specified, this error will be re-thrown.
     * @return {YUI} this YUI instance.
     */
    error: function(msg, e, data) {

        var Y = this, ret;

        if (Y.config.errorFn) {
            ret = Y.config.errorFn.apply(Y, arguments);
        }

        if (Y.config.throwFail && !ret) {
            throw (e || new Error(msg));
        } else {
            Y.message(msg, 'error'); // don't scrub this one
        }

        return Y;
    },

    /**
     * Generate an id that is unique among all YUI instances
     * @method guid
     * @param pre {string} optional guid prefix.
     * @return {string} the guid.
     */
    guid: function(pre) {
        var id = this.Env._guidp + (++this.Env._uidx);
        return (pre) ? (pre + id) : id;
    },

    /**
     * Returns a guid associated with an object.  If the object
     * does not have one, a new one is created unless readOnly
     * is specified.
     * @method stamp
     * @param o The object to stamp.
     * @param readOnly {boolean} if true, a valid guid will only
     * be returned if the object has one assigned to it.
     * @return {string} The object's guid or null.
     */
    stamp: function(o, readOnly) {
        var uid;
        if (!o) {
            return o;
        }

        // IE generates its own unique ID for dom nodes
        // The uniqueID property of a document node returns a new ID
        if (o.uniqueID && o.nodeType && o.nodeType !== 9) {
            uid = o.uniqueID;
        } else {
            uid = (typeof o === 'string') ? o : o._yuid;
        }

        if (!uid) {
            uid = this.guid();
            if (!readOnly) {
                try {
                    o._yuid = uid;
                } catch (e) {
                    uid = null;
                }
            }
        }
        return uid;
    },

    /**
     * Destroys the YUI instance
     * @method destroy
     * @since 3.3.0
     */
    destroy: function() {
        var Y = this;
        if (Y.Event) {
            Y.Event._unload();
        }
        delete instances[Y.id];
        delete Y.Env;
        delete Y.config;
    }

    /**
     * instanceof check for objects that works around
     * memory leak in IE when the item tested is
     * window/document
     * @method instanceOf
     * @since 3.3.0
     */
};



    YUI.prototype = proto;

    // inheritance utilities are not available yet
    for (prop in proto) {
        if (proto.hasOwnProperty(prop)) {
            YUI[prop] = proto[prop];
        }
    }

    // set up the environment
    YUI._init();

    if (hasWin) {
        // add a window load event at load time so we can capture
        // the case where it fires before dynamic loading is
        // complete.
        add(window, 'load', handleLoad);
    } else {
        handleLoad();
    }

    YUI.Env.add = add;
    YUI.Env.remove = remove;

    /*global exports*/
    // Support the CommonJS method for exporting our single global
    if (typeof exports == 'object') {
        exports.YUI = YUI;
    }

}());


/**
 * The config object contains all of the configuration options for
 * the YUI instance.  This object is supplied by the implementer
 * when instantiating a YUI instance.  Some properties have default
 * values if they are not supplied by the implementer.  This should
 * not be updated directly because some values are cached.  Use
 * applyConfig() to update the config object on a YUI instance that
 * has already been configured.
 *
 * @class config
 * @static
 */

/**
 * Allows the YUI seed file to fetch the loader component and library
 * metadata to dynamically load additional dependencies.
 *
 * @property bootstrap
 * @type boolean
 * @default true
 */

/**
 * Log to the browser console if debug is on and the browser has a
 * supported console.
 *
 * @property useBrowserConsole
 * @type boolean
 * @default true
 */

/**
 * A hash of log sources that should be logged.  If specified, only
 * log messages from these sources will be logged.
 *
 * @property logInclude
 * @type object
 */

/**
 * A hash of log sources that should be not be logged.  If specified,
 * all sources are logged if not on this list.
 *
 * @property logExclude
 * @type object
 */

/**
 * Set to true if the yui seed file was dynamically loaded in
 * order to bootstrap components relying on the window load event
 * and the 'domready' custom event.
 *
 * @property injected
 * @type boolean
 * @default false
 */

/**
 * If throwFail is set, Y.error will generate or re-throw a JS Error.
 * Otherwise the failure is logged.
 *
 * @property throwFail
 * @type boolean
 * @default true
 */

/**
 * The window/frame that this instance should operate in.
 *
 * @property win
 * @type Window
 * @default the window hosting YUI
 */

/**
 * The document associated with the 'win' configuration.
 *
 * @property doc
 * @type Document
 * @default the document hosting YUI
 */

/**
 * A list of modules that defines the YUI core (overrides the default).
 *
 * @property core
 * @type string[]
 */

/**
 * A list of languages in order of preference. This list is matched against
 * the list of available languages in modules that the YUI instance uses to
 * determine the best possible localization of language sensitive modules.
 * Languages are represented using BCP 47 language tags, such as "en-GB" for
 * English as used in the United Kingdom, or "zh-Hans-CN" for simplified
 * Chinese as used in China. The list can be provided as a comma-separated
 * list or as an array.
 *
 * @property lang
 * @type string|string[]
 */

/**
 * The default date format
 * @property dateFormat
 * @type string
 * @deprecated use configuration in DataType.Date.format() instead.
 */

/**
 * The default locale
 * @property locale
 * @type string
 * @deprecated use config.lang instead.
 */

/**
 * The default interval when polling in milliseconds.
 * @property pollInterval
 * @type int
 * @default 20
 */

/**
 * The number of dynamic nodes to insert by default before
 * automatically removing them.  This applies to script nodes
 * because remove the node will not make the evaluated script
 * unavailable.  Dynamic CSS is not auto purged, because removing
 * a linked style sheet will also remove the style definitions.
 * @property purgethreshold
 * @type int
 * @default 20
 */

/**
 * The default interval when polling in milliseconds.
 * @property windowResizeDelay
 * @type int
 * @default 40
 */

/**
 * Base directory for dynamic loading
 * @property base
 * @type string
 */

/*
 * The secure base dir (not implemented)
 * For dynamic loading.
 * @property secureBase
 * @type string
 */

/**
 * The YUI combo service base dir. Ex: http://yui.yahooapis.com/combo?
 * For dynamic loading.
 * @property comboBase
 * @type string
 */

/**
 * The root path to prepend to module path for the combo service.
 * Ex: 3.0.0b1/build/
 * For dynamic loading.
 * @property root
 * @type string
 */

/**
 * A filter to apply to result urls.  This filter will modify the default
 * path for all modules.  The default path for the YUI library is the
 * minified version of the files (e.g., event-min.js).  The filter property
 * can be a predefined filter or a custom filter.  The valid predefined
 * filters are:
 * <dl>
 *  <dt>DEBUG</dt>
 *  <dd>Selects the debug versions of the library (e.g., event-debug.js).
 *      This option will automatically include the Logger widget</dd>
 *  <dt>RAW</dt>
 *  <dd>Selects the non-minified version of the library (e.g., event.js).</dd>
 * </dl>
 * You can also define a custom filter, which must be an object literal
 * containing a search expression and a replace string:
 * <pre>
 *  myFilter: &#123;
 *      'searchExp': "-min\\.js",
 *      'replaceStr': "-debug.js"
 *  &#125;
 * </pre>
 *
 * For dynamic loading.
 *
 * @property filter
 * @type string|object
 */

/**
 * The 'skin' config let's you configure application level skin
 * customizations.  It contains the following attributes which
 * can be specified to override the defaults:
 *
 *      // The default skin, which is automatically applied if not
 *      // overriden by a component-specific skin definition.
 *      // Change this in to apply a different skin globally
 *      defaultSkin: 'sam',
 *
 *      // This is combined with the loader base property to get
 *      // the default root directory for a skin.
 *      base: 'assets/skins/',
 *
 *      // Any component-specific overrides can be specified here,
 *      // making it possible to load different skins for different
 *      // components.  It is possible to load more than one skin
 *      // for a given component as well.
 *      overrides: {
 *          slider: ['capsule', 'round']
 *      }
 *
 * For dynamic loading.
 *
 *  @property skin
 */

/**
 * Hash of per-component filter specification.  If specified for a given
 * component, this overrides the filter config.
 *
 * For dynamic loading.
 *
 * @property filters
 */

/**
 * Use the YUI combo service to reduce the number of http connections
 * required to load your dependencies.  Turning this off will
 * disable combo handling for YUI and all module groups configured
 * with a combo service.
 *
 * For dynamic loading.
 *
 * @property combine
 * @type boolean
 * @default true if 'base' is not supplied, false if it is.
 */

/**
 * A list of modules that should never be dynamically loaded
 *
 * @property ignore
 * @type string[]
 */

/**
 * A list of modules that should always be loaded when required, even if already
 * present on the page.
 *
 * @property force
 * @type string[]
 */

/**
 * Node or id for a node that should be used as the insertion point for new
 * nodes.  For dynamic loading.
 *
 * @property insertBefore
 * @type string
 */

/**
 * Object literal containing attributes to add to dynamically loaded script
 * nodes.
 * @property jsAttributes
 * @type string
 */

/**
 * Object literal containing attributes to add to dynamically loaded link
 * nodes.
 * @property cssAttributes
 * @type string
 */

/**
 * Number of milliseconds before a timeout occurs when dynamically
 * loading nodes. If not set, there is no timeout.
 * @property timeout
 * @type int
 */

/**
 * Callback for the 'CSSComplete' event.  When dynamically loading YUI
 * components with CSS, this property fires when the CSS is finished
 * loading but script loading is still ongoing.  This provides an
 * opportunity to enhance the presentation of a loading page a little
 * bit before the entire loading process is done.
 *
 * @property onCSS
 * @type function
 */

/**
 * A hash of module definitions to add to the list of YUI components.
 * These components can then be dynamically loaded side by side with
 * YUI via the use() method. This is a hash, the key is the module
 * name, and the value is an object literal specifying the metdata
 * for the module.  * See Loader.addModule for the supported module
 * metadata fields.  Also @see groups, which provides a way to
 * configure the base and combo spec for a set of modules.
 * <code>
 * modules: {
 * &nbsp; mymod1: {
 * &nbsp;   requires: ['node'],
 * &nbsp;   fullpath: 'http://myserver.mydomain.com/mymod1/mymod1.js'
 * &nbsp; },
 * &nbsp; mymod2: {
 * &nbsp;   requires: ['mymod1'],
 * &nbsp;   fullpath: 'http://myserver.mydomain.com/mymod2/mymod2.js'
 * &nbsp; }
 * }
 * </code>
 *
 * @property modules
 * @type object
 */

/**
 * A hash of module group definitions.  It for each group you
 * can specify a list of modules and the base path and
 * combo spec to use when dynamically loading the modules.  @see
 * @see modules for the details about the modules part of the
 * group definition.
 * <code>
 * &nbsp; groups: {
 * &nbsp;     yui2: {
 * &nbsp;         // specify whether or not this group has a combo service
 * &nbsp;         combine: true,
 * &nbsp;
 * &nbsp;         // the base path for non-combo paths
 * &nbsp;         base: 'http://yui.yahooapis.com/2.8.0r4/build/',
 * &nbsp;
 * &nbsp;         // the path to the combo service
 * &nbsp;         comboBase: 'http://yui.yahooapis.com/combo?',
 * &nbsp;
 * &nbsp;         // a fragment to prepend to the path attribute when
 * &nbsp;         // when building combo urls
 * &nbsp;         root: '2.8.0r4/build/',
 * &nbsp;
 * &nbsp;         // the module definitions
 * &nbsp;         modules:  {
 * &nbsp;             yui2_yde: {
 * &nbsp;                 path: "yahoo-dom-event/yahoo-dom-event.js"
 * &nbsp;             },
 * &nbsp;             yui2_anim: {
 * &nbsp;                 path: "animation/animation.js",
 * &nbsp;                 requires: ['yui2_yde']
 * &nbsp;             }
 * &nbsp;         }
 * &nbsp;     }
 * &nbsp; }
 * </code>
 * @property modules
 * @type object
 */

/**
 * The loader 'path' attribute to the loader itself.  This is combined
 * with the 'base' attribute to dynamically load the loader component
 * when boostrapping with the get utility alone.
 *
 * @property loaderPath
 * @type string
 * @default loader/loader-min.js
 */

/**
 * Specifies whether or not YUI().use(...) will attempt to load CSS
 * resources at all.  Any truthy value will cause CSS dependencies
 * to load when fetching script.  The special value 'force' will
 * cause CSS dependencies to be loaded even if no script is needed.
 *
 * @property fetchCSS
 * @type boolean|string
 * @default true
 */

/**
 * The default gallery version to build gallery module urls
 * @property gallery
 * @type string
 * @since 3.1.0
 */

/**
 * The default YUI 2 version to build yui2 module urls.  This is for
 * intrinsic YUI 2 support via the 2in3 project.  Also @see the '2in3'
 * config for pulling different revisions of the wrapped YUI 2
 * modules.
 * @since 3.1.0
 * @property yui2
 * @type string
 * @default 2.8.1
 */

/**
 * The 2in3 project is a deployment of the various versions of YUI 2
 * deployed as first-class YUI 3 modules.  Eventually, the wrapper
 * for the modules will change (but the underlying YUI 2 code will
 * be the same), and you can select a particular version of
 * the wrapper modules via this config.
 * @since 3.1.0
 * @property 2in3
 * @type string
 * @default 1
 */

/**
 * Alternative console log function for use in environments without
 * a supported native console.  The function is executed in the
 * YUI instance context.
 * @since 3.1.0
 * @property logFn
 * @type Function
 */

/**
 * A callback to execute when Y.error is called.  It receives the
 * error message and an javascript error object if Y.error was
 * executed because a javascript error was caught.  The function
 * is executed in the YUI instance context.
 *
 * @since 3.2.0
 * @property errorFn
 * @type Function
 */

/**
 * A callback to execute when the loader fails to load one or
 * more resource.  This could be because of a script load
 * failure.  It can also fail if a javascript module fails
 * to register itself, but only when the 'requireRegistration'
 * is true.  If this function is defined, the use() callback will
 * only be called when the loader succeeds, otherwise it always
 * executes unless there was a javascript error when attaching
 * a module.
 *
 * @since 3.3.0
 * @property loadErrorFn
 * @type Function
 */

/**
 * When set to true, the YUI loader will expect that all modules
 * it is responsible for loading will be first-class YUI modules
 * that register themselves with the YUI global.  If this is
 * set to true, loader will fail if the module registration fails
 * to happen after the script is loaded.
 *
 * @since 3.3.0
 * @property requireRegistration
 * @type boolean
 * @default false
 */

/**
 * Cache serviced use() requests.
 * @since 3.3.0
 * @property cacheUse
 * @type boolean
 * @default true
 */

/**
 * The parameter defaults for the remote loader service.
 * Requires the rls submodule.  The properties that are
 * supported:
 * <pre>
 * m: comma separated list of module requirements.  This
 *    must be the param name even for custom implemetations.
 * v: the version of YUI to load.  Defaults to the version
 *    of YUI that is being used.
 * gv: the version of the gallery to load (@see the gallery config)
 * env: comma separated list of modules already on the page.
 *      this must be the param name even for custom implemetations.
 * lang: the languages supported on the page (@see the lang config)
 * '2in3v':  the version of the 2in3 wrapper to use (@see the 2in3 config).
 * '2v': the version of yui2 to use in the yui 2in3 wrappers
 *       (@see the yui2 config)
 * filt: a filter def to apply to the urls (@see the filter config).
 * filts: a list of custom filters to apply per module
 *        (@see the filters config).
 * tests: this is a map of conditional module test function id keys
 * with the values of 1 if the test passes, 0 if not.  This must be
 * the name of the querystring param in custom templates.
 *</pre>
 *
 * @since 3.2.0
 * @property rls
 */

/**
 * The base path to the remote loader service
 *
 * @since 3.2.0
 * @property rls_base
 */

/**
 * The template to use for building the querystring portion
 * of the remote loader service url.  The default is determined
 * by the rls config -- each property that has a value will be
 * represented.
 *
 * ex: m={m}&v={v}&env={env}&lang={lang}&filt={filt}&tests={tests}
 *
 *
 * @since 3.2.0
 * @property rls_tmpl
 */

/**
 * Configure the instance to use a remote loader service instead of
 * the client loader.
 *
 * @since 3.2.0
 * @property use_rls
 */
YUI.add('yui-base', function(Y) {

/*
 * YUI stub
 * @module yui
 * @submodule yui-base
 */
/**
 * The YUI module contains the components required for building the YUI
 * seed file.  This includes the script loading mechanism, a simple queue,
 * and the core utilities for the library.
 * @module yui
 * @submodule yui-base
 */

/**
 * Provides the language utilites and extensions used by the library
 * @class Lang
 * @static
 */
Y.Lang = Y.Lang || {};

var L = Y.Lang,

ARRAY = 'array',
BOOLEAN = 'boolean',
DATE = 'date',
ERROR = 'error',
FUNCTION = 'function',
NUMBER = 'number',
NULL = 'null',
OBJECT = 'object',
REGEX = 'regexp',
STRING = 'string',
STRING_PROTO = String.prototype,
TOSTRING = Object.prototype.toString,
UNDEFINED = 'undefined',

TYPES = {
    'undefined' : UNDEFINED,
    'number' : NUMBER,
    'boolean' : BOOLEAN,
    'string' : STRING,
    '[object Function]' : FUNCTION,
    '[object RegExp]' : REGEX,
    '[object Array]' : ARRAY,
    '[object Date]' : DATE,
    '[object Error]' : ERROR
},

TRIMREGEX = /^\s+|\s+$/g,
EMPTYSTRING = '',
SUBREGEX = /\{\s*([^\|\}]+?)\s*(?:\|([^\}]*))?\s*\}/g;

/**
 * Determines whether or not the provided item is an array.
 * Returns false for array-like collections such as the
 * function arguments collection or HTMLElement collection
 * will return false.  Use <code>Y.Array.test</code> if you
 * want to test for an array-like collection.
 * @method isArray
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is an array.
 */
// L.isArray = Array.isArray || function(o) {
//     return L.type(o) === ARRAY;
// };

L.isArray = function(o) {
    return L.type(o) === ARRAY;
};

/**
 * Determines whether or not the provided item is a boolean.
 * @method isBoolean
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is a boolean.
 */
L.isBoolean = function(o) {
    return typeof o === BOOLEAN;
};

/**
 * <p>
 * Determines whether or not the provided item is a function.
 * Note: Internet Explorer thinks certain functions are objects:
 * </p>
 *
 * <pre>
 * var obj = document.createElement("object");
 * Y.Lang.isFunction(obj.getAttribute) // reports false in IE
 * &nbsp;
 * var input = document.createElement("input"); // append to body
 * Y.Lang.isFunction(input.focus) // reports false in IE
 * </pre>
 *
 * <p>
 * You will have to implement additional tests if these functions
 * matter to you.
 * </p>
 *
 * @method isFunction
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is a function.
 */
L.isFunction = function(o) {
    return L.type(o) === FUNCTION;
};

/**
 * Determines whether or not the supplied item is a date instance.
 * @method isDate
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is a date.
 */
L.isDate = function(o) {
    // return o instanceof Date;
    return L.type(o) === DATE && o.toString() !== 'Invalid Date' && !isNaN(o);
};

/**
 * Determines whether or not the provided item is null.
 * @method isNull
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is null.
 */
L.isNull = function(o) {
    return o === null;
};

/**
 * Determines whether or not the provided item is a legal number.
 * @method isNumber
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is a number.
 */
L.isNumber = function(o) {
    return typeof o === NUMBER && isFinite(o);
};

/**
 * Determines whether or not the provided item is of type object
 * or function. Note that arrays are also objects, so
 * <code>Y.Lang.isObject([]) === true</code>.
 * @method isObject
 * @static
 * @param o The object to test.
 * @param failfn {boolean} fail if the input is a function.
 * @return {boolean} true if o is an object.
 */
L.isObject = function(o, failfn) {
    var t = typeof o;
    return (o && (t === OBJECT ||
        (!failfn && (t === FUNCTION || L.isFunction(o))))) || false;
};

/**
 * Determines whether or not the provided item is a string.
 * @method isString
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is a string.
 */
L.isString = function(o) {
    return typeof o === STRING;
};

/**
 * Determines whether or not the provided item is undefined.
 * @method isUndefined
 * @static
 * @param o The object to test.
 * @return {boolean} true if o is undefined.
 */
L.isUndefined = function(o) {
    return typeof o === UNDEFINED;
};

/**
 * Returns a string without any leading or trailing whitespace.  If
 * the input is not a string, the input will be returned untouched.
 * @method trim
 * @static
 * @param s {string} the string to trim.
 * @return {string} the trimmed string.
 */
L.trim = STRING_PROTO.trim ? function(s) {
    return (s && s.trim) ? s.trim() : s;
} : function (s) {
    try {
        return s.replace(TRIMREGEX, EMPTYSTRING);
    } catch (e) {
        return s;
    }
};

/**
 * Returns a string without any leading whitespace.
 * @method trimLeft
 * @static
 * @param s {string} the string to trim.
 * @return {string} the trimmed string.
 */
L.trimLeft = STRING_PROTO.trimLeft ? function (s) {
    return s.trimLeft();
} : function (s) {
    return s.replace(/^\s+/, '');
};

/**
 * Returns a string without any trailing whitespace.
 * @method trimRight
 * @static
 * @param s {string} the string to trim.
 * @return {string} the trimmed string.
 */
L.trimRight = STRING_PROTO.trimRight ? function (s) {
    return s.trimRight();
} : function (s) {
    return s.replace(/\s+$/, '');
};

/**
 * A convenience method for detecting a legitimate non-null value.
 * Returns false for null/undefined/NaN, true for other values,
 * including 0/false/''
 * @method isValue
 * @static
 * @param o The item to test.
 * @return {boolean} true if it is not null/undefined/NaN || false.
 */
L.isValue = function(o) {
    var t = L.type(o);
    switch (t) {
        case NUMBER:
            return isFinite(o);
        case NULL:
        case UNDEFINED:
            return false;
        default:
            return !!(t);
    }
};

/**
 * <p>
 * Returns a string representing the type of the item passed in.
 * </p>
 *
 * <p>
 * Known issues:
 * </p>
 *
 * <ul>
 *   <li>
 *     <code>typeof HTMLElementCollection</code> returns function in Safari, but
 *     <code>Y.type()</code> reports object, which could be a good thing --
 *     but it actually caused the logic in <code>Y.Lang.isObject</code> to fail.
 *   </li>
 * </ul>
 *
 * @method type
 * @param o the item to test.
 * @return {string} the detected type.
 * @static
 */
L.type = function(o) {
    return TYPES[typeof o] || TYPES[TOSTRING.call(o)] || (o ? OBJECT : NULL);
};

/**
 * Lightweight version of <code>Y.substitute</code>. Uses the same template
 * structure as <code>Y.substitute</code>, but doesn't support recursion,
 * auto-object coersion, or formats.
 * @method sub
 * @param {string} s String to be modified.
 * @param {object} o Object containing replacement values.
 * @return {string} the substitute result.
 * @static
 * @since 3.2.0
 */
L.sub = function(s, o) {
    return ((s.replace) ? s.replace(SUBREGEX, function(match, key) {
        return (!L.isUndefined(o[key])) ? o[key] : match;
    }) : s);
};

/**
 * Returns the current time in milliseconds.
 * @method now
 * @return {int} the current date
 * @since 3.3.0
 */
L.now = Date.now || function () {
  return new Date().getTime();
};

/**
 * The YUI module contains the components required for building the YUI seed
 * file.  This includes the script loading mechanism, a simple queue, and the
 * core utilities for the library.
 * @module yui
 * @submodule yui-base
 */


var Native = Array.prototype, LENGTH = 'length',

/**
 * Adds the following array utilities to the YUI instance.  Additional
 * array helpers can be found in the collection component.
 * @class Array
 */

/**
 * Y.Array(o) returns an array:
 * - Arrays are return unmodified unless the start position is specified.
 * - "Array-like" collections (@see Array.test) are converted to arrays
 * - For everything else, a new array is created with the input as the sole
 *   item.
 * - The start position is used if the input is or is like an array to return
 *   a subset of the collection.
 *
 *   @todo this will not automatically convert elements that are also
 *   collections such as forms and selects.  Passing true as the third
 *   param will force a conversion.
 *
 * @method ()
 * @static
 *   @param {object} o the item to arrayify.
 *   @param {int} startIdx if an array or array-like, this is the start index.
 *   @param {boolean} arraylike if true, it forces the array-like fork.  This
 *   can be used to avoid multiple Array.test calls.
 *   @return {Array} the resulting array.
 */
YArray = function(o, startIdx, arraylike) {
    var t = (arraylike) ? 2 : YArray.test(o),
        l, a, start = startIdx || 0;

    if (t) {
        // IE errors when trying to slice HTMLElement collections
        try {
            return Native.slice.call(o, start);
        } catch (e) {
            a = [];
            l = o.length;
            for (; start < l; start++) {
                a.push(o[start]);
            }
            return a;
        }
    } else {
        return [o];
    }
};

Y.Array = YArray;

/**
 * Evaluates the input to determine if it is an array, array-like, or
 * something else.  This is used to handle the arguments collection
 * available within functions, and HTMLElement collections
 *
 * @method test
 * @static
 *
 * @todo current implementation (intenionally) will not implicitly
 * handle html elements that are array-like (forms, selects, etc).
 *
 * @param {object} o the object to test.
 *
 * @return {int} a number indicating the results:
 * 0: Not an array or an array-like collection
 * 1: A real array.
 * 2: array-like collection.
 */
YArray.test = function(o) {
    var r = 0;
    if (Y.Lang.isObject(o)) {
        if (Y.Lang.isArray(o)) {
            r = 1;
        } else {
            try {
                // indexed, but no tagName (element) or alert (window),
                // or functions without apply/call (Safari
                // HTMLElementCollection bug).
                if ((LENGTH in o) && !o.tagName && !o.alert && !o.apply) {
                    r = 2;
                }

            } catch (e) {}
        }
    }
    return r;
};

/**
 * Executes the supplied function on each item in the array.
 * @method each
 * @param {Array} a the array to iterate.
 * @param {Function} f the function to execute on each item.  The
 * function receives three arguments: the value, the index, the full array.
 * @param {object} o Optional context object.
 * @static
 * @return {YUI} the YUI instance.
 */
YArray.each = (Native.forEach) ?
    function(a, f, o) {
        Native.forEach.call(a || [], f, o || Y);
        return Y;
    } :
    function(a, f, o) {
        var l = (a && a.length) || 0, i;
        for (i = 0; i < l; i = i + 1) {
            f.call(o || Y, a[i], i, a);
        }
        return Y;
    };

/**
 * Returns an object using the first array as keys, and
 * the second as values.  If the second array is not
 * provided the value is set to true for each.
 * @method hash
 * @static
 * @param {Array} k keyset.
 * @param {Array} v optional valueset.
 * @return {object} the hash.
 */
YArray.hash = function(k, v) {
    var o = {}, l = k.length, vl = v && v.length, i;
    for (i = 0; i < l; i = i + 1) {
        o[k[i]] = (vl && vl > i) ? v[i] : true;
    }

    return o;
};

/**
 * Returns the index of the first item in the array
 * that contains the specified value, -1 if the
 * value isn't found.
 * @method indexOf
 * @static
 * @param {Array} a the array to search.
 * @param {any} val the value to search for.
 * @return {int} the index of the item that contains the value or -1.
 */
YArray.indexOf = (Native.indexOf) ?
    function(a, val) {
        return Native.indexOf.call(a, val);
    } :
    function(a, val) {
        for (var i = 0; i < a.length; i = i + 1) {
            if (a[i] === val) {
                return i;
            }
        }

        return -1;
    };

/**
 * Numeric sort convenience function.
 * Y.ArrayAssert.itemsAreEqual([1,2,3], [3,1,2].sort(Y.Array.numericSort));
 * @method numericSort
 * @static
 * @param {number} a a number.
 * @param {number} b a number.
 */
YArray.numericSort = function(a, b) {
    return (a - b);
};

/**
 * Executes the supplied function on each item in the array.
 * Returning true from the processing function will stop the
 * processing of the remaining items.
 * @method some
 * @param {Array} a the array to iterate.
 * @param {Function} f the function to execute on each item. The function
 * receives three arguments: the value, the index, the full array.
 * @param {object} o Optional context object.
 * @static
 * @return {boolean} true if the function returns true on
 * any of the items in the array.
 */
YArray.some = (Native.some) ?
    function(a, f, o) {
        return Native.some.call(a, f, o);
    } :
    function(a, f, o) {
        var l = a.length, i;
        for (i = 0; i < l; i = i + 1) {
            if (f.call(o, a[i], i, a)) {
                return true;
            }
        }
        return false;
    };

/**
 * The YUI module contains the components required for building the YUI
 * seed file.  This includes the script loading mechanism, a simple queue,
 * and the core utilities for the library.
 * @module yui
 * @submodule yui-base
 */

/**
 * A simple FIFO queue.  Items are added to the Queue with add(1..n items) and
 * removed using next().
 *
 * @class Queue
 * @constructor
 * @param {MIXED} item* 0..n items to seed the queue.
 */
function Queue() {
    this._init();
    this.add.apply(this, arguments);
}

Queue.prototype = {
    /**
     * Initialize the queue
     *
     * @method _init
     * @protected
     */
    _init: function() {
        /**
         * The collection of enqueued items
         *
         * @property _q
         * @type Array
         * @protected
         */
        this._q = [];
    },

    /**
     * Get the next item in the queue. FIFO support
     *
     * @method next
     * @return {MIXED} the next item in the queue.
     */
    next: function() {
        return this._q.shift();
    },

    /**
     * Get the last in the queue. LIFO support.
     *
     * @method last
     * @return {MIXED} the last item in the queue.
     */
    last: function() {
        return this._q.pop();
    },

    /**
     * Add 0..n items to the end of the queue.
     *
     * @method add
     * @param {MIXED} item* 0..n items.
     * @return {object} this queue.
     */
    add: function() {
        this._q.push.apply(this._q, arguments);

        return this;
    },

    /**
     * Returns the current number of queued items.
     *
     * @method size
     * @return {Number} The size.
     */
    size: function() {
        return this._q.length;
    }
};

Y.Queue = Queue;

YUI.Env._loaderQueue = YUI.Env._loaderQueue || new Queue();

/**
 * The YUI module contains the components required for building the YUI
 * seed file.  This includes the script loading mechanism, a simple queue,
 * and the core utilities for the library.
 * @module yui
 * @submodule yui-base
 */

var CACHED_DELIMITER = '__',

/*
 * IE will not enumerate native functions in a derived object even if the
 * function was overridden.  This is a workaround for specific functions
 * we care about on the Object prototype.
 * @property _iefix
 * @for YUI
 * @param {Function} r  the object to receive the augmentation
 * @param {Function} s  the object that supplies the properties to augment
 * @private
 */
_iefix = function(r, s) {
    var fn = s.toString;
    if (Y.Lang.isFunction(fn) && fn != Object.prototype.toString) {
        r.toString = fn;
    }
};


/**
 * Returns a new object containing all of the properties of
 * all the supplied objects.  The properties from later objects
 * will overwrite those in earlier objects.  Passing in a
 * single object will create a shallow copy of it.  For a deep
 * copy, use clone.
 * @method merge
 * @for YUI
 * @param arguments {Object*} the objects to merge.
 * @return {object} the new merged object.
 */
Y.merge = function() {
    var a = arguments, o = {}, i, l = a.length;
    for (i = 0; i < l; i = i + 1) {
        Y.mix(o, a[i], true);
    }
    return o;
};

/**
 * Applies the supplier's properties to the receiver.  By default
 * all prototype and static propertes on the supplier are applied
 * to the corresponding spot on the receiver.  By default all
 * properties are applied, and a property that is already on the
 * reciever will not be overwritten.  The default behavior can
 * be modified by supplying the appropriate parameters.
 *
 * @todo add constants for the modes
 *
 * @method mix
 * @param {Function} r  the object to receive the augmentation.
 * @param {Function} s  the object that supplies the properties to augment.
 * @param ov {boolean} if true, properties already on the receiver
 * will be overwritten if found on the supplier.
 * @param wl {string[]} a whitelist.  If supplied, only properties in
 * this list will be applied to the receiver.
 * @param {int} mode what should be copies, and to where
 *        default(0): object to object
 *        1: prototype to prototype (old augment)
 *        2: prototype to prototype and object props (new augment)
 *        3: prototype to object
 *        4: object to prototype.
 * @param merge {boolean/int} merge objects instead of overwriting/ignoring.
 * A value of 2 will skip array merge
 * Used by Y.aggregate.
 * @return {object} the augmented object.
 */
Y.mix = function(r, s, ov, wl, mode, merge) {

    if (!s || !r) {
        return r || Y;
    }

    if (mode) {
        switch (mode) {
            case 1: // proto to proto
                return Y.mix(r.prototype, s.prototype, ov, wl, 0, merge);
            case 2: // object to object and proto to proto
                Y.mix(r.prototype, s.prototype, ov, wl, 0, merge);
                break; // pass through
            case 3: // proto to static
                return Y.mix(r, s.prototype, ov, wl, 0, merge);
            case 4: // static to proto
                return Y.mix(r.prototype, s, ov, wl, 0, merge);
            default:  // object to object is what happens below
        }
    }

    // Maybe don't even need this wl && wl.length check anymore??
    var i, l, p, type;

    if (wl && wl.length) {
        for (i = 0, l = wl.length; i < l; ++i) {
            p = wl[i];
            type = Y.Lang.type(r[p]);
            if (s.hasOwnProperty(p)) {
                if (merge && type == 'object') {
                    Y.mix(r[p], s[p]);
                } else if (ov || !(p in r)) {
                    r[p] = s[p];
                }
            }
        }
    } else {
        for (i in s) {
            // if (s.hasOwnProperty(i) && !(i in FROZEN)) {
            if (s.hasOwnProperty(i)) {
                // check white list if it was supplied
                // if the receiver has this property, it is an object,
                // and merge is specified, merge the two objects.
                if (merge && Y.Lang.isObject(r[i], true)) {
                    Y.mix(r[i], s[i], ov, wl, 0, true); // recursive
                // otherwise apply the property only if overwrite
                // is specified or the receiver doesn't have one.
                } else if (ov || !(i in r)) {
                    r[i] = s[i];
                }
                // if merge is specified and the receiver is an array,
                // append the array item
                // } else if (arr) {
                    // r.push(s[i]);
                // }
            }
        }

        if (Y.UA.ie) {
            _iefix(r, s);
        }
    }

    return r;
};

/**
 * Returns a wrapper for a function which caches the
 * return value of that function, keyed off of the combined
 * argument values.
 * @method cached
 * @param source {function} the function to memoize.
 * @param cache an optional cache seed.
 * @param refetch if supplied, this value is tested against the cached
 * value.  If the values are equal, the wrapped function is executed again.
 * @return {Function} the wrapped function.
 */
Y.cached = function(source, cache, refetch) {
    cache = cache || {};

    return function(arg1) {

        var k = (arguments.length > 1) ?
            Array.prototype.join.call(arguments, CACHED_DELIMITER) : arg1;

        if (!(k in cache) || (refetch && cache[k] == refetch)) {
            cache[k] = source.apply(source, arguments);
        }

        return cache[k];
    };

};

/**
 * The YUI module contains the components required for building the YUI
 * seed file.  This includes the script loading mechanism, a simple queue,
 * and the core utilities for the library.
 * @module yui
 * @submodule yui-base
 */

/**
 * Adds the following Object utilities to the YUI instance
 * @class Object
 */

/**
 * Y.Object(o) returns a new object based upon the supplied object.
 * @method ()
 * @static
 * @param o the supplier object.
 * @return {Object} the new object.
 */
var F = function() {},

// O = Object.create || function(o) {
//     F.prototype = o;
//     return new F();
// },

O = function(o) {
    F.prototype = o;
    return new F();
},

owns = function(o, k) {
    return o && o.hasOwnProperty && o.hasOwnProperty(k);
    // return Object.prototype.hasOwnProperty.call(o, k);
},

UNDEF,

/**
 * Extracts the keys, values, or size from an object
 *
 * @method _extract
 * @param o the object.
 * @param what what to extract (0: keys, 1: values, 2: size).
 * @return {boolean|Array} the extracted info.
 * @static
 * @private
 */
_extract = function(o, what) {
    var count = (what === 2), out = (count) ? 0 : [], i;

    for (i in o) {
        if (owns(o, i)) {
            if (count) {
                out++;
            } else {
                out.push((what) ? o[i] : i);
            }
        }
    }

    return out;
};

Y.Object = O;

/**
 * Returns an array containing the object's keys
 * @method keys
 * @static
 * @param o an object.
 * @return {string[]} the keys.
 */
// O.keys = Object.keys || function(o) {
//     return _extract(o);
// };

O.keys = function(o) {
    return _extract(o);
};

/**
 * Returns an array containing the object's values
 * @method values
 * @static
 * @param o an object.
 * @return {Array} the values.
 */
// O.values = Object.values || function(o) {
//     return _extract(o, 1);
// };

O.values = function(o) {
    return _extract(o, 1);
};

/**
 * Returns the size of an object
 * @method size
 * @static
 * @param o an object.
 * @return {int} the size.
 */
O.size = Object.size || function(o) {
    return _extract(o, 2);
};

/**
 * Returns true if the object contains a given key
 * @method hasKey
 * @static
 * @param o an object.
 * @param k the key to query.
 * @return {boolean} true if the object contains the key.
 */
O.hasKey = owns;
/**
 * Returns true if the object contains a given value
 * @method hasValue
 * @static
 * @param o an object.
 * @param v the value to query.
 * @return {boolean} true if the object contains the value.
 */
O.hasValue = function(o, v) {
    return (Y.Array.indexOf(O.values(o), v) > -1);
};

/**
 * Determines whether or not the property was added
 * to the object instance.  Returns false if the property is not present
 * in the object, or was inherited from the prototype.
 *
 * @method owns
 * @static
 * @param o {any} The object being testing.
 * @param p {string} the property to look for.
 * @return {boolean} true if the object has the property on the instance.
 */
O.owns = owns;

/**
 * Executes a function on each item. The function
 * receives the value, the key, and the object
 * as parameters (in that order).
 * @method each
 * @static
 * @param o the object to iterate.
 * @param f {Function} the function to execute on each item. The function
 * receives three arguments: the value, the the key, the full object.
 * @param c the execution context.
 * @param proto {boolean} include proto.
 * @return {YUI} the YUI instance.
 */
O.each = function(o, f, c, proto) {
    var s = c || Y, i;

    for (i in o) {
        if (proto || owns(o, i)) {
            f.call(s, o[i], i, o);
        }
    }
    return Y;
};

/**
 * Executes a function on each item, but halts if the
 * function returns true.  The function
 * receives the value, the key, and the object
 * as paramters (in that order).
 * @method some
 * @static
 * @param o the object to iterate.
 * @param f {Function} the function to execute on each item. The function
 * receives three arguments: the value, the the key, the full object.
 * @param c the execution context.
 * @param proto {boolean} include proto.
 * @return {boolean} true if any execution of the function returns true,
 * false otherwise.
 */
O.some = function(o, f, c, proto) {
    var s = c || Y, i;

    for (i in o) {
        if (proto || owns(o, i)) {
            if (f.call(s, o[i], i, o)) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Retrieves the sub value at the provided path,
 * from the value object provided.
 *
 * @method getValue
 * @static
 * @param o The object from which to extract the property value.
 * @param path {Array} A path array, specifying the object traversal path
 * from which to obtain the sub value.
 * @return {Any} The value stored in the path, undefined if not found,
 * undefined if the source is not an object.  Returns the source object
 * if an empty path is provided.
 */
O.getValue = function(o, path) {
    if (!Y.Lang.isObject(o)) {
        return UNDEF;
    }

    var i,
        p = Y.Array(path),
        l = p.length;

    for (i = 0; o !== UNDEF && i < l; i++) {
        o = o[p[i]];
    }

    return o;
};

/**
 * Sets the sub-attribute value at the provided path on the
 * value object.  Returns the modified value object, or
 * undefined if the path is invalid.
 *
 * @method setValue
 * @static
 * @param o             The object on which to set the sub value.
 * @param path {Array}  A path array, specifying the object traversal path
 *                      at which to set the sub value.
 * @param val {Any}     The new value for the sub-attribute.
 * @return {Object}     The modified object, with the new sub value set, or
 *                      undefined, if the path was invalid.
 */
O.setValue = function(o, path, val) {
    var i,
        p = Y.Array(path),
        leafIdx = p.length - 1,
        ref = o;

    if (leafIdx >= 0) {
        for (i = 0; ref !== UNDEF && i < leafIdx; i++) {
            ref = ref[p[i]];
        }

        if (ref !== UNDEF) {
            ref[p[i]] = val;
        } else {
            return UNDEF;
        }
    }

    return o;
};

/**
 * Returns true if the object has no properties of its own
 * @method isEmpty
 * @static
 * @return {boolean} true if the object is empty.
 * @since 3.2.0
 */
O.isEmpty = function(o) {
    for (var i in o) {
        if (owns(o, i)) {
            return false;
        }
    }
    return true;
};
/**
 * The YUI module contains the components required for building the YUI seed
 * file.  This includes the script loading mechanism, a simple queue, and the
 * core utilities for the library.
 * @module yui
 * @submodule yui-base
 */

/**
 * YUI user agent detection.
 * Do not fork for a browser if it can be avoided.  Use feature detection when
 * you can.  Use the user agent as a last resort.  UA stores a version
 * number for the browser engine, 0 otherwise.  This value may or may not map
 * to the version number of the browser using the engine.  The value is
 * presented as a float so that it can easily be used for boolean evaluation
 * as well as for looking for a particular range of versions.  Because of this,
 * some of the granularity of the version info may be lost (e.g., Gecko 1.8.0.9
 * reports 1.8).
 * @class UA
 * @static
 */
/**
* Static method for parsing the UA string. Defaults to assigning it's value to Y.UA
* @static
* @method Env.parseUA
* @param {String} subUA Parse this UA string instead of navigator.userAgent
* @returns {Object} The Y.UA object
*/
YUI.Env.parseUA = function(subUA) {
    
    var numberify = function(s) {
            var c = 0;
            return parseFloat(s.replace(/\./g, function() {
                return (c++ == 1) ? '' : '.';
            }));
        },

        win = Y.config.win,

        nav = win && win.navigator,

        o = {

        /**
         * Internet Explorer version number or 0.  Example: 6
         * @property ie
         * @type float
         * @static
         */
        ie: 0,

        /**
         * Opera version number or 0.  Example: 9.2
         * @property opera
         * @type float
         * @static
         */
        opera: 0,

        /**
         * Gecko engine revision number.  Will evaluate to 1 if Gecko
         * is detected but the revision could not be found. Other browsers
         * will be 0.  Example: 1.8
         * <pre>
         * Firefox 1.0.0.4: 1.7.8   <-- Reports 1.7
         * Firefox 1.5.0.9: 1.8.0.9 <-- 1.8
         * Firefox 2.0.0.3: 1.8.1.3 <-- 1.81
         * Firefox 3.0   <-- 1.9
         * Firefox 3.5   <-- 1.91
         * </pre>
         * @property gecko
         * @type float
         * @static
         */
        gecko: 0,

        /**
         * AppleWebKit version.  KHTML browsers that are not WebKit browsers
         * will evaluate to 1, other browsers 0.  Example: 418.9
         * <pre>
         * Safari 1.3.2 (312.6): 312.8.1 <-- Reports 312.8 -- currently the
         *                                   latest available for Mac OSX 10.3.
         * Safari 2.0.2:         416     <-- hasOwnProperty introduced
         * Safari 2.0.4:         418     <-- preventDefault fixed
         * Safari 2.0.4 (419.3): 418.9.1 <-- One version of Safari may run
         *                                   different versions of webkit
         * Safari 2.0.4 (419.3): 419     <-- Tiger installations that have been
         *                                   updated, but not updated
         *                                   to the latest patch.
         * Webkit 212 nightly:   522+    <-- Safari 3.0 precursor (with native
         * SVG and many major issues fixed).
         * Safari 3.0.4 (523.12) 523.12  <-- First Tiger release - automatic
         * update from 2.x via the 10.4.11 OS patch.
         * Webkit nightly 1/2008:525+    <-- Supports DOMContentLoaded event.
         *                                   yahoo.com user agent hack removed.
         * </pre>
         * http://en.wikipedia.org/wiki/Safari_version_history
         * @property webkit
         * @type float
         * @static
         */
        webkit: 0,

        /**
         * Chrome will be detected as webkit, but this property will also
         * be populated with the Chrome version number
         * @property chrome
         * @type float
         * @static
         */
        chrome: 0,

        /**
         * The mobile property will be set to a string containing any relevant
         * user agent information when a modern mobile browser is detected.
         * Currently limited to Safari on the iPhone/iPod Touch, Nokia N-series
         * devices with the WebKit-based browser, and Opera Mini.
         * @property mobile
         * @type string
         * @static
         */
        mobile: null,

        /**
         * Adobe AIR version number or 0.  Only populated if webkit is detected.
         * Example: 1.0
         * @property air
         * @type float
         */
        air: 0,
        /**
         * Detects Apple iPad's OS version
         * @property ipad
         * @type float
         * @static
         */
        ipad: 0,
        /**
         * Detects Apple iPhone's OS version
         * @property iphone
         * @type float
         * @static
         */
        iphone: 0,
        /**
         * Detects Apples iPod's OS version
         * @property ipod
         * @type float
         * @static
         */
        ipod: 0,
        /**
         * General truthy check for iPad, iPhone or iPod
         * @property ios
         * @type float
         * @static
         */
        ios: null,
        /**
         * Detects Googles Android OS version
         * @property android
         * @type float
         * @static
         */
        android: 0,
        /**
         * Detects Palms WebOS version
         * @property webos
         * @type float
         * @static
         */
        webos: 0,

        /**
         * Google Caja version number or 0.
         * @property caja
         * @type float
         */
        caja: nav && nav.cajaVersion,

        /**
         * Set to true if the page appears to be in SSL
         * @property secure
         * @type boolean
         * @static
         */
        secure: false,

        /**
         * The operating system.  Currently only detecting windows or macintosh
         * @property os
         * @type string
         * @static
         */
        os: null

    },

    ua = subUA || nav && nav.userAgent,

    loc = win && win.location,

    href = loc && loc.href,

    m;

    o.secure = href && (href.toLowerCase().indexOf('https') === 0);

    if (ua) {

        if ((/windows|win32/i).test(ua)) {
            o.os = 'windows';
        } else if ((/macintosh/i).test(ua)) {
            o.os = 'macintosh';
        } else if ((/rhino/i).test(ua)) {
            o.os = 'rhino';
        }

        // Modern KHTML browsers should qualify as Safari X-Grade
        if ((/KHTML/).test(ua)) {
            o.webkit = 1;
        }
        // Modern WebKit browsers are at least X-Grade
        m = ua.match(/AppleWebKit\/([^\s]*)/);
        if (m && m[1]) {
            o.webkit = numberify(m[1]);

            // Mobile browser check
            if (/ Mobile\//.test(ua)) {
                o.mobile = 'Apple'; // iPhone or iPod Touch

                m = ua.match(/OS ([^\s]*)/);
                if (m && m[1]) {
                    m = numberify(m[1].replace('_', '.'));
                }
                o.ios = m;
                o.ipad = o.ipod = o.iphone = 0;

                m = ua.match(/iPad|iPod|iPhone/);
                if (m && m[0]) {
                    o[m[0].toLowerCase()] = o.ios;
                }
            } else {
                m = ua.match(/NokiaN[^\/]*|Android \d\.\d|webOS\/\d\.\d/);
                if (m) {
                    // Nokia N-series, Android, webOS, ex: NokiaN95
                    o.mobile = m[0];
                }
                if (/webOS/.test(ua)) {
                    o.mobile = 'WebOS';
                    m = ua.match(/webOS\/([^\s]*);/);
                    if (m && m[1]) {
                        o.webos = numberify(m[1]);
                    }
                }
                if (/ Android/.test(ua)) {
                    o.mobile = 'Android';
                    m = ua.match(/Android ([^\s]*);/);
                    if (m && m[1]) {
                        o.android = numberify(m[1]);
                    }

                }
            }

            m = ua.match(/Chrome\/([^\s]*)/);
            if (m && m[1]) {
                o.chrome = numberify(m[1]); // Chrome
            } else {
                m = ua.match(/AdobeAIR\/([^\s]*)/);
                if (m) {
                    o.air = m[0]; // Adobe AIR 1.0 or better
                }
            }
        }

        if (!o.webkit) { // not webkit
// @todo check Opera/8.01 (J2ME/MIDP; Opera Mini/2.0.4509/1316; fi; U; ssr)
            m = ua.match(/Opera[\s\/]([^\s]*)/);
            if (m && m[1]) {
                o.opera = numberify(m[1]);
                m = ua.match(/Opera Mini[^;]*/);
                if (m) {
                    o.mobile = m[0]; // ex: Opera Mini/2.0.4509/1316
                }
            } else { // not opera or webkit
                m = ua.match(/MSIE\s([^;]*)/);
                if (m && m[1]) {
                    o.ie = numberify(m[1]);
                } else { // not opera, webkit, or ie
                    m = ua.match(/Gecko\/([^\s]*)/);
                    if (m) {
                        o.gecko = 1; // Gecko detected, look for revision
                        m = ua.match(/rv:([^\s\)]*)/);
                        if (m && m[1]) {
                            o.gecko = numberify(m[1]);
                        }
                    }
                }
            }
        }
    }

    YUI.Env.UA = o;

    return o;
};


Y.UA = YUI.Env.UA || YUI.Env.parseUA();


}, '3.3.0' );
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('features', function(Y) {

var feature_tests = {};

Y.mix(Y.namespace('Features'), {

    tests: feature_tests,

    add: function(cat, name, o) {
        feature_tests[cat] = feature_tests[cat] || {};
        feature_tests[cat][name] = o;
    },

    all: function(cat, args) {
        var cat_o = feature_tests[cat],
            // results = {};
            result = '';
        if (cat_o) {
            Y.Object.each(cat_o, function(v, k) {
                // results[k] = Y.Features.test(cat, k, args);
                result += k + ':' +
                       (Y.Features.test(cat, k, args) ? 1 : 0) + ';';
            });
        }

        return result;
    },

    test: function(cat, name, args) {
        args = args || [];
        var result, ua, test,
            cat_o = feature_tests[cat],
            feature = cat_o && cat_o[name];

        if (!feature) {
        } else {

            result = feature.result;

            if (Y.Lang.isUndefined(result)) {

                ua = feature.ua;
                if (ua) {
                    result = (Y.UA[ua]);
                }

                test = feature.test;
                if (test && ((!ua) || result)) {
                    result = test.apply(Y, args);
                }

                feature.result = result;
            }
        }

        return result;
    }
});

// Y.Features.add("load", "1", {});
// Y.Features.test("load", "1");
// caps=1:1;2:0;3:1;

/* This file is auto-generated by src/loader/meta_join.py */
var add = Y.Features.add;
// autocomplete-list-keys-sniff.js
add('load', '0', {
    "test": function (Y) {
    // Only add keyboard support to autocomplete-list if this doesn't appear to
    // be an iOS or Android-based mobile device.
    //
    // There's currently no feasible way to actually detect whether a device has
    // a hardware keyboard, so this sniff will have to do. It can easily be
    // overridden by manually loading the autocomplete-list-keys module.
    //
    // Worth noting: even though iOS supports bluetooth keyboards, Mobile Safari
    // doesn't fire the keyboard events used by AutoCompleteList, so there's
    // no point loading the -keys module even when a bluetooth keyboard may be
    // available.
    return !(Y.UA.ios || Y.UA.android);
}, 
    "trigger": "autocomplete-list"
});
// ie-style-test.js
add('load', '1', {
    "test": function (Y) {

    var testFeature = Y.Features.test,
        addFeature = Y.Features.add,
        WINDOW = Y.config.win,
        DOCUMENT = Y.config.doc,
        DOCUMENT_ELEMENT = 'documentElement',
        ret = false;

    addFeature('style', 'computedStyle', {
        test: function() {
            return WINDOW && 'getComputedStyle' in WINDOW;
        }
    });

    addFeature('style', 'opacity', {
        test: function() {
            return DOCUMENT && 'opacity' in DOCUMENT[DOCUMENT_ELEMENT].style;
        }
    });

    ret =  (!testFeature('style', 'opacity') &&
            !testFeature('style', 'computedStyle'));

    return ret;
}, 
    "trigger": "dom-style"
});
// 0
add('load', '2', {
    "trigger": "widget-base", 
    "ua": "ie"
});
// ie-base-test.js
add('load', '3', {
    "test": function(Y) {
    var imp = Y.config.doc && Y.config.doc.implementation;
    return (imp && (!imp.hasFeature('Events', '2.0')));
}, 
    "trigger": "node-base"
});
// dd-gestures-test.js
add('load', '4', {
    "test": function(Y) {
    return (Y.config.win && ('ontouchstart' in Y.config.win && !Y.UA.chrome));
}, 
    "trigger": "dd-drag"
});
// history-hash-ie-test.js
add('load', '5', {
    "test": function (Y) {
    var docMode = Y.config.doc.documentMode;

    return Y.UA.ie && (!('onhashchange' in Y.config.win) ||
            !docMode || docMode < 8);
}, 
    "trigger": "history-hash"
});


}, '3.3.0' ,{requires:['yui-base']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('get', function(Y) {


/**
 * Provides a mechanism to fetch remote resources and
 * insert them into a document.
 * @module yui
 * @submodule get
 */

var ua = Y.UA,
    L = Y.Lang,
    TYPE_JS = 'text/javascript',
    TYPE_CSS = 'text/css',
    STYLESHEET = 'stylesheet';

/**
 * Fetches and inserts one or more script or link nodes into the document
 * @class Get
 * @static
 */
Y.Get = function() {

    /**
     * hash of queues to manage multiple requests
     * @property queues
     * @private
     */
    var _get, _purge, _track,

    queues = {},

    /**
     * queue index used to generate transaction ids
     * @property qidx
     * @type int
     * @private
     */
    qidx = 0,

    /**
     * interal property used to prevent multiple simultaneous purge
     * processes
     * @property purging
     * @type boolean
     * @private
     */
    purging,


    /**
     * Generates an HTML element, this is not appended to a document
     * @method _node
     * @param {string} type the type of element.
     * @param {string} attr the attributes.
     * @param {Window} win optional window to create the element in.
     * @return {HTMLElement} the generated node.
     * @private
     */
    _node = function(type, attr, win) {
        var w = win || Y.config.win,
            d = w.document,
            n = d.createElement(type),
            i;

        for (i in attr) {
            if (attr[i] && attr.hasOwnProperty(i)) {
                n.setAttribute(i, attr[i]);
            }
        }

        return n;
    },

    /**
     * Generates a link node
     * @method _linkNode
     * @param {string} url the url for the css file.
     * @param {Window} win optional window to create the node in.
     * @param {object} attributes optional attributes collection to apply to the
     * new node.
     * @return {HTMLElement} the generated node.
     * @private
     */
    _linkNode = function(url, win, attributes) {
        var o = {
            id: Y.guid(),
            type: TYPE_CSS,
            rel: STYLESHEET,
            href: url
        };
        if (attributes) {
            Y.mix(o, attributes);
        }
        return _node('link', o, win);
    },

    /**
     * Generates a script node
     * @method _scriptNode
     * @param {string} url the url for the script file.
     * @param {Window} win optional window to create the node in.
     * @param {object} attributes optional attributes collection to apply to the
     * new node.
     * @return {HTMLElement} the generated node.
     * @private
     */
    _scriptNode = function(url, win, attributes) {
        var o = {
            id: Y.guid(),
            type: TYPE_JS
        };

        if (attributes) {
            Y.mix(o, attributes);
        }

        o.src = url;

        return _node('script', o, win);
    },

    /**
     * Returns the data payload for callback functions.
     * @method _returnData
     * @param {object} q the queue.
     * @param {string} msg the result message.
     * @param {string} result the status message from the request.
     * @return {object} the state data from the request.
     * @private
     */
    _returnData = function(q, msg, result) {
        return {
                tId: q.tId,
                win: q.win,
                data: q.data,
                nodes: q.nodes,
                msg: msg,
                statusText: result,
                purge: function() {
                    _purge(this.tId);
                }
            };
    },

    /**
     * The transaction is finished
     * @method _end
     * @param {string} id the id of the request.
     * @param {string} msg the result message.
     * @param {string} result the status message from the request.
     * @private
     */
    _end = function(id, msg, result) {
        var q = queues[id], sc;
        if (q && q.onEnd) {
            sc = q.context || q;
            q.onEnd.call(sc, _returnData(q, msg, result));
        }
    },

    /*
     * The request failed, execute fail handler with whatever
     * was accomplished.  There isn't a failure case at the
     * moment unless you count aborted transactions
     * @method _fail
     * @param {string} id the id of the request
     * @private
     */
    _fail = function(id, msg) {

        var q = queues[id], sc;
        if (q.timer) {
            // q.timer.cancel();
            clearTimeout(q.timer);
        }

        // execute failure callback
        if (q.onFailure) {
            sc = q.context || q;
            q.onFailure.call(sc, _returnData(q, msg));
        }

        _end(id, msg, 'failure');
    },

    /**
     * The request is complete, so executing the requester's callback
     * @method _finish
     * @param {string} id the id of the request.
     * @private
     */
    _finish = function(id) {
        var q = queues[id], msg, sc;
        if (q.timer) {
            // q.timer.cancel();
            clearTimeout(q.timer);
        }
        q.finished = true;

        if (q.aborted) {
            msg = 'transaction ' + id + ' was aborted';
            _fail(id, msg);
            return;
        }

        // execute success callback
        if (q.onSuccess) {
            sc = q.context || q;
            q.onSuccess.call(sc, _returnData(q));
        }

        _end(id, msg, 'OK');
    },

    /**
     * Timeout detected
     * @method _timeout
     * @param {string} id the id of the request.
     * @private
     */
    _timeout = function(id) {
        var q = queues[id], sc;
        if (q.onTimeout) {
            sc = q.context || q;
            q.onTimeout.call(sc, _returnData(q));
        }

        _end(id, 'timeout', 'timeout');
    },


    /**
     * Loads the next item for a given request
     * @method _next
     * @param {string} id the id of the request.
     * @param {string} loaded the url that was just loaded, if any.
     * @return {string} the result.
     * @private
     */
    _next = function(id, loaded) {
        var q = queues[id], msg, w, d, h, n, url, s,
            insertBefore;

        if (q.timer) {
            // q.timer.cancel();
            clearTimeout(q.timer);
        }

        if (q.aborted) {
            msg = 'transaction ' + id + ' was aborted';
            _fail(id, msg);
            return;
        }

        if (loaded) {
            q.url.shift();
            if (q.varName) {
                q.varName.shift();
            }
        } else {
            // This is the first pass: make sure the url is an array
            q.url = (L.isString(q.url)) ? [q.url] : q.url;
            if (q.varName) {
                q.varName = (L.isString(q.varName)) ? [q.varName] : q.varName;
            }
        }

        w = q.win;
        d = w.document;
        h = d.getElementsByTagName('head')[0];

        if (q.url.length === 0) {
            _finish(id);
            return;
        }

        url = q.url[0];

        // if the url is undefined, this is probably a trailing comma
        // problem in IE.
        if (!url) {
            q.url.shift();
            return _next(id);
        }


        if (q.timeout) {
            // q.timer = L.later(q.timeout, q, _timeout, id);
            q.timer = setTimeout(function() {
                _timeout(id);
            }, q.timeout);
        }

        if (q.type === 'script') {
            n = _scriptNode(url, w, q.attributes);
        } else {
            n = _linkNode(url, w, q.attributes);
        }

        // track this node's load progress
        _track(q.type, n, id, url, w, q.url.length);

        // add the node to the queue so we can return it to the user supplied
        // callback
        q.nodes.push(n);

        // add it to the head or insert it before 'insertBefore'.  Work around
        // IE bug if there is a base tag.
        insertBefore = q.insertBefore ||
                       d.getElementsByTagName('base')[0];

        if (insertBefore) {
            s = _get(insertBefore, id);
            if (s) {
                s.parentNode.insertBefore(n, s);
            }
        } else {
            h.appendChild(n);
        }


        // FireFox does not support the onload event for link nodes, so
        // there is no way to make the css requests synchronous. This means
        // that the css rules in multiple files could be applied out of order
        // in this browser if a later request returns before an earlier one.
        // Safari too.
        if ((ua.webkit || ua.gecko) && q.type === 'css') {
            _next(id, url);
        }
    },

    /**
     * Removes processed queues and corresponding nodes
     * @method _autoPurge
     * @private
     */
    _autoPurge = function() {
        if (purging) {
            return;
        }
        purging = true;

        var i, q;

        for (i in queues) {
            if (queues.hasOwnProperty(i)) {
                q = queues[i];
                if (q.autopurge && q.finished) {
                    _purge(q.tId);
                    delete queues[i];
                }
            }
        }

        purging = false;
    },

    /**
     * Saves the state for the request and begins loading
     * the requested urls
     * @method queue
     * @param {string} type the type of node to insert.
     * @param {string} url the url to load.
     * @param {object} opts the hash of options for this request.
     * @return {object} transaction object.
     * @private
     */
    _queue = function(type, url, opts) {
        opts = opts || {};

        var id = 'q' + (qidx++), q,
            thresh = opts.purgethreshold || Y.Get.PURGE_THRESH;

        if (qidx % thresh === 0) {
            _autoPurge();
        }

        queues[id] = Y.merge(opts, {
            tId: id,
            type: type,
            url: url,
            finished: false,
            nodes: []
        });

        q = queues[id];
        q.win = q.win || Y.config.win;
        q.context = q.context || q;
        q.autopurge = ('autopurge' in q) ? q.autopurge :
                      (type === 'script') ? true : false;

        q.attributes = q.attributes || {};
        q.attributes.charset = opts.charset || q.attributes.charset || 'utf-8';

        _next(id);

        return {
            tId: id
        };
    };

    /**
     * Detects when a node has been loaded.  In the case of
     * script nodes, this does not guarantee that contained
     * script is ready to use.
     * @method _track
     * @param {string} type the type of node to track.
     * @param {HTMLElement} n the node to track.
     * @param {string} id the id of the request.
     * @param {string} url the url that is being loaded.
     * @param {Window} win the targeted window.
     * @param {int} qlength the number of remaining items in the queue,
     * including this one.
     * @param {Function} trackfn function to execute when finished
     * the default is _next.
     * @private
     */
    _track = function(type, n, id, url, win, qlength, trackfn) {
        var f = trackfn || _next;

        // IE supports the readystatechange event for script and css nodes
        // Opera only for script nodes.  Opera support onload for script
        // nodes, but this doesn't fire when there is a load failure.
        // The onreadystatechange appears to be a better way to respond
        // to both success and failure.
        if (ua.ie) {
            n.onreadystatechange = function() {
                var rs = this.readyState;
                if ('loaded' === rs || 'complete' === rs) {
                    n.onreadystatechange = null;
                    f(id, url);
                }
            };

        // webkit prior to 3.x is no longer supported
        } else if (ua.webkit) {
            if (type === 'script') {
                // Safari 3.x supports the load event for script nodes (DOM2)
                n.addEventListener('load', function() {
                    f(id, url);
                });
            }

        // FireFox and Opera support onload (but not DOM2 in FF) handlers for
        // script nodes.  Opera, but not FF, supports the onload event for link
        // nodes.
        } else {
            n.onload = function() {
                f(id, url);
            };

            n.onerror = function(e) {
                _fail(id, e + ': ' + url);
            };
        }
    };

    _get = function(nId, tId) {
        var q = queues[tId],
            n = (L.isString(nId)) ? q.win.document.getElementById(nId) : nId;
        if (!n) {
            _fail(tId, 'target node not found: ' + nId);
        }

        return n;
    };

    /**
     * Removes the nodes for the specified queue
     * @method _purge
     * @param {string} tId the transaction id.
     * @private
     */
    _purge = function(tId) {
        var n, l, d, h, s, i, node, attr, insertBefore,
            q = queues[tId];

        if (q) {
            n = q.nodes;
            l = n.length;
            d = q.win.document;
            h = d.getElementsByTagName('head')[0];

            insertBefore = q.insertBefore ||
                           d.getElementsByTagName('base')[0];

            if (insertBefore) {
                s = _get(insertBefore, tId);
                if (s) {
                    h = s.parentNode;
                }
            }

            for (i = 0; i < l; i = i + 1) {
                node = n[i];
                if (node.clearAttributes) {
                    node.clearAttributes();
                } else {
                    for (attr in node) {
                        if (node.hasOwnProperty(attr)) {
                            delete node[attr];
                        }
                    }
                }

                h.removeChild(node);
            }
        }
        q.nodes = [];
    };

    return {

        /**
         * The number of request required before an automatic purge.
         * Can be configured via the 'purgethreshold' config
         * property PURGE_THRESH
         * @static
         * @type int
         * @default 20
         * @private
         */
        PURGE_THRESH: 20,

        /**
         * Called by the the helper for detecting script load in Safari
         * @method _finalize
         * @static
         * @param {string} id the transaction id.
         * @private
         */
        _finalize: function(id) {
            setTimeout(function() {
                _finish(id);
            }, 0);
        },

        /**
         * Abort a transaction
         * @method abort
         * @static
         * @param {string|object} o Either the tId or the object returned from
         * script() or css().
         */
        abort: function(o) {
            var id = (L.isString(o)) ? o : o.tId,
                q = queues[id];
            if (q) {
                q.aborted = true;
            }
        },

        /**
         * Fetches and inserts one or more script nodes into the head
         * of the current document or the document in a specified window.
         *
         * @method script
         * @static
         * @param {string|string[]} url the url or urls to the script(s).
         * @param {object} opts Options:
         * <dl>
         * <dt>onSuccess</dt>
         * <dd>
         * callback to execute when the script(s) are finished loading
         * The callback receives an object back with the following
         * data:
         * <dl>
         * <dt>win</dt>
         * <dd>the window the script(s) were inserted into</dd>
         * <dt>data</dt>
         * <dd>the data object passed in when the request was made</dd>
         * <dt>nodes</dt>
         * <dd>An array containing references to the nodes that were
         * inserted</dd>
         * <dt>purge</dt>
         * <dd>A function that, when executed, will remove the nodes
         * that were inserted</dd>
         * <dt>
         * </dl>
         * </dd>
         * <dt>onTimeout</dt>
         * <dd>
         * callback to execute when a timeout occurs.
         * The callback receives an object back with the following
         * data:
         * <dl>
         * <dt>win</dt>
         * <dd>the window the script(s) were inserted into</dd>
         * <dt>data</dt>
         * <dd>the data object passed in when the request was made</dd>
         * <dt>nodes</dt>
         * <dd>An array containing references to the nodes that were
         * inserted</dd>
         * <dt>purge</dt>
         * <dd>A function that, when executed, will remove the nodes
         * that were inserted</dd>
         * <dt>
         * </dl>
         * </dd>
         * <dt>onEnd</dt>
         * <dd>a function that executes when the transaction finishes,
         * regardless of the exit path</dd>
         * <dt>onFailure</dt>
         * <dd>
         * callback to execute when the script load operation fails
         * The callback receives an object back with the following
         * data:
         * <dl>
         * <dt>win</dt>
         * <dd>the window the script(s) were inserted into</dd>
         * <dt>data</dt>
         * <dd>the data object passed in when the request was made</dd>
         * <dt>nodes</dt>
         * <dd>An array containing references to the nodes that were
         * inserted successfully</dd>
         * <dt>purge</dt>
         * <dd>A function that, when executed, will remove any nodes
         * that were inserted</dd>
         * <dt>
         * </dl>
         * </dd>
         * <dt>context</dt>
         * <dd>the execution context for the callbacks</dd>
         * <dt>win</dt>
         * <dd>a window other than the one the utility occupies</dd>
         * <dt>autopurge</dt>
         * <dd>
         * setting to true will let the utilities cleanup routine purge
         * the script once loaded
         * </dd>
         * <dt>purgethreshold</dt>
         * <dd>
         * The number of transaction before autopurge should be initiated
         * </dd>
         * <dt>data</dt>
         * <dd>
         * data that is supplied to the callback when the script(s) are
         * loaded.
         * </dd>
         * <dt>insertBefore</dt>
         * <dd>node or node id that will become the new node's nextSibling.
         * If this is not specified, nodes will be inserted before a base
         * tag should it exist.  Otherwise, the nodes will be appended to the
         * end of the document head.</dd>
         * </dl>
         * <dt>charset</dt>
         * <dd>Node charset, default utf-8 (deprecated, use the attributes
         * config)</dd>
         * <dt>attributes</dt>
         * <dd>An object literal containing additional attributes to add to
         * the link tags</dd>
         * <dt>timeout</dt>
         * <dd>Number of milliseconds to wait before aborting and firing
         * the timeout event</dd>
         * <pre>
         * &nbsp; Y.Get.script(
         * &nbsp; ["http://yui.yahooapis.com/2.5.2/build/yahoo/yahoo-min.js",
         * &nbsp;  "http://yui.yahooapis.com/2.5.2/build/event/event-min.js"],
         * &nbsp; &#123;
         * &nbsp;   onSuccess: function(o) &#123;
         * &nbsp;     this.log("won't cause error because Y is the context");
         * &nbsp;                   // immediately
         * &nbsp;   &#125;,
         * &nbsp;   onFailure: function(o) &#123;
         * &nbsp;   &#125;,
         * &nbsp;   onTimeout: function(o) &#123;
         * &nbsp;   &#125;,
         * &nbsp;   data: "foo",
         * &nbsp;   timeout: 10000, // 10 second timeout
         * &nbsp;   context: Y, // make the YUI instance
         * &nbsp;   // win: otherframe // target another window/frame
         * &nbsp;   autopurge: true // allow the utility to choose when to
         * &nbsp;                   // remove the nodes
         * &nbsp;   purgetheshold: 1 // purge previous transaction before
         * &nbsp;                    // next transaction
         * &nbsp; &#125;);.
         * </pre>
         * @return {tId: string} an object containing info about the
         * transaction.
         */
        script: function(url, opts) {
            return _queue('script', url, opts);
        },

        /**
         * Fetches and inserts one or more css link nodes into the
         * head of the current document or the document in a specified
         * window.
         * @method css
         * @static
         * @param {string} url the url or urls to the css file(s).
         * @param {object} opts Options:
         * <dl>
         * <dt>onSuccess</dt>
         * <dd>
         * callback to execute when the css file(s) are finished loading
         * The callback receives an object back with the following
         * data:
         * <dl>win</dl>
         * <dd>the window the link nodes(s) were inserted into</dd>
         * <dt>data</dt>
         * <dd>the data object passed in when the request was made</dd>
         * <dt>nodes</dt>
         * <dd>An array containing references to the nodes that were
         * inserted</dd>
         * <dt>purge</dt>
         * <dd>A function that, when executed, will remove the nodes
         * that were inserted</dd>
         * <dt>
         * </dl>
         * </dd>
         * <dt>context</dt>
         * <dd>the execution context for the callbacks</dd>
         * <dt>win</dt>
         * <dd>a window other than the one the utility occupies</dd>
         * <dt>data</dt>
         * <dd>
         * data that is supplied to the callbacks when the nodes(s) are
         * loaded.
         * </dd>
         * <dt>insertBefore</dt>
         * <dd>node or node id that will become the new node's nextSibling</dd>
         * <dt>charset</dt>
         * <dd>Node charset, default utf-8 (deprecated, use the attributes
         * config)</dd>
         * <dt>attributes</dt>
         * <dd>An object literal containing additional attributes to add to
         * the link tags</dd>
         * </dl>
         * <pre>
         * Y.Get.css("http://localhost/css/menu.css");
         * </pre>
         * <pre>
         * &nbsp; Y.Get.css(
         * &nbsp; ["http://localhost/css/menu.css",
         * &nbsp;   insertBefore: 'custom-styles' // nodes will be inserted
         * &nbsp;                                 // before the specified node
         * &nbsp; &#125;);.
         * </pre>
         * @return {tId: string} an object containing info about the
         * transaction.
         */
        css: function(url, opts) {
            return _queue('css', url, opts);
        }
    };
}();



}, '3.3.0' ,{requires:['yui-base']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('oop', function(Y) {

/**
 * Supplies object inheritance and manipulation utilities.  This adds
 * additional functionaity to what is provided in yui-base, and the
 * methods are applied directly to the YUI instance.  This module
 * is required for most YUI components.
 * @module oop
 */

/**
 * The following methods are added to the YUI instance
 * @class YUI~oop
 */

    var L = Y.Lang,
        A = Y.Array,
        OP = Object.prototype,
        CLONE_MARKER = '_~yuim~_',
        EACH = 'each',
        SOME = 'some',

        dispatch = function(o, f, c, proto, action) {
            if (o && o[action] && o !== Y) {
                return o[action].call(o, f, c);
            } else {
                switch (A.test(o)) {
                    case 1:
                        return A[action](o, f, c);
                    case 2:
                        return A[action](Y.Array(o, 0, true), f, c);
                    default:
                        return Y.Object[action](o, f, c, proto);
                }
            }
        };


    /**
     * Applies prototype properties from the supplier to the receiver.
     * The receiver can be a constructor or an instance.
     * @method augment
     * @param {function} r  the object to receive the augmentation.
     * @param {function} s  the object that supplies the properties to augment.
     * @param {boolean} ov if true, properties already on the receiver
     * will be overwritten if found on the supplier.
     * @param {string[]} wl  a whitelist.  If supplied, only properties in
     * this list will be applied to the receiver.
     * @param {Array | Any} args arg or arguments to apply to the supplier
     * constructor when initializing.
     * @return {object} the augmented object.
     *
     * @todo constructor optional?
     * @todo understanding what an instance is augmented with
     * @todo best practices for overriding sequestered methods.
     */
    Y.augment = function(r, s, ov, wl, args) {
        var sProto = s.prototype,
            newProto = null,
            construct = s,
            a = (args) ? Y.Array(args) : [],
            rProto = r.prototype,
            target = rProto || r,
            applyConstructor = false,
            sequestered, replacements;

        // working on a class, so apply constructor infrastructure
        if (rProto && construct) {
            sequestered = {};
            replacements = {};
            newProto = {};

            // sequester all of the functions in the supplier and replace with
            // one that will restore all of them.
            Y.Object.each(sProto, function(v, k) {
                replacements[k] = function() {

            // overwrite the prototype with all of the sequestered functions,
            // but only if it hasn't been overridden
                        for (var i in sequestered) {
                        if (sequestered.hasOwnProperty(i) &&
                                (this[i] === replacements[i])) {
                            this[i] = sequestered[i];
                        }
                    }

                    // apply the constructor
                    construct.apply(this, a);

                    // apply the original sequestered function
                    return sequestered[k].apply(this, arguments);
                };

                if ((!wl || (k in wl)) && (ov || !(k in this))) {
                    if (L.isFunction(v)) {
                        // sequester the function
                        sequestered[k] = v;

// replace the sequestered function with a function that will
// restore all sequestered functions and exectue the constructor.
                        this[k] = replacements[k];
                    } else {
                        this[k] = v;
                    }
                }

            }, newProto, true);

        // augmenting an instance, so apply the constructor immediately
        } else {
            applyConstructor = true;
        }

        Y.mix(target, newProto || sProto, ov, wl);

        if (applyConstructor) {
            s.apply(target, a);
        }

        return r;
    };

    /**
     * Applies object properties from the supplier to the receiver.  If
     * the target has the property, and the property is an object, the target
     * object will be augmented with the supplier's value.  If the property
     * is an array, the suppliers value will be appended to the target.
     * @method aggregate
     * @param {function} r  the object to receive the augmentation.
     * @param {function} s  the object that supplies the properties to augment.
     * @param {boolean} ov if true, properties already on the receiver
     * will be overwritten if found on the supplier.
     * @param {string[]} wl a whitelist.  If supplied, only properties in
     * this list will be applied to the receiver.
     * @return {object} the extended object.
     */
    Y.aggregate = function(r, s, ov, wl) {
        return Y.mix(r, s, ov, wl, 0, true);
    };

    /**
     * Utility to set up the prototype, constructor and superclass properties to
     * support an inheritance strategy that can chain constructors and methods.
     * Static members will not be inherited.
     *
     * @method extend
     * @param {function} r   the object to modify.
     * @param {function} s the object to inherit.
     * @param {object} px prototype properties to add/override.
     * @param {object} sx static properties to add/override.
     * @return {object} the extended object.
     */
    Y.extend = function(r, s, px, sx) {
        if (!s || !r) {
            Y.error('extend failed, verify dependencies');
        }

        var sp = s.prototype, rp = Y.Object(sp);
        r.prototype = rp;

        rp.constructor = r;
        r.superclass = sp;

        // assign constructor property
        if (s != Object && sp.constructor == OP.constructor) {
            sp.constructor = s;
        }

        // add prototype overrides
        if (px) {
            Y.mix(rp, px, true);
        }

        // add object overrides
        if (sx) {
            Y.mix(r, sx, true);
        }

        return r;
    };

    /**
     * Executes the supplied function for each item in
     * a collection.  Supports arrays, objects, and
     * Y.NodeLists
     * @method each
     * @param {object} o the object to iterate.
     * @param {function} f the function to execute.  This function
     * receives the value, key, and object as parameters.
     * @param {object} c the execution context for the function.
     * @param {boolean} proto if true, prototype properties are
     * iterated on objects.
     * @return {YUI} the YUI instance.
     */
    Y.each = function(o, f, c, proto) {
        return dispatch(o, f, c, proto, EACH);
    };

    /**
     * Executes the supplied function for each item in
     * a collection.  The operation stops if the function
     * returns true. Supports arrays, objects, and
     * Y.NodeLists.
     * @method some
     * @param {object} o the object to iterate.
     * @param {function} f the function to execute.  This function
     * receives the value, key, and object as parameters.
     * @param {object} c the execution context for the function.
     * @param {boolean} proto if true, prototype properties are
     * iterated on objects.
     * @return {boolean} true if the function ever returns true,
     * false otherwise.
     */
    Y.some = function(o, f, c, proto) {
        return dispatch(o, f, c, proto, SOME);
    };

    /**
     * Deep obj/array copy.  Function clones are actually
     * wrappers around the original function.
     * Array-like objects are treated as arrays.
     * Primitives are returned untouched.  Optionally, a
     * function can be provided to handle other data types,
     * filter keys, validate values, etc.
     *
     * @method clone
     * @param {object} o what to clone.
     * @param {boolean} safe if true, objects will not have prototype
     * items from the source.  If false, they will.  In this case, the
     * original is initially protected, but the clone is not completely
     * immune from changes to the source object prototype.  Also, cloned
     * prototype items that are deleted from the clone will result
     * in the value of the source prototype being exposed.  If operating
     * on a non-safe clone, items should be nulled out rather than deleted.
     * @param {function} f optional function to apply to each item in a
     * collection; it will be executed prior to applying the value to
     * the new object.  Return false to prevent the copy.
     * @param {object} c optional execution context for f.
     * @param {object} owner Owner object passed when clone is iterating
     * an object.  Used to set up context for cloned functions.
     * @param {object} cloned hash of previously cloned objects to avoid
     * multiple clones.
     * @return {Array|Object} the cloned object.
     */
    Y.clone = function(o, safe, f, c, owner, cloned) {

        if (!L.isObject(o)) {
            return o;
        }

        // @todo cloning YUI instances doesn't currently work
        if (Y.instanceOf(o, YUI)) {
            return o;
        }

        var o2, marked = cloned || {}, stamp,
            yeach = Y.each;

        switch (L.type(o)) {
            case 'date':
                return new Date(o);
            case 'regexp':
                // if we do this we need to set the flags too
                // return new RegExp(o.source);
                return o;
            case 'function':
                // o2 = Y.bind(o, owner);
                // break;
                return o;
            case 'array':
                o2 = [];
                break;
            default:

                // #2528250 only one clone of a given object should be created.
                if (o[CLONE_MARKER]) {
                    return marked[o[CLONE_MARKER]];
                }

                stamp = Y.guid();

                o2 = (safe) ? {} : Y.Object(o);

                o[CLONE_MARKER] = stamp;
                marked[stamp] = o;
        }

        // #2528250 don't try to clone element properties
        if (!o.addEventListener && !o.attachEvent) {
            yeach(o, function(v, k) {
if ((k || k === 0) && (!f || (f.call(c || this, v, k, this, o) !== false))) {
                    if (k !== CLONE_MARKER) {
                        if (k == 'prototype') {
                            // skip the prototype
                        // } else if (o[k] === o) {
                        //     this[k] = this;
                        } else {
                            this[k] =
                                Y.clone(v, safe, f, c, owner || o, marked);
                        }
                    }
                }
            }, o2);
        }

        if (!cloned) {
            Y.Object.each(marked, function(v, k) {
                if (v[CLONE_MARKER]) {
                    try {
                        delete v[CLONE_MARKER];
                    } catch (e) {
                        v[CLONE_MARKER] = null;
                    }
                }
            }, this);
            marked = null;
        }

        return o2;
    };


    /**
     * Returns a function that will execute the supplied function in the
     * supplied object's context, optionally adding any additional
     * supplied parameters to the beginning of the arguments collection the
     * supplied to the function.
     *
     * @method bind
     * @param {Function|String} f the function to bind, or a function name
     * to execute on the context object.
     * @param {object} c the execution context.
     * @param {any} args* 0..n arguments to include before the arguments the
     * function is executed with.
     * @return {function} the wrapped function.
     */
    Y.bind = function(f, c) {
        var xargs = arguments.length > 2 ?
                Y.Array(arguments, 2, true) : null;
        return function() {
            var fn = L.isString(f) ? c[f] : f,
                args = (xargs) ?
                    xargs.concat(Y.Array(arguments, 0, true)) : arguments;
            return fn.apply(c || fn, args);
        };
    };

    /**
     * Returns a function that will execute the supplied function in the
     * supplied object's context, optionally adding any additional
     * supplied parameters to the end of the arguments the function
     * is executed with.
     *
     * @method rbind
     * @param {Function|String} f the function to bind, or a function name
     * to execute on the context object.
     * @param {object} c the execution context.
     * @param {any} args* 0..n arguments to append to the end of
     * arguments collection supplied to the function.
     * @return {function} the wrapped function.
     */
    Y.rbind = function(f, c) {
        var xargs = arguments.length > 2 ? Y.Array(arguments, 2, true) : null;
        return function() {
            var fn = L.isString(f) ? c[f] : f,
                args = (xargs) ?
                    Y.Array(arguments, 0, true).concat(xargs) : arguments;
            return fn.apply(c || fn, args);
        };
    };



}, '3.3.0' );
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('jsonp', function(Y) {

var isFunction = Y.Lang.isFunction;

/**
 * <p>Provides a JSONPRequest class for repeated JSONP calls, and a convenience
 * method Y.jsonp(url, callback) to instantiate and send a JSONP request.</p>
 *
 * <p>Both the constructor as well as the convenience function take two
 * parameters: a url string and a callback.</p>
 *
 * <p>The url provided must include the placeholder string
 * &quot;{callback}&quot; which will be replaced by a dynamically
 * generated routing function to pass the data to your callback function.
 * An example url might look like
 * &quot;http://example.com/service?callback={callback}&quot;.</p>
 *
 * <p>The second parameter can be a callback function that accepts the JSON
 * payload as its argument, or a configuration object supporting the keys:</p>
 * <ul>
 *   <li>on - map of callback subscribers
 *      <ul>
 *         <li>success - function handler for successful transmission</li>
 *         <li>failure - function handler for failed transmission</li>
 *         <li>timeout - function handler for transactions that timeout</li>
 *      </ul>
 *  </li>
 *  <li>format  - override function for inserting the proxy name in the url</li>
 *  <li>timeout - the number of milliseconds to wait before giving up</li>
 *  <li>context - becomes <code>this</code> in the callbacks</li>
 *  <li>args    - array of subsequent parameters to pass to the callbacks</li>
 *  <li>allowCache - use the same proxy name for all requests? (boolean)</li>
 * </ul>
 *
 * @module jsonp
 * @class JSONPRequest
 * @constructor
 * @param url {String} the url of the JSONP service
 * @param callback {Object|Function} the default callback configuration or
 *                                   success handler
 */
function JSONPRequest() {
    this._init.apply(this, arguments);
}

JSONPRequest.prototype = {
    /**
     * Number of requests currently pending responses.  Used by connections
     * configured to allowCache to make sure the proxy isn't deleted until
     * the last response has returned.
     *
     * @property _requests
     * @private
     * @type {Number}
     */
    _requests: 0,

    /**
     * Set up the success and failure handlers and the regex pattern used
     * to insert the temporary callback name in the url.
     *
     * @method _init
     * @param url {String} the url of the JSONP service
     * @param callback {Object|Function} Optional success callback or config
     *                  object containing success and failure functions and
     *                  the url regex.
     * @protected
     */
    _init : function (url, callback) {
        this.url = url;

        // Accept a function, an object, or nothing
        callback = (isFunction(callback)) ?
            { on: { success: callback } } :
            callback || {};

        var subs = callback.on || {};

        if (!subs.success) {
            subs.success = this._defaultCallback(url, callback);
        }

        // Apply defaults and store
        this._config = Y.merge({
                context: this,
                args   : [],
                format : this._format,
                allowCache: false
            }, callback, { on: subs });
    },

    /** 
     * Override this method to provide logic to default the success callback if
     * it is not provided at construction.  This is overridden by jsonp-url to
     * parse the callback from the url string.
     * 
     * @method _defaultCallback
     * @param url {String} the url passed at construction
     * @param config {Object} (optional) the config object passed at
     *                        construction
     * @return {Function}
     */
    _defaultCallback: function () {},

    /** 
     * Issues the JSONP request.
     *
     * @method send
     * @param args* {any} any additional arguments to pass to the url formatter
     *              beyond the base url and the proxy function name
     * @chainable
     */
    send : function () {
        var self   = this,
            args   = Y.Array(arguments, 0, true),
            config = self._config,
            proxy  = self._proxy || Y.guid(),
            url;
            
        // TODO: support allowCache as time value
        if (config.allowCache) {
            self._proxy = proxy;

            // In case additional requests are issued before the current request
            // returns, don't remove the proxy.
            self._requests++;
        }

        args.unshift(self.url, 'YUI.Env.JSONP.' + proxy);
        url = config.format.apply(self, args);

        if (!config.on.success) {
            return self;
        }

        function wrap(fn) {
            return (isFunction(fn)) ?
                function (data) {
                    if (!config.allowCache || !--self._requests) {
                        delete YUI.Env.JSONP[proxy];
                    }
                    fn.apply(config.context, [data].concat(config.args));
                } :
                null;
        }

        // Temporary un-sandboxed function alias
        // TODO: queuing
        YUI.Env.JSONP[proxy] = wrap(config.on.success);

        Y.Get.script(url, {
            onFailure: wrap(config.on.failure),
            onTimeout: wrap(config.on.timeout),
            timeout  : config.timeout
        });

        return self;
    },

    /**
     * Default url formatter.  Looks for callback= in the url and appends it
     * if not present.  The supplied proxy name will be assigned to the query
     * param.  Override this method by passing a function as the
     * &quot;format&quot; property in the config object to the constructor.
     *
     * @method _format
     * @param url { String } the original url
     * @param proxy {String} the function name that will be used as a proxy to
     *      the configured callback methods.
     * @param args* {any} additional args passed to send()
     * @return {String} fully qualified JSONP url
     * @protected
     */
    _format: function (url, proxy) {
        return url.replace(/\{callback\}/, proxy);
    }
};

Y.JSONPRequest = JSONPRequest;

/**
 *
 * @method Y.jsonp
 * @param url {String} the url of the JSONP service with the {callback}
 *          placeholder where the callback function name typically goes.
 * @param c {Function|Object} Callback function accepting the JSON payload
 *          as its argument, or a configuration object (see above).
 * @param args* {any} additional arguments to pass to send()
 * @return {JSONPRequest}
 * @static
 */
Y.jsonp = function (url,c) {
    var req = new Y.JSONPRequest(url,c);
    return req.send.apply(req, Y.Array(arguments, 2, true));
};

if (!YUI.Env.JSONP) {
    YUI.Env.JSONP = {};
}


}, '3.3.0' ,{requires:['get','oop']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('jsonp-url', function(Y) {

var JSONPRequest = Y.JSONPRequest,
    getByPath    = Y.Object.getValue,
    noop         = function () {};

/**
 * Adds support for parsing complex callback identifiers from the jsonp url.
 * This includes callback=foo[1]bar.baz["goo"] as well as referencing methods
 * in the YUI instance.
 *
 * @module jsonp
 * @submodule jsonp-url
 * @for JSONPRequest
 */

Y.mix(JSONPRequest.prototype, {
    /**
     * RegExp used by the default URL formatter to insert the generated callback
     * name into the JSONP url.  Looks for a query param callback=.  If a value
     * is assigned, it will be clobbered.
     *
     * @member _pattern
     * @type RegExp
     * @default /\bcallback=.*?(?=&|$)/i
     * @protected
     */
    _pattern: /\bcallback=(.*?)(?=&|$)/i,

    /**
     * Template used by the default URL formatter to add the callback function
     * name to the url.
     *
     * @member _template
     * @type String
     * @default "callback={callback}"
     * @protected
     */
    _template: "callback={callback}",

    /**
     * <p>Parses the url for a callback named explicitly in the string.
     * Override this if the target JSONP service uses a different query
     * parameter or url format.</p>
     *
     * <p>If the callback is declared inline, the corresponding function will
     * be returned.  Otherwise null.</p>
     *
     * @method _defaultCallback
     * @param url {String} the url to search in
     * @return {Function} the callback function if found, or null
     * @protected
     */
    _defaultCallback: function (url) {
        var match = url.match(this._pattern),
            keys  = [],
            i = 0,
            locator, path, callback;

        if (match) {
            // Strip the ["string keys"] and [1] array indexes
            locator = match[1]
                .replace(/\[(['"])(.*?)\1\]/g,
                    function (x, $1, $2) {
                        keys[i] = $2;
                        return '.@' + (i++);
                    })
                .replace(/\[(\d+)\]/g,
                    function (x, $1) {
                        keys[i] = parseInt($1, 10) | 0;
                        return '.@' + (i++);
                    })
                .replace(/^\./, ''); // remove leading dot

            // Validate against problematic characters.
            if (!/[^\w\.\$@]/.test(locator)) {
                path = locator.split('.');
                for (i = path.length - 1; i >= 0; --i) {
                    if (path[i].charAt(0) === '@') {
                        path[i] = keys[parseInt(path[i].substr(1), 10)];
                    }
                }

                // First look for a global function, then the Y, then try the Y
                // again from the second token (to support "callback=Y.handler")
                callback = getByPath(Y.config.win, path) ||
                           getByPath(Y, path) ||
                           getByPath(Y, path.slice(1));
            }
        }

        return callback || noop;
    },

    /**
     * URL formatter that looks for callback= in the url and appends it
     * if not present.  The supplied proxy name will be assigned to the query
     * param.  Override this method by passing a function as the
     * &quot;format&quot; property in the config object to the constructor.
     *
     * @method _format
     * @param url { String } the original url
     * @param proxy {String} the function name that will be used as a proxy to
     *      the configured callback methods.
     * @return {String} fully qualified JSONP url
     * @protected
     */
    _format: function (url, proxy) {
        var callback = this._template.replace(/\{callback\}/, proxy),
            lastChar;

        if (this._pattern.test(url)) {
            return url.replace(this._pattern, callback);
        } else {
            lastChar = url.slice(-1);
            if (lastChar !== '&' && lastChar !== '?') {
                url += (url.indexOf('?') > -1) ? '&' : '?';
            }
            return url + callback;
        }
    }

}, true);


}, '3.3.0' ,{requires:['jsonp']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('yql', function(Y) {

    /**
     * This class adds a sugar class to allow access to YQL (http://developer.yahoo.com/yql/).
     * @module yql
     */     
    /**
     * Utility Class used under the hood my the YQL class
     * @class YQLRequest
     * @constructor
     * @param {String} sql The SQL statement to execute
     * @param {Function/Object} callback The callback to execute after the query (Falls through to JSONP).
     * @param {Object} params An object literal of extra parameters to pass along (optional).
     * @param {Object} opts An object literal of configuration options (optional): proto (http|https), base (url)
     */
    var YQLRequest = function (sql, callback, params, opts) {
        
        if (!params) {
            params = {};
        }
        params.q = sql;
        //Allow format override.. JSON-P-X
        if (!params.format) {
            params.format = Y.YQLRequest.FORMAT;
        }
        if (!params.env) {
            params.env = Y.YQLRequest.ENV;
        }

        this._params = params;
        this._opts = opts;
        this._callback = callback;

    };
    
    YQLRequest.prototype = {
        /**
        * @private
        * @property _jsonp
        * @description Reference to the JSONP instance used to make the queries
        */
        _jsonp: null,
        /**
        * @private
        * @property _opts
        * @description Holder for the opts argument
        */
        _opts: null,
        /**
        * @private
        * @property _callback
        * @description Holder for the callback argument
        */
        _callback: null,
        /**
        * @private
        * @property _params
        * @description Holder for the params argument
        */
        _params: null,
        /**
        * @method send
        * @description The method that executes the YQL Request.
        * @chainable
        * @returns {YQLRequest}
        */
        send: function() {
            var qs = '', url = ((this._opts && this._opts.proto) ? this._opts.proto : Y.YQLRequest.PROTO);

            Y.each(this._params, function(v, k) {
                qs += k + '=' + encodeURIComponent(v) + '&';
            });
            
            url += ((this._opts && this._opts.base) ? this._opts.base : Y.YQLRequest.BASE_URL) + qs;
            
            var o = (!Y.Lang.isFunction(this._callback)) ? this._callback : { on: { success: this._callback } };
            if (o.allowCache !== false) {
                o.allowCache = true;
            }
            
            if (!this._jsonp) {
                this._jsonp = Y.jsonp(url, o);
            } else {
                this._jsonp.url = url;
                if (o.on && o.on.success) {
                    this._jsonp._config.on.success = o.on.success;
                }
                this._jsonp.send();
            }
            return this;
        }
    };

    /**
    * @static
    * @property FORMAT
    * @description Default format to use: json
    */
    YQLRequest.FORMAT = 'json';
    /**
    * @static
    * @property PROTO
    * @description Default protocol to use: http
    */
    YQLRequest.PROTO = 'http';
    /**
    * @static
    * @property BASE_URL
    * @description The base URL to query: query.yahooapis.com/v1/public/yql?
    */
    YQLRequest.BASE_URL = ':/'+'/query.yahooapis.com/v1/public/yql?';
    /**
    * @static
    * @property ENV
    * @description The environment file to load: http://datatables.org/alltables.env
    */
    YQLRequest.ENV = 'http:/'+'/datatables.org/alltables.env';
    
    Y.YQLRequest = YQLRequest;
	
    /**
     * This class adds a sugar class to allow access to YQL (http://developer.yahoo.com/yql/).
     * @class YQL
     * @constructor
     * @param {String} sql The SQL statement to execute
     * @param {Function} callback The callback to execute after the query (optional).
     * @param {Object} params An object literal of extra parameters to pass along (optional).
     */
	Y.YQL = function(sql, callback, params) {
        return new Y.YQLRequest(sql, callback, params).send();
    };



}, '3.3.0' ,{requires:['jsonp']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('event-custom-base', function(Y) {

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 */

Y.Env.evt = {
    handles: {},
    plugins: {}
};


/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 * @submodule event-custom-base
 */

/**
 * Allows for the insertion of methods that are executed before or after
 * a specified method
 * @class Do
 * @static
 */

var DO_BEFORE = 0,
    DO_AFTER = 1,

DO = {

    /**
     * Cache of objects touched by the utility
     * @property objs
     * @static
     */
    objs: {},

    /**
     * Execute the supplied method before the specified function
     * @method before
     * @param fn {Function} the function to execute
     * @param obj the object hosting the method to displace
     * @param sFn {string} the name of the method to displace
     * @param c The execution context for fn
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {string} handle for the subscription
     * @static
     */
    before: function(fn, obj, sFn, c) {
        var f = fn, a;
        if (c) {
            a = [fn, c].concat(Y.Array(arguments, 4, true));
            f = Y.rbind.apply(Y, a);
        }

        return this._inject(DO_BEFORE, f, obj, sFn);
    },

    /**
     * Execute the supplied method after the specified function
     * @method after
     * @param fn {Function} the function to execute
     * @param obj the object hosting the method to displace
     * @param sFn {string} the name of the method to displace
     * @param c The execution context for fn
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * @return {string} handle for the subscription
     * @static
     */
    after: function(fn, obj, sFn, c) {
        var f = fn, a;
        if (c) {
            a = [fn, c].concat(Y.Array(arguments, 4, true));
            f = Y.rbind.apply(Y, a);
        }

        return this._inject(DO_AFTER, f, obj, sFn);
    },

    /**
     * Execute the supplied method after the specified function
     * @method _inject
     * @param when {string} before or after
     * @param fn {Function} the function to execute
     * @param obj the object hosting the method to displace
     * @param sFn {string} the name of the method to displace
     * @param c The execution context for fn
     * @return {string} handle for the subscription
     * @private
     * @static
     */
    _inject: function(when, fn, obj, sFn) {

        // object id
        var id = Y.stamp(obj), o, sid;

        if (! this.objs[id]) {
            // create a map entry for the obj if it doesn't exist
            this.objs[id] = {};
        }

        o = this.objs[id];

        if (! o[sFn]) {
            // create a map entry for the method if it doesn't exist
            o[sFn] = new Y.Do.Method(obj, sFn);

            // re-route the method to our wrapper
            obj[sFn] =
                function() {
                    return o[sFn].exec.apply(o[sFn], arguments);
                };
        }

        // subscriber id
        sid = id + Y.stamp(fn) + sFn;

        // register the callback
        o[sFn].register(sid, fn, when);

        return new Y.EventHandle(o[sFn], sid);

    },

    /**
     * Detach a before or after subscription
     * @method detach
     * @param handle {string} the subscription handle
     */
    detach: function(handle) {

        if (handle.detach) {
            handle.detach();
        }

    },

    _unload: function(e, me) {

    }
};

Y.Do = DO;

//////////////////////////////////////////////////////////////////////////

/**
 * Contains the return value from the wrapped method, accessible
 * by 'after' event listeners.
 *
 * @property Do.originalRetVal
 * @static
 * @since 2.3.0
 */

/**
 * Contains the current state of the return value, consumable by
 * 'after' event listeners, and updated if an after subscriber
 * changes the return value generated by the wrapped function.
 *
 * @property Do.currentRetVal
 * @static
 * @since 2.3.0
 */

//////////////////////////////////////////////////////////////////////////

/**
 * Wrapper for a displaced method with aop enabled
 * @class Do.Method
 * @constructor
 * @param obj The object to operate on
 * @param sFn The name of the method to displace
 */
DO.Method = function(obj, sFn) {
    this.obj = obj;
    this.methodName = sFn;
    this.method = obj[sFn];
    this.before = {};
    this.after = {};
};

/**
 * Register a aop subscriber
 * @method register
 * @param sid {string} the subscriber id
 * @param fn {Function} the function to execute
 * @param when {string} when to execute the function
 */
DO.Method.prototype.register = function (sid, fn, when) {
    if (when) {
        this.after[sid] = fn;
    } else {
        this.before[sid] = fn;
    }
};

/**
 * Unregister a aop subscriber
 * @method delete
 * @param sid {string} the subscriber id
 * @param fn {Function} the function to execute
 * @param when {string} when to execute the function
 */
DO.Method.prototype._delete = function (sid) {
    delete this.before[sid];
    delete this.after[sid];
};

/**
 * Execute the wrapped method
 * @method exec
 */
DO.Method.prototype.exec = function () {

    var args = Y.Array(arguments, 0, true),
        i, ret, newRet,
        bf = this.before,
        af = this.after,
        prevented = false;

    // execute before
    for (i in bf) {
        if (bf.hasOwnProperty(i)) {
            ret = bf[i].apply(this.obj, args);
            if (ret) {
                switch (ret.constructor) {
                    case DO.Halt:
                        return ret.retVal;
                    case DO.AlterArgs:
                        args = ret.newArgs;
                        break;
                    case DO.Prevent:
                        prevented = true;
                        break;
                    default:
                }
            }
        }
    }

    // execute method
    if (!prevented) {
        ret = this.method.apply(this.obj, args);
    }

    DO.originalRetVal = ret;
    DO.currentRetVal = ret;

    // execute after methods.
    for (i in af) {
        if (af.hasOwnProperty(i)) {
            newRet = af[i].apply(this.obj, args);
            // Stop processing if a Halt object is returned
            if (newRet && newRet.constructor == DO.Halt) {
                return newRet.retVal;
            // Check for a new return value
            } else if (newRet && newRet.constructor == DO.AlterReturn) {
                ret = newRet.newRetVal;
                // Update the static retval state
                DO.currentRetVal = ret;
            }
        }
    }

    return ret;
};

//////////////////////////////////////////////////////////////////////////

/**
 * Return an AlterArgs object when you want to change the arguments that
 * were passed into the function.  An example would be a service that scrubs
 * out illegal characters prior to executing the core business logic.
 * @class Do.AlterArgs
 */
DO.AlterArgs = function(msg, newArgs) {
    this.msg = msg;
    this.newArgs = newArgs;
};

/**
 * Return an AlterReturn object when you want to change the result returned
 * from the core method to the caller
 * @class Do.AlterReturn
 */
DO.AlterReturn = function(msg, newRetVal) {
    this.msg = msg;
    this.newRetVal = newRetVal;
};

/**
 * Return a Halt object when you want to terminate the execution
 * of all subsequent subscribers as well as the wrapped method
 * if it has not exectued yet.
 * @class Do.Halt
 */
DO.Halt = function(msg, retVal) {
    this.msg = msg;
    this.retVal = retVal;
};

/**
 * Return a Prevent object when you want to prevent the wrapped function
 * from executing, but want the remaining listeners to execute
 * @class Do.Prevent
 */
DO.Prevent = function(msg) {
    this.msg = msg;
};

/**
 * Return an Error object when you want to terminate the execution
 * of all subsequent method calls.
 * @class Do.Error
 * @deprecated use Y.Do.Halt or Y.Do.Prevent
 */
DO.Error = DO.Halt;


//////////////////////////////////////////////////////////////////////////

// Y["Event"] && Y.Event.addListener(window, "unload", Y.Do._unload, Y.Do);


/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 * @submodule event-custom-base
 */


// var onsubscribeType = "_event:onsub",
var AFTER = 'after',
    CONFIGS = [
        'broadcast',
        'monitored',
        'bubbles',
        'context',
        'contextFn',
        'currentTarget',
        'defaultFn',
        'defaultTargetOnly',
        'details',
        'emitFacade',
        'fireOnce',
        'async',
        'host',
        'preventable',
        'preventedFn',
        'queuable',
        'silent',
        'stoppedFn',
        'target',
        'type'
    ],

    YUI3_SIGNATURE = 9,
    YUI_LOG = 'yui:log';

/**
 * Return value from all subscribe operations
 * @class EventHandle
 * @constructor
 * @param {CustomEvent} evt the custom event.
 * @param {Subscriber} sub the subscriber.
 */
Y.EventHandle = function(evt, sub) {

    /**
     * The custom event
     * @type CustomEvent
     */
    this.evt = evt;

    /**
     * The subscriber object
     * @type Subscriber
     */
    this.sub = sub;
};

Y.EventHandle.prototype = {
    batch: function(f, c) {
        f.call(c || this, this);
        if (Y.Lang.isArray(this.evt)) {
            Y.Array.each(this.evt, function(h) {
                h.batch.call(c || h, f);
            });
        }
    },

    /**
     * Detaches this subscriber
     * @method detach
     * @return {int} the number of detached listeners
     */
    detach: function() {
        var evt = this.evt, detached = 0, i;
        if (evt) {
            if (Y.Lang.isArray(evt)) {
                for (i = 0; i < evt.length; i++) {
                    detached += evt[i].detach();
                }
            } else {
                evt._delete(this.sub);
                detached = 1;
            }

        }

        return detached;
    },

    /**
     * Monitor the event state for the subscribed event.  The first parameter
     * is what should be monitored, the rest are the normal parameters when
     * subscribing to an event.
     * @method monitor
     * @param what {string} what to monitor ('attach', 'detach', 'publish').
     * @return {EventHandle} return value from the monitor event subscription.
     */
    monitor: function(what) {
        return this.evt.monitor.apply(this.evt, arguments);
    }
};

/**
 * The CustomEvent class lets you define events for your application
 * that can be subscribed to by one or more independent component.
 *
 * @param {String} type The type of event, which is passed to the callback
 * when the event fires.
 * @param {object} o configuration object.
 * @class CustomEvent
 * @constructor
 */
Y.CustomEvent = function(type, o) {

    // if (arguments.length > 2) {
// this.log('CustomEvent context and silent are now in the config', 'warn', 'Event');
    // }

    o = o || {};

    this.id = Y.stamp(this);

    /**
     * The type of event, returned to subscribers when the event fires
     * @property type
     * @type string
     */
    this.type = type;

    /**
     * The context the the event will fire from by default.  Defaults to the YUI
     * instance.
     * @property context
     * @type object
     */
    this.context = Y;

    /**
     * Monitor when an event is attached or detached.
     *
     * @property monitored
     * @type boolean
     */
    // this.monitored = false;

    this.logSystem = (type == YUI_LOG);

    /**
     * If 0, this event does not broadcast.  If 1, the YUI instance is notified
     * every time this event fires.  If 2, the YUI instance and the YUI global
     * (if event is enabled on the global) are notified every time this event
     * fires.
     * @property broadcast
     * @type int
     */
    // this.broadcast = 0;

    /**
     * By default all custom events are logged in the debug build, set silent
     * to true to disable debug outpu for this event.
     * @property silent
     * @type boolean
     */
    this.silent = this.logSystem;

    /**
     * Specifies whether this event should be queued when the host is actively
     * processing an event.  This will effect exectution order of the callbacks
     * for the various events.
     * @property queuable
     * @type boolean
     * @default false
     */
    // this.queuable = false;

    /**
     * The subscribers to this event
     * @property subscribers
     * @type Subscriber {}
     */
    this.subscribers = {};

    /**
     * 'After' subscribers
     * @property afters
     * @type Subscriber {}
     */
    this.afters = {};

    /**
     * This event has fired if true
     *
     * @property fired
     * @type boolean
     * @default false;
     */
    // this.fired = false;

    /**
     * An array containing the arguments the custom event
     * was last fired with.
     * @property firedWith
     * @type Array
     */
    // this.firedWith;

    /**
     * This event should only fire one time if true, and if
     * it has fired, any new subscribers should be notified
     * immediately.
     *
     * @property fireOnce
     * @type boolean
     * @default false;
     */
    // this.fireOnce = false;

    /**
     * fireOnce listeners will fire syncronously unless async
     * is set to true
     * @property async
     * @type boolean
     * @default false
     */
    //this.async = false;

    /**
     * Flag for stopPropagation that is modified during fire()
     * 1 means to stop propagation to bubble targets.  2 means
     * to also stop additional subscribers on this target.
     * @property stopped
     * @type int
     */
    // this.stopped = 0;

    /**
     * Flag for preventDefault that is modified during fire().
     * if it is not 0, the default behavior for this event
     * @property prevented
     * @type int
     */
    // this.prevented = 0;

    /**
     * Specifies the host for this custom event.  This is used
     * to enable event bubbling
     * @property host
     * @type EventTarget
     */
    // this.host = null;

    /**
     * The default function to execute after event listeners
     * have fire, but only if the default action was not
     * prevented.
     * @property defaultFn
     * @type Function
     */
    // this.defaultFn = null;

    /**
     * The function to execute if a subscriber calls
     * stopPropagation or stopImmediatePropagation
     * @property stoppedFn
     * @type Function
     */
    // this.stoppedFn = null;

    /**
     * The function to execute if a subscriber calls
     * preventDefault
     * @property preventedFn
     * @type Function
     */
    // this.preventedFn = null;

    /**
     * Specifies whether or not this event's default function
     * can be cancelled by a subscriber by executing preventDefault()
     * on the event facade
     * @property preventable
     * @type boolean
     * @default true
     */
    this.preventable = true;

    /**
     * Specifies whether or not a subscriber can stop the event propagation
     * via stopPropagation(), stopImmediatePropagation(), or halt()
     *
     * Events can only bubble if emitFacade is true.
     *
     * @property bubbles
     * @type boolean
     * @default true
     */
    this.bubbles = true;

    /**
     * Supports multiple options for listener signatures in order to
     * port YUI 2 apps.
     * @property signature
     * @type int
     * @default 9
     */
    this.signature = YUI3_SIGNATURE;

    this.subCount = 0;
    this.afterCount = 0;

    // this.hasSubscribers = false;

    // this.hasAfters = false;

    /**
     * If set to true, the custom event will deliver an EventFacade object
     * that is similar to a DOM event object.
     * @property emitFacade
     * @type boolean
     * @default false
     */
    // this.emitFacade = false;

    this.applyConfig(o, true);

    // this.log("Creating " + this.type);

};

Y.CustomEvent.prototype = {

    hasSubs: function(when) {
        var s = this.subCount, a = this.afterCount, sib = this.sibling;

        if (sib) {
            s += sib.subCount;
            a += sib.afterCount;
        }

        if (when) {
            return (when == 'after') ? a : s;
        }

        return (s + a);
    },

    /**
     * Monitor the event state for the subscribed event.  The first parameter
     * is what should be monitored, the rest are the normal parameters when
     * subscribing to an event.
     * @method monitor
     * @param what {string} what to monitor ('detach', 'attach', 'publish').
     * @return {EventHandle} return value from the monitor event subscription.
     */
    monitor: function(what) {
        this.monitored = true;
        var type = this.id + '|' + this.type + '_' + what,
            args = Y.Array(arguments, 0, true);
        args[0] = type;
        return this.host.on.apply(this.host, args);
    },

    /**
     * Get all of the subscribers to this event and any sibling event
     * @method getSubs
     * @return {Array} first item is the on subscribers, second the after.
     */
    getSubs: function() {
        var s = Y.merge(this.subscribers), a = Y.merge(this.afters), sib = this.sibling;

        if (sib) {
            Y.mix(s, sib.subscribers);
            Y.mix(a, sib.afters);
        }

        return [s, a];
    },

    /**
     * Apply configuration properties.  Only applies the CONFIG whitelist
     * @method applyConfig
     * @param o hash of properties to apply.
     * @param force {boolean} if true, properties that exist on the event
     * will be overwritten.
     */
    applyConfig: function(o, force) {
        if (o) {
            Y.mix(this, o, force, CONFIGS);
        }
    },

    _on: function(fn, context, args, when) {

        if (!fn) {
            this.log('Invalid callback for CE: ' + this.type);
        }

        var s = new Y.Subscriber(fn, context, args, when);

        if (this.fireOnce && this.fired) {
            if (this.async) {
                setTimeout(Y.bind(this._notify, this, s, this.firedWith), 0);
            } else {
                this._notify(s, this.firedWith);
            }
        }

        if (when == AFTER) {
            this.afters[s.id] = s;
            this.afterCount++;
        } else {
            this.subscribers[s.id] = s;
            this.subCount++;
        }

        return new Y.EventHandle(this, s);

    },

    /**
     * Listen for this event
     * @method subscribe
     * @param {Function} fn The function to execute.
     * @return {EventHandle} Unsubscribe handle.
     * @deprecated use on.
     */
    subscribe: function(fn, context) {
        var a = (arguments.length > 2) ? Y.Array(arguments, 2, true) : null;
        return this._on(fn, context, a, true);
    },

    /**
     * Listen for this event
     * @method on
     * @param {Function} fn The function to execute.
     * @param {object} context optional execution context.
     * @param {mixed} arg* 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {EventHandle} An object with a detach method to detch the handler(s).
     */
    on: function(fn, context) {
        var a = (arguments.length > 2) ? Y.Array(arguments, 2, true) : null;
        if (this.host) {
            this.host._monitor('attach', this.type, {
                args: arguments
            });
        }
        return this._on(fn, context, a, true);
    },

    /**
     * Listen for this event after the normal subscribers have been notified and
     * the default behavior has been applied.  If a normal subscriber prevents the
     * default behavior, it also prevents after listeners from firing.
     * @method after
     * @param {Function} fn The function to execute.
     * @param {object} context optional execution context.
     * @param {mixed} arg* 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {EventHandle} handle Unsubscribe handle.
     */
    after: function(fn, context) {
        var a = (arguments.length > 2) ? Y.Array(arguments, 2, true) : null;
        return this._on(fn, context, a, AFTER);
    },

    /**
     * Detach listeners.
     * @method detach
     * @param {Function} fn  The subscribed function to remove, if not supplied
     *                       all will be removed.
     * @param {Object}   context The context object passed to subscribe.
     * @return {int} returns the number of subscribers unsubscribed.
     */
    detach: function(fn, context) {
        // unsubscribe handle
        if (fn && fn.detach) {
            return fn.detach();
        }

        var i, s,
            found = 0,
            subs = Y.merge(this.subscribers, this.afters);

        for (i in subs) {
            if (subs.hasOwnProperty(i)) {
                s = subs[i];
                if (s && (!fn || fn === s.fn)) {
                    this._delete(s);
                    found++;
                }
            }
        }

        return found;
    },

    /**
     * Detach listeners.
     * @method unsubscribe
     * @param {Function} fn  The subscribed function to remove, if not supplied
     *                       all will be removed.
     * @param {Object}   context The context object passed to subscribe.
     * @return {int|undefined} returns the number of subscribers unsubscribed.
     * @deprecated use detach.
     */
    unsubscribe: function() {
        return this.detach.apply(this, arguments);
    },

    /**
     * Notify a single subscriber
     * @method _notify
     * @param {Subscriber} s the subscriber.
     * @param {Array} args the arguments array to apply to the listener.
     * @private
     */
    _notify: function(s, args, ef) {

        this.log(this.type + '->' + 'sub: ' + s.id);

        var ret;

        ret = s.notify(args, this);

        if (false === ret || this.stopped > 1) {
            this.log(this.type + ' cancelled by subscriber');
            return false;
        }

        return true;
    },

    /**
     * Logger abstraction to centralize the application of the silent flag
     * @method log
     * @param {string} msg message to log.
     * @param {string} cat log category.
     */
    log: function(msg, cat) {
        if (!this.silent) {
        }
    },

    /**
     * Notifies the subscribers.  The callback functions will be executed
     * from the context specified when the event was created, and with the
     * following parameters:
     *   <ul>
     *   <li>The type of event</li>
     *   <li>All of the arguments fire() was executed with as an array</li>
     *   <li>The custom object (if any) that was passed into the subscribe()
     *       method</li>
     *   </ul>
     * @method fire
     * @param {Object*} arguments an arbitrary set of parameters to pass to
     *                            the handler.
     * @return {boolean} false if one of the subscribers returned false,
     *                   true otherwise.
     *
     */
    fire: function() {
        if (this.fireOnce && this.fired) {
            this.log('fireOnce event: ' + this.type + ' already fired');
            return true;
        } else {

            var args = Y.Array(arguments, 0, true);

            // this doesn't happen if the event isn't published
            // this.host._monitor('fire', this.type, args);

            this.fired = true;
            this.firedWith = args;

            if (this.emitFacade) {
                return this.fireComplex(args);
            } else {
                return this.fireSimple(args);
            }
        }
    },

    fireSimple: function(args) {
        this.stopped = 0;
        this.prevented = 0;
        if (this.hasSubs()) {
            // this._procSubs(Y.merge(this.subscribers, this.afters), args);
            var subs = this.getSubs();
            this._procSubs(subs[0], args);
            this._procSubs(subs[1], args);
        }
        this._broadcast(args);
        return this.stopped ? false : true;
    },

    // Requires the event-custom-complex module for full funcitonality.
    fireComplex: function(args) {
        args[0] = args[0] || {};
        return this.fireSimple(args);
    },

    _procSubs: function(subs, args, ef) {
        var s, i;
        for (i in subs) {
            if (subs.hasOwnProperty(i)) {
                s = subs[i];
                if (s && s.fn) {
                    if (false === this._notify(s, args, ef)) {
                        this.stopped = 2;
                    }
                    if (this.stopped == 2) {
                        return false;
                    }
                }
            }
        }

        return true;
    },

    _broadcast: function(args) {
        if (!this.stopped && this.broadcast) {

            var a = Y.Array(args);
            a.unshift(this.type);

            if (this.host !== Y) {
                Y.fire.apply(Y, a);
            }

            if (this.broadcast == 2) {
                Y.Global.fire.apply(Y.Global, a);
            }
        }
    },

    /**
     * Removes all listeners
     * @method unsubscribeAll
     * @return {int} The number of listeners unsubscribed.
     * @deprecated use detachAll.
     */
    unsubscribeAll: function() {
        return this.detachAll.apply(this, arguments);
    },

    /**
     * Removes all listeners
     * @method detachAll
     * @return {int} The number of listeners unsubscribed.
     */
    detachAll: function() {
        return this.detach();
    },

    /**
     * @method _delete
     * @param subscriber object.
     * @private
     */
    _delete: function(s) {
        if (s) {
            if (this.subscribers[s.id]) {
                delete this.subscribers[s.id];
                this.subCount--;
            }
            if (this.afters[s.id]) {
                delete this.afters[s.id];
                this.afterCount--;
            }
        }

        if (this.host) {
            this.host._monitor('detach', this.type, {
                ce: this,
                sub: s
            });
        }

        if (s) {
            // delete s.fn;
            // delete s.context;
            s.deleted = true;
        }
    }
};

/////////////////////////////////////////////////////////////////////

/**
 * Stores the subscriber information to be used when the event fires.
 * @param {Function} fn       The wrapped function to execute.
 * @param {Object}   context  The value of the keyword 'this' in the listener.
 * @param {Array} args*       0..n additional arguments to supply the listener.
 *
 * @class Subscriber
 * @constructor
 */
Y.Subscriber = function(fn, context, args) {

    /**
     * The callback that will be execute when the event fires
     * This is wrapped by Y.rbind if obj was supplied.
     * @property fn
     * @type Function
     */
    this.fn = fn;

    /**
     * Optional 'this' keyword for the listener
     * @property context
     * @type Object
     */
    this.context = context;

    /**
     * Unique subscriber id
     * @property id
     * @type String
     */
    this.id = Y.stamp(this);

    /**
     * Additional arguments to propagate to the subscriber
     * @property args
     * @type Array
     */
    this.args = args;

    /**
     * Custom events for a given fire transaction.
     * @property events
     * @type {EventTarget}
     */
    // this.events = null;

    /**
     * This listener only reacts to the event once
     * @property once
     */
    // this.once = false;

};

Y.Subscriber.prototype = {

    _notify: function(c, args, ce) {
        if (this.deleted && !this.postponed) {
            if (this.postponed) {
                delete this.fn;
                delete this.context;
            } else {
                delete this.postponed;
                return null;
            }
        }
        var a = this.args, ret;
        switch (ce.signature) {
            case 0:
                ret = this.fn.call(c, ce.type, args, c);
                break;
            case 1:
                ret = this.fn.call(c, args[0] || null, c);
                break;
            default:
                if (a || args) {
                    args = args || [];
                    a = (a) ? args.concat(a) : args;
                    ret = this.fn.apply(c, a);
                } else {
                    ret = this.fn.call(c);
                }
        }

        if (this.once) {
            ce._delete(this);
        }

        return ret;
    },

    /**
     * Executes the subscriber.
     * @method notify
     * @param args {Array} Arguments array for the subscriber.
     * @param ce {CustomEvent} The custom event that sent the notification.
     */
    notify: function(args, ce) {
        var c = this.context,
            ret = true;

        if (!c) {
            c = (ce.contextFn) ? ce.contextFn() : ce.context;
        }

        // only catch errors if we will not re-throw them.
        if (Y.config.throwFail) {
            ret = this._notify(c, args, ce);
        } else {
            try {
                ret = this._notify(c, args, ce);
            } catch (e) {
                Y.error(this + ' failed: ' + e.message, e);
            }
        }

        return ret;
    },

    /**
     * Returns true if the fn and obj match this objects properties.
     * Used by the unsubscribe method to match the right subscriber.
     *
     * @method contains
     * @param {Function} fn the function to execute.
     * @param {Object} context optional 'this' keyword for the listener.
     * @return {boolean} true if the supplied arguments match this
     *                   subscriber's signature.
     */
    contains: function(fn, context) {
        if (context) {
            return ((this.fn == fn) && this.context == context);
        } else {
            return (this.fn == fn);
        }
    }

};

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 * @submodule event-custom-base
 */

/**
 * EventTarget provides the implementation for any object to
 * publish, subscribe and fire to custom events, and also
 * alows other EventTargets to target the object with events
 * sourced from the other object.
 * EventTarget is designed to be used with Y.augment to wrap
 * EventCustom in an interface that allows events to be listened to
 * and fired by name.  This makes it possible for implementing code to
 * subscribe to an event that either has not been created yet, or will
 * not be created at all.
 * @class EventTarget
 * @param opts a configuration object
 * @config emitFacade {boolean} if true, all events will emit event
 * facade payloads by default (default false)
 * @config prefix {string} the prefix to apply to non-prefixed event names
 * @config chain {boolean} if true, on/after/detach return the host to allow
 * chaining, otherwise they return an EventHandle (default false)
 */

var L = Y.Lang,
    PREFIX_DELIMITER = ':',
    CATEGORY_DELIMITER = '|',
    AFTER_PREFIX = '~AFTER~',
    YArray = Y.Array,

    _wildType = Y.cached(function(type) {
        return type.replace(/(.*)(:)(.*)/, "*$2$3");
    }),

    /**
     * If the instance has a prefix attribute and the
     * event type is not prefixed, the instance prefix is
     * applied to the supplied type.
     * @method _getType
     * @private
     */
    _getType = Y.cached(function(type, pre) {

        if (!pre || !L.isString(type) || type.indexOf(PREFIX_DELIMITER) > -1) {
            return type;
        }

        return pre + PREFIX_DELIMITER + type;
    }),

    /**
     * Returns an array with the detach key (if provided),
     * and the prefixed event name from _getType
     * Y.on('detachcategory| menu:click', fn)
     * @method _parseType
     * @private
     */
    _parseType = Y.cached(function(type, pre) {

        var t = type, detachcategory, after, i;

        if (!L.isString(t)) {
            return t;
        }

        i = t.indexOf(AFTER_PREFIX);

        if (i > -1) {
            after = true;
            t = t.substr(AFTER_PREFIX.length);
        }

        i = t.indexOf(CATEGORY_DELIMITER);

        if (i > -1) {
            detachcategory = t.substr(0, (i));
            t = t.substr(i+1);
            if (t == '*') {
                t = null;
            }
        }

        // detach category, full type with instance prefix, is this an after listener, short type
        return [detachcategory, (pre) ? _getType(t, pre) : t, after, t];
    }),

    ET = function(opts) {


        var o = (L.isObject(opts)) ? opts : {};

        this._yuievt = this._yuievt || {

            id: Y.guid(),

            events: {},

            targets: {},

            config: o,

            chain: ('chain' in o) ? o.chain : Y.config.chain,

            bubbling: false,

            defaults: {
                context: o.context || this,
                host: this,
                emitFacade: o.emitFacade,
                fireOnce: o.fireOnce,
                queuable: o.queuable,
                monitored: o.monitored,
                broadcast: o.broadcast,
                defaultTargetOnly: o.defaultTargetOnly,
                bubbles: ('bubbles' in o) ? o.bubbles : true
            }
        };

    };


ET.prototype = {

    /**
     * Listen to a custom event hosted by this object one time.
     * This is the equivalent to <code>on</code> except the
     * listener is immediatelly detached when it is executed.
     * @method once
     * @param type    {string}   The type of the event
     * @param fn {Function} The callback
     * @param context {object} optional execution context.
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * @return the event target or a detach handle per 'chain' config
     */
    once: function() {
        var handle = this.on.apply(this, arguments);
        handle.batch(function(hand) {
            if (hand.sub) {
                hand.sub.once = true;
            }
        });
        return handle;
    },

    /**
     * Takes the type parameter passed to 'on' and parses out the
     * various pieces that could be included in the type.  If the
     * event type is passed without a prefix, it will be expanded
     * to include the prefix one is supplied or the event target
     * is configured with a default prefix.
     * @method parseType
     * @param {string} type the type
     * @param {string} [pre=this._yuievt.config.prefix] the prefix
     * @since 3.3.0
     * @return {Array} an array containing:
     *  * the detach category, if supplied,
     *  * the prefixed event type,
     *  * whether or not this is an after listener,
     *  * the supplied event type
     */
    parseType: function(type, pre) {
        return _parseType(type, pre || this._yuievt.config.prefix);
    },

    /**
     * Subscribe to a custom event hosted by this object
     * @method on
     * @param type    {string}   The type of the event
     * @param fn {Function} The callback
     * @param context {object} optional execution context.
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * @return the event target or a detach handle per 'chain' config
     */
    on: function(type, fn, context) {

        var parts = _parseType(type, this._yuievt.config.prefix), f, c, args, ret, ce,
            detachcategory, handle, store = Y.Env.evt.handles, after, adapt, shorttype,
            Node = Y.Node, n, domevent, isArr;

        // full name, args, detachcategory, after
        this._monitor('attach', parts[1], {
            args: arguments,
            category: parts[0],
            after: parts[2]
        });

        if (L.isObject(type)) {

            if (L.isFunction(type)) {
                return Y.Do.before.apply(Y.Do, arguments);
            }

            f = fn;
            c = context;
            args = YArray(arguments, 0, true);
            ret = [];

            if (L.isArray(type)) {
                isArr = true;
            }

            after = type._after;
            delete type._after;

            Y.each(type, function(v, k) {

                if (L.isObject(v)) {
                    f = v.fn || ((L.isFunction(v)) ? v : f);
                    c = v.context || c;
                }

                var nv = (after) ? AFTER_PREFIX : '';

                args[0] = nv + ((isArr) ? v : k);
                args[1] = f;
                args[2] = c;

                ret.push(this.on.apply(this, args));

            }, this);

            return (this._yuievt.chain) ? this : new Y.EventHandle(ret);

        }

        detachcategory = parts[0];
        after = parts[2];
        shorttype = parts[3];

        // extra redirection so we catch adaptor events too.  take a look at this.
        if (Node && Y.instanceOf(this, Node) && (shorttype in Node.DOM_EVENTS)) {
            args = YArray(arguments, 0, true);
            args.splice(2, 0, Node.getDOMNode(this));
            return Y.on.apply(Y, args);
        }

        type = parts[1];

        if (Y.instanceOf(this, YUI)) {

            adapt = Y.Env.evt.plugins[type];
            args  = YArray(arguments, 0, true);
            args[0] = shorttype;

            if (Node) {
                n = args[2];

                if (Y.instanceOf(n, Y.NodeList)) {
                    n = Y.NodeList.getDOMNodes(n);
                } else if (Y.instanceOf(n, Node)) {
                    n = Node.getDOMNode(n);
                }

                domevent = (shorttype in Node.DOM_EVENTS);

                // Captures both DOM events and event plugins.
                if (domevent) {
                    args[2] = n;
                }
            }

            // check for the existance of an event adaptor
            if (adapt) {
                handle = adapt.on.apply(Y, args);
            } else if ((!type) || domevent) {
                handle = Y.Event._attach(args);
            }

        }

        if (!handle) {
            ce = this._yuievt.events[type] || this.publish(type);
            handle = ce._on(fn, context, (arguments.length > 3) ? YArray(arguments, 3, true) : null, (after) ? 'after' : true);
        }

        if (detachcategory) {
            store[detachcategory] = store[detachcategory] || {};
            store[detachcategory][type] = store[detachcategory][type] || [];
            store[detachcategory][type].push(handle);
        }

        return (this._yuievt.chain) ? this : handle;

    },

    /**
     * subscribe to an event
     * @method subscribe
     * @deprecated use on
     */
    subscribe: function() {
        return this.on.apply(this, arguments);
    },

    /**
     * Detach one or more listeners the from the specified event
     * @method detach
     * @param type {string|Object}   Either the handle to the subscriber or the
     *                        type of event.  If the type
     *                        is not specified, it will attempt to remove
     *                        the listener from all hosted events.
     * @param fn   {Function} The subscribed function to unsubscribe, if not
     *                          supplied, all subscribers will be removed.
     * @param context  {Object}   The custom object passed to subscribe.  This is
     *                        optional, but if supplied will be used to
     *                        disambiguate multiple listeners that are the same
     *                        (e.g., you subscribe many object using a function
     *                        that lives on the prototype)
     * @return {EventTarget} the host
     */
    detach: function(type, fn, context) {
        var evts = this._yuievt.events, i,
            Node = Y.Node, isNode = Node && (Y.instanceOf(this, Node));

        // detachAll disabled on the Y instance.
        if (!type && (this !== Y)) {
            for (i in evts) {
                if (evts.hasOwnProperty(i)) {
                    evts[i].detach(fn, context);
                }
            }
            if (isNode) {
                Y.Event.purgeElement(Node.getDOMNode(this));
            }

            return this;
        }

        var parts = _parseType(type, this._yuievt.config.prefix),
        detachcategory = L.isArray(parts) ? parts[0] : null,
        shorttype = (parts) ? parts[3] : null,
        adapt, store = Y.Env.evt.handles, detachhost, cat, args,
        ce,

        keyDetacher = function(lcat, ltype, host) {
            var handles = lcat[ltype], ce, i;
            if (handles) {
                for (i = handles.length - 1; i >= 0; --i) {
                    ce = handles[i].evt;
                    if (ce.host === host || ce.el === host) {
                        handles[i].detach();
                    }
                }
            }
        };

        if (detachcategory) {

            cat = store[detachcategory];
            type = parts[1];
            detachhost = (isNode) ? Y.Node.getDOMNode(this) : this;

            if (cat) {
                if (type) {
                    keyDetacher(cat, type, detachhost);
                } else {
                    for (i in cat) {
                        if (cat.hasOwnProperty(i)) {
                            keyDetacher(cat, i, detachhost);
                        }
                    }
                }

                return this;
            }

        // If this is an event handle, use it to detach
        } else if (L.isObject(type) && type.detach) {
            type.detach();
            return this;
        // extra redirection so we catch adaptor events too.  take a look at this.
        } else if (isNode && ((!shorttype) || (shorttype in Node.DOM_EVENTS))) {
            args = YArray(arguments, 0, true);
            args[2] = Node.getDOMNode(this);
            Y.detach.apply(Y, args);
            return this;
        }

        adapt = Y.Env.evt.plugins[shorttype];

        // The YUI instance handles DOM events and adaptors
        if (Y.instanceOf(this, YUI)) {
            args = YArray(arguments, 0, true);
            // use the adaptor specific detach code if
            if (adapt && adapt.detach) {
                adapt.detach.apply(Y, args);
                return this;
            // DOM event fork
            } else if (!type || (!adapt && Node && (type in Node.DOM_EVENTS))) {
                args[0] = type;
                Y.Event.detach.apply(Y.Event, args);
                return this;
            }
        }

        // ce = evts[type];
        ce = evts[parts[1]];
        if (ce) {
            ce.detach(fn, context);
        }

        return this;
    },

    /**
     * detach a listener
     * @method unsubscribe
     * @deprecated use detach
     */
    unsubscribe: function() {
        return this.detach.apply(this, arguments);
    },

    /**
     * Removes all listeners from the specified event.  If the event type
     * is not specified, all listeners from all hosted custom events will
     * be removed.
     * @method detachAll
     * @param type {string}   The type, or name of the event
     */
    detachAll: function(type) {
        return this.detach(type);
    },

    /**
     * Removes all listeners from the specified event.  If the event type
     * is not specified, all listeners from all hosted custom events will
     * be removed.
     * @method unsubscribeAll
     * @param type {string}   The type, or name of the event
     * @deprecated use detachAll
     */
    unsubscribeAll: function() {
        return this.detachAll.apply(this, arguments);
    },

    /**
     * Creates a new custom event of the specified type.  If a custom event
     * by that name already exists, it will not be re-created.  In either
     * case the custom event is returned.
     *
     * @method publish
     *
     * @param type {string} the type, or name of the event
     * @param opts {object} optional config params.  Valid properties are:
     *
     *  <ul>
     *    <li>
     *   'broadcast': whether or not the YUI instance and YUI global are notified when the event is fired (false)
     *    </li>
     *    <li>
     *   'bubbles': whether or not this event bubbles (true)
     *              Events can only bubble if emitFacade is true.
     *    </li>
     *    <li>
     *   'context': the default execution context for the listeners (this)
     *    </li>
     *    <li>
     *   'defaultFn': the default function to execute when this event fires if preventDefault was not called
     *    </li>
     *    <li>
     *   'emitFacade': whether or not this event emits a facade (false)
     *    </li>
     *    <li>
     *   'prefix': the prefix for this targets events, e.g., 'menu' in 'menu:click'
     *    </li>
     *    <li>
     *   'fireOnce': if an event is configured to fire once, new subscribers after
     *   the fire will be notified immediately.
     *    </li>
     *    <li>
     *   'async': fireOnce event listeners will fire synchronously if the event has already
     *    fired unless async is true.
     *    </li>
     *    <li>
     *   'preventable': whether or not preventDefault() has an effect (true)
     *    </li>
     *    <li>
     *   'preventedFn': a function that is executed when preventDefault is called
     *    </li>
     *    <li>
     *   'queuable': whether or not this event can be queued during bubbling (false)
     *    </li>
     *    <li>
     *   'silent': if silent is true, debug messages are not provided for this event.
     *    </li>
     *    <li>
     *   'stoppedFn': a function that is executed when stopPropagation is called
     *    </li>
     *
     *    <li>
     *   'monitored': specifies whether or not this event should send notifications about
     *   when the event has been attached, detached, or published.
     *    </li>
     *    <li>
     *   'type': the event type (valid option if not provided as the first parameter to publish)
     *    </li>
     *  </ul>
     *
     *  @return {CustomEvent} the custom event
     *
     */
    publish: function(type, opts) {
        var events, ce, ret, defaults,
            edata    = this._yuievt,
            pre      = edata.config.prefix;

        type = (pre) ? _getType(type, pre) : type;

        this._monitor('publish', type, {
            args: arguments
        });

        if (L.isObject(type)) {
            ret = {};
            Y.each(type, function(v, k) {
                ret[k] = this.publish(k, v || opts);
            }, this);

            return ret;
        }

        events = edata.events;
        ce = events[type];

        if (ce) {
// ce.log("publish applying new config to published event: '"+type+"' exists", 'info', 'event');
            if (opts) {
                ce.applyConfig(opts, true);
            }
        } else {

            defaults = edata.defaults;

            // apply defaults
            ce = new Y.CustomEvent(type,
                                  (opts) ? Y.merge(defaults, opts) : defaults);
            events[type] = ce;
        }

        // make sure we turn the broadcast flag off if this
        // event was published as a result of bubbling
        // if (opts instanceof Y.CustomEvent) {
          //   events[type].broadcast = false;
        // }

        return events[type];
    },

    /**
     * This is the entry point for the event monitoring system.
     * You can monitor 'attach', 'detach', 'fire', and 'publish'.
     * When configured, these events generate an event.  click ->
     * click_attach, click_detach, click_publish -- these can
     * be subscribed to like other events to monitor the event
     * system.  Inividual published events can have monitoring
     * turned on or off (publish can't be turned off before it
     * it published) by setting the events 'monitor' config.
     *
     * @private
     */
    _monitor: function(what, type, o) {
        var monitorevt, ce = this.getEvent(type);
        if ((this._yuievt.config.monitored && (!ce || ce.monitored)) || (ce && ce.monitored)) {
            monitorevt = type + '_' + what;
            o.monitored = what;
            this.fire.call(this, monitorevt, o);
        }
    },

   /**
     * Fire a custom event by name.  The callback functions will be executed
     * from the context specified when the event was created, and with the
     * following parameters.
     *
     * If the custom event object hasn't been created, then the event hasn't
     * been published and it has no subscribers.  For performance sake, we
     * immediate exit in this case.  This means the event won't bubble, so
     * if the intention is that a bubble target be notified, the event must
     * be published on this object first.
     *
     * The first argument is the event type, and any additional arguments are
     * passed to the listeners as parameters.  If the first of these is an
     * object literal, and the event is configured to emit an event facade,
     * that object is mixed into the event facade and the facade is provided
     * in place of the original object.
     *
     * @method fire
     * @param type {String|Object} The type of the event, or an object that contains
     * a 'type' property.
     * @param arguments {Object*} an arbitrary set of parameters to pass to
     * the handler.  If the first of these is an object literal and the event is
     * configured to emit an event facade, the event facade will replace that
     * parameter after the properties the object literal contains are copied to
     * the event facade.
     * @return {EventTarget} the event host
     *
     */
    fire: function(type) {

        var typeIncluded = L.isString(type),
            t = (typeIncluded) ? type : (type && type.type),
            ce, ret, pre = this._yuievt.config.prefix, ce2,
            args = (typeIncluded) ? YArray(arguments, 1, true) : arguments;

        t = (pre) ? _getType(t, pre) : t;

        this._monitor('fire', t, {
            args: args
        });

        ce = this.getEvent(t, true);
        ce2 = this.getSibling(t, ce);

        if (ce2 && !ce) {
            ce = this.publish(t);
        }

        // this event has not been published or subscribed to
        if (!ce) {
            if (this._yuievt.hasTargets) {
                return this.bubble({ type: t }, args, this);
            }

            // otherwise there is nothing to be done
            ret = true;
        } else {
            ce.sibling = ce2;
            ret = ce.fire.apply(ce, args);
        }

        return (this._yuievt.chain) ? this : ret;
    },

    getSibling: function(type, ce) {
        var ce2;
        // delegate to *:type events if there are subscribers
        if (type.indexOf(PREFIX_DELIMITER) > -1) {
            type = _wildType(type);
            // console.log(type);
            ce2 = this.getEvent(type, true);
            if (ce2) {
                // console.log("GOT ONE: " + type);
                ce2.applyConfig(ce);
                ce2.bubbles = false;
                ce2.broadcast = 0;
                // ret = ce2.fire.apply(ce2, a);
            }
        }

        return ce2;
    },

    /**
     * Returns the custom event of the provided type has been created, a
     * falsy value otherwise
     * @method getEvent
     * @param type {string} the type, or name of the event
     * @param prefixed {string} if true, the type is prefixed already
     * @return {CustomEvent} the custom event or null
     */
    getEvent: function(type, prefixed) {
        var pre, e;
        if (!prefixed) {
            pre = this._yuievt.config.prefix;
            type = (pre) ? _getType(type, pre) : type;
        }
        e = this._yuievt.events;
        return e[type] || null;
    },

    /**
     * Subscribe to a custom event hosted by this object.  The
     * supplied callback will execute after any listeners add
     * via the subscribe method, and after the default function,
     * if configured for the event, has executed.
     * @method after
     * @param type    {string}   The type of the event
     * @param fn {Function} The callback
     * @param context {object} optional execution context.
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * @return the event target or a detach handle per 'chain' config
     */
    after: function(type, fn) {

        var a = YArray(arguments, 0, true);

        switch (L.type(type)) {
            case 'function':
                return Y.Do.after.apply(Y.Do, arguments);
            case 'array':
            //     YArray.each(a[0], function(v) {
            //         v = AFTER_PREFIX + v;
            //     });
            //     break;
            case 'object':
                a[0]._after = true;
                break;
            default:
                a[0] = AFTER_PREFIX + type;
        }

        return this.on.apply(this, a);

    },

    /**
     * Executes the callback before a DOM event, custom event
     * or method.  If the first argument is a function, it
     * is assumed the target is a method.  For DOM and custom
     * events, this is an alias for Y.on.
     *
     * For DOM and custom events:
     * type, callback, context, 0-n arguments
     *
     * For methods:
     * callback, object (method host), methodName, context, 0-n arguments
     *
     * @method before
     * @return detach handle
     */
    before: function() {
        return this.on.apply(this, arguments);
    }

};

Y.EventTarget = ET;

// make Y an event target
Y.mix(Y, ET.prototype, false, false, {
    bubbles: false
});

ET.call(Y);

YUI.Env.globalEvents = YUI.Env.globalEvents || new ET();

/**
 * Hosts YUI page level events.  This is where events bubble to
 * when the broadcast config is set to 2.  This property is
 * only available if the custom event module is loaded.
 * @property Global
 * @type EventTarget
 * @for YUI
 */
Y.Global = YUI.Env.globalEvents;

// @TODO implement a global namespace function on Y.Global?

/**
 * <code>YUI</code>'s <code>on</code> method is a unified interface for subscribing to
 * most events exposed by YUI.  This includes custom events, DOM events, and
 * function events.  <code>detach</code> is also provided to remove listeners
 * serviced by this function.
 *
 * The signature that <code>on</code> accepts varies depending on the type
 * of event being consumed.  Refer to the specific methods that will
 * service a specific request for additional information about subscribing
 * to that type of event.
 *
 * <ul>
 * <li>Custom events.  These events are defined by various
 * modules in the library.  This type of event is delegated to
 * <code>EventTarget</code>'s <code>on</code> method.
 *   <ul>
 *     <li>The type of the event</li>
 *     <li>The callback to execute</li>
 *     <li>An optional context object</li>
 *     <li>0..n additional arguments to supply the callback.</li>
 *   </ul>
 *   Example:
 *   <code>Y.on('drag:drophit', function() { // start work });</code>
 * </li>
 * <li>DOM events.  These are moments reported by the browser related
 * to browser functionality and user interaction.
 * This type of event is delegated to <code>Event</code>'s
 * <code>attach</code> method.
 *   <ul>
 *     <li>The type of the event</li>
 *     <li>The callback to execute</li>
 *     <li>The specification for the Node(s) to attach the listener
 *     to.  This can be a selector, collections, or Node/Element
 *     refereces.</li>
 *     <li>An optional context object</li>
 *     <li>0..n additional arguments to supply the callback.</li>
 *   </ul>
 *   Example:
 *   <code>Y.on('click', function(e) { // something was clicked }, '#someelement');</code>
 * </li>
 * <li>Function events.  These events can be used to react before or after a
 * function is executed.  This type of event is delegated to <code>Event.Do</code>'s
 * <code>before</code> method.
 *   <ul>
 *     <li>The callback to execute</li>
 *     <li>The object that has the function that will be listened for.</li>
 *     <li>The name of the function to listen for.</li>
 *     <li>An optional context object</li>
 *     <li>0..n additional arguments to supply the callback.</li>
 *   </ul>
 *   Example <code>Y.on(function(arg1, arg2, etc) { // obj.methodname was executed }, obj 'methodname');</code>
 * </li>
 * </ul>
 *
 * <code>on</code> corresponds to the moment before any default behavior of
 * the event.  <code>after</code> works the same way, but these listeners
 * execute after the event's default behavior.  <code>before</code> is an
 * alias for <code>on</code>.
 *
 * @method on
 * @param type event type (this parameter does not apply for function events)
 * @param fn the callback
 * @param context optionally change the value of 'this' in the callback
 * @param args* 0..n additional arguments to pass to the callback.
 * @return the event target or a detach handle per 'chain' config
 * @for YUI
 */

 /**
  * Listen for an event one time.  Equivalent to <code>on</code>, except that
  * the listener is immediately detached when executed.
  * @see on
  * @method once
  * @param type event type (this parameter does not apply for function events)
  * @param fn the callback
  * @param context optionally change the value of 'this' in the callback
  * @param args* 0..n additional arguments to pass to the callback.
  * @return the event target or a detach handle per 'chain' config
  * @for YUI
  */

/**
 * after() is a unified interface for subscribing to
 * most events exposed by YUI.  This includes custom events,
 * DOM events, and AOP events.  This works the same way as
 * the on() function, only it operates after any default
 * behavior for the event has executed. @see <code>on</code> for more
 * information.
 * @method after
 * @param type event type (this parameter does not apply for function events)
 * @param fn the callback
 * @param context optionally change the value of 'this' in the callback
 * @param args* 0..n additional arguments to pass to the callback.
 * @return the event target or a detach handle per 'chain' config
 * @for YUI
 */


}, '3.3.0' ,{requires:['oop']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
var GLOBAL_ENV = YUI.Env;

if (!GLOBAL_ENV._ready) {
    GLOBAL_ENV._ready = function() {
        GLOBAL_ENV.DOMReady = true;
        GLOBAL_ENV.remove(YUI.config.doc, 'DOMContentLoaded', GLOBAL_ENV._ready);
    };

    // if (!YUI.UA.ie) {
        GLOBAL_ENV.add(YUI.config.doc, 'DOMContentLoaded', GLOBAL_ENV._ready);
    // }
}

YUI.add('event-base', function(Y) {

/*
 * DOM event listener abstraction layer
 * @module event
 * @submodule event-base
 */

/**
 * The domready event fires at the moment the browser's DOM is
 * usable. In most cases, this is before images are fully
 * downloaded, allowing you to provide a more responsive user
 * interface.
 *
 * In YUI 3, domready subscribers will be notified immediately if
 * that moment has already passed when the subscription is created.
 *
 * One exception is if the yui.js file is dynamically injected into
 * the page.  If this is done, you must tell the YUI instance that
 * you did this in order for DOMReady (and window load events) to
 * fire normally.  That configuration option is 'injected' -- set
 * it to true if the yui.js script is not included inline.
 *
 * This method is part of the 'event-ready' module, which is a
 * submodule of 'event'.
 *
 * @event domready
 * @for YUI
 */
Y.publish('domready', {
    fireOnce: true,
    async: true
});

if (GLOBAL_ENV.DOMReady) {
    Y.fire('domready');
} else {
    Y.Do.before(function() { Y.fire('domready'); }, YUI.Env, '_ready');
}

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event
 * @submodule event-base
 */

/**
 * Wraps a DOM event, properties requiring browser abstraction are
 * fixed here.  Provids a security layer when required.
 * @class DOMEventFacade
 * @param ev {Event} the DOM event
 * @param currentTarget {HTMLElement} the element the listener was attached to
 * @param wrapper {Event.Custom} the custom event wrapper for this DOM event
 */

    var ua = Y.UA,

    EMPTY = {},

    /**
     * webkit key remapping required for Safari < 3.1
     * @property webkitKeymap
     * @private
     */
    webkitKeymap = {
        63232: 38, // up
        63233: 40, // down
        63234: 37, // left
        63235: 39, // right
        63276: 33, // page up
        63277: 34, // page down
        25:     9, // SHIFT-TAB (Safari provides a different key code in
                   // this case, even though the shiftKey modifier is set)
        63272: 46, // delete
        63273: 36, // home
        63275: 35  // end
    },

    /**
     * Returns a wrapped node.  Intended to be used on event targets,
     * so it will return the node's parent if the target is a text
     * node.
     *
     * If accessing a property of the node throws an error, this is
     * probably the anonymous div wrapper Gecko adds inside text
     * nodes.  This likely will only occur when attempting to access
     * the relatedTarget.  In this case, we now return null because
     * the anonymous div is completely useless and we do not know
     * what the related target was because we can't even get to
     * the element's parent node.
     *
     * @method resolve
     * @private
     */
    resolve = function(n) {
        if (!n) {
            return n;
        }
        try {
            if (n && 3 == n.nodeType) {
                n = n.parentNode;
            }
        } catch(e) {
            return null;
        }

        return Y.one(n);
    },

    DOMEventFacade = function(ev, currentTarget, wrapper) {
        this._event = ev;
        this._currentTarget = currentTarget;
        this._wrapper = wrapper || EMPTY;

        // if not lazy init
        this.init();
    };

Y.extend(DOMEventFacade, Object, {

    init: function() {

        var e = this._event,
            overrides = this._wrapper.overrides,
            x = e.pageX,
            y = e.pageY,
            c,
            currentTarget = this._currentTarget;

        this.altKey   = e.altKey;
        this.ctrlKey  = e.ctrlKey;
        this.metaKey  = e.metaKey;
        this.shiftKey = e.shiftKey;
        this.type     = (overrides && overrides.type) || e.type;
        this.clientX  = e.clientX;
        this.clientY  = e.clientY;

        this.pageX = x;
        this.pageY = y;

        c = e.keyCode || e.charCode;

        if (ua.webkit && (c in webkitKeymap)) {
            c = webkitKeymap[c];
        }

        this.keyCode = c;
        this.charCode = c;
        this.which = e.which || e.charCode || c;
        // this.button = e.button;
        this.button = this.which;

        this.target = resolve(e.target);
        this.currentTarget = resolve(currentTarget);
        this.relatedTarget = resolve(e.relatedTarget);

        if (e.type == "mousewheel" || e.type == "DOMMouseScroll") {
            this.wheelDelta = (e.detail) ? (e.detail * -1) : Math.round(e.wheelDelta / 80) || ((e.wheelDelta < 0) ? -1 : 1);
        }

        if (this._touch) {
            this._touch(e, currentTarget, this._wrapper);
        }
    },

    stopPropagation: function() {
        this._event.stopPropagation();
        this._wrapper.stopped = 1;
        this.stopped = 1;
    },

    stopImmediatePropagation: function() {
        var e = this._event;
        if (e.stopImmediatePropagation) {
            e.stopImmediatePropagation();
        } else {
            this.stopPropagation();
        }
        this._wrapper.stopped = 2;
        this.stopped = 2;
    },

    preventDefault: function(returnValue) {
        var e = this._event;
        e.preventDefault();
        e.returnValue = returnValue || false;
        this._wrapper.prevented = 1;
        this.prevented = 1;
    },

    halt: function(immediate) {
        if (immediate) {
            this.stopImmediatePropagation();
        } else {
            this.stopPropagation();
        }

        this.preventDefault();
    }

});

DOMEventFacade.resolve = resolve;
Y.DOM2EventFacade = DOMEventFacade;
Y.DOMEventFacade = DOMEventFacade;

    /**
     * The native event
     * @property _event
     */

    /**
     * The X location of the event on the page (including scroll)
     * @property pageX
     * @type int
     */

    /**
     * The Y location of the event on the page (including scroll)
     * @property pageY
     * @type int
     */

    /**
     * The keyCode for key events.  Uses charCode if keyCode is not available
     * @property keyCode
     * @type int
     */

    /**
     * The charCode for key events.  Same as keyCode
     * @property charCode
     * @type int
     */

    /**
     * The button that was pushed.
     * @property button
     * @type int
     */

    /**
     * The button that was pushed.  Same as button.
     * @property which
     * @type int
     */

    /**
     * Node reference for the targeted element
     * @propery target
     * @type Node
     */

    /**
     * Node reference for the element that the listener was attached to.
     * @propery currentTarget
     * @type Node
     */

    /**
     * Node reference to the relatedTarget
     * @propery relatedTarget
     * @type Node
     */

    /**
     * Number representing the direction and velocity of the movement of the mousewheel.
     * Negative is down, the higher the number, the faster.  Applies to the mousewheel event.
     * @property wheelDelta
     * @type int
     */

    /**
     * Stops the propagation to the next bubble target
     * @method stopPropagation
     */

    /**
     * Stops the propagation to the next bubble target and
     * prevents any additional listeners from being exectued
     * on the current target.
     * @method stopImmediatePropagation
     */

    /**
     * Prevents the event's default behavior
     * @method preventDefault
     * @param returnValue {string} sets the returnValue of the event to this value
     * (rather than the default false value).  This can be used to add a customized
     * confirmation query to the beforeunload event).
     */

    /**
     * Stops the event propagation and prevents the default
     * event behavior.
     * @method halt
     * @param immediate {boolean} if true additional listeners
     * on the current target will not be executed
     */
(function() {
/**
 * DOM event listener abstraction layer
 * @module event
 * @submodule event-base
 */

/**
 * The event utility provides functions to add and remove event listeners,
 * event cleansing.  It also tries to automatically remove listeners it
 * registers during the unload event.
 *
 * @class Event
 * @static
 */

Y.Env.evt.dom_wrappers = {};
Y.Env.evt.dom_map = {};

var _eventenv = Y.Env.evt,
    config = Y.config,
    win = config.win,
    add = YUI.Env.add,
    remove = YUI.Env.remove,

    onLoad = function() {
        YUI.Env.windowLoaded = true;
        Y.Event._load();
        remove(win, "load", onLoad);
    },

    onUnload = function() {
        Y.Event._unload();
    },

    EVENT_READY = 'domready',

    COMPAT_ARG = '~yui|2|compat~',

    shouldIterate = function(o) {
        try {
            return (o && typeof o !== "string" && Y.Lang.isNumber(o.length) &&
                    !o.tagName && !o.alert);
        } catch(ex) {
            return false;
        }

    },

Event = function() {

    /**
     * True after the onload event has fired
     * @property _loadComplete
     * @type boolean
     * @static
     * @private
     */
    var _loadComplete =  false,

    /**
     * The number of times to poll after window.onload.  This number is
     * increased if additional late-bound handlers are requested after
     * the page load.
     * @property _retryCount
     * @static
     * @private
     */
    _retryCount = 0,

    /**
     * onAvailable listeners
     * @property _avail
     * @static
     * @private
     */
    _avail = [],

    /**
     * Custom event wrappers for DOM events.  Key is
     * 'event:' + Element uid stamp + event type
     * @property _wrappers
     * @type Y.Event.Custom
     * @static
     * @private
     */
    _wrappers = _eventenv.dom_wrappers,

    _windowLoadKey = null,

    /**
     * Custom event wrapper map DOM events.  Key is
     * Element uid stamp.  Each item is a hash of custom event
     * wrappers as provided in the _wrappers collection.  This
     * provides the infrastructure for getListeners.
     * @property _el_events
     * @static
     * @private
     */
    _el_events = _eventenv.dom_map;

    return {

        /**
         * The number of times we should look for elements that are not
         * in the DOM at the time the event is requested after the document
         * has been loaded.  The default is 1000@amp;40 ms, so it will poll
         * for 40 seconds or until all outstanding handlers are bound
         * (whichever comes first).
         * @property POLL_RETRYS
         * @type int
         * @static
         * @final
         */
        POLL_RETRYS: 1000,

        /**
         * The poll interval in milliseconds
         * @property POLL_INTERVAL
         * @type int
         * @static
         * @final
         */
        POLL_INTERVAL: 40,

        /**
         * addListener/removeListener can throw errors in unexpected scenarios.
         * These errors are suppressed, the method returns false, and this property
         * is set
         * @property lastError
         * @static
         * @type Error
         */
        lastError: null,


        /**
         * poll handle
         * @property _interval
         * @static
         * @private
         */
        _interval: null,

        /**
         * document readystate poll handle
         * @property _dri
         * @static
         * @private
         */
         _dri: null,

        /**
         * True when the document is initially usable
         * @property DOMReady
         * @type boolean
         * @static
         */
        DOMReady: false,

        /**
         * @method startInterval
         * @static
         * @private
         */
        startInterval: function() {
            if (!Event._interval) {
Event._interval = setInterval(Event._poll, Event.POLL_INTERVAL);
            }
        },

        /**
         * Executes the supplied callback when the item with the supplied
         * id is found.  This is meant to be used to execute behavior as
         * soon as possible as the page loads.  If you use this after the
         * initial page load it will poll for a fixed time for the element.
         * The number of times it will poll and the frequency are
         * configurable.  By default it will poll for 10 seconds.
         *
         * <p>The callback is executed with a single parameter:
         * the custom object parameter, if provided.</p>
         *
         * @method onAvailable
         *
         * @param {string||string[]}   id the id of the element, or an array
         * of ids to look for.
         * @param {function} fn what to execute when the element is found.
         * @param {object}   p_obj an optional object to be passed back as
         *                   a parameter to fn.
         * @param {boolean|object}  p_override If set to true, fn will execute
         *                   in the context of p_obj, if set to an object it
         *                   will execute in the context of that object
         * @param checkContent {boolean} check child node readiness (onContentReady)
         * @static
         * @deprecated Use Y.on("available")
         */
        // @TODO fix arguments
        onAvailable: function(id, fn, p_obj, p_override, checkContent, compat) {

            var a = Y.Array(id), i, availHandle;


            for (i=0; i<a.length; i=i+1) {
                _avail.push({
                    id:         a[i],
                    fn:         fn,
                    obj:        p_obj,
                    override:   p_override,
                    checkReady: checkContent,
                    compat:     compat
                });
            }
            _retryCount = this.POLL_RETRYS;

            // We want the first test to be immediate, but async
            setTimeout(Event._poll, 0);

            availHandle = new Y.EventHandle({

                _delete: function() {
                    // set by the event system for lazy DOM listeners
                    if (availHandle.handle) {
                        availHandle.handle.detach();
                        return;
                    }

                    var i, j;

                    // otherwise try to remove the onAvailable listener(s)
                    for (i = 0; i < a.length; i++) {
                        for (j = 0; j < _avail.length; j++) {
                            if (a[i] === _avail[j].id) {
                                _avail.splice(j, 1);
                            }
                        }
                    }
                }

            });

            return availHandle;
        },

        /**
         * Works the same way as onAvailable, but additionally checks the
         * state of sibling elements to determine if the content of the
         * available element is safe to modify.
         *
         * <p>The callback is executed with a single parameter:
         * the custom object parameter, if provided.</p>
         *
         * @method onContentReady
         *
         * @param {string}   id the id of the element to look for.
         * @param {function} fn what to execute when the element is ready.
         * @param {object}   obj an optional object to be passed back as
         *                   a parameter to fn.
         * @param {boolean|object}  override If set to true, fn will execute
         *                   in the context of p_obj.  If an object, fn will
         *                   exectute in the context of that object
         *
         * @static
         * @deprecated Use Y.on("contentready")
         */
        // @TODO fix arguments
        onContentReady: function(id, fn, obj, override, compat) {
            return Event.onAvailable(id, fn, obj, override, true, compat);
        },

        /**
         * Adds an event listener
         *
         * @method attach
         *
         * @param {String}   type     The type of event to append
         * @param {Function} fn        The method the event invokes
         * @param {String|HTMLElement|Array|NodeList} el An id, an element
         *  reference, or a collection of ids and/or elements to assign the
         *  listener to.
         * @param {Object}   context optional context object
         * @param {Boolean|object}  args 0..n arguments to pass to the callback
         * @return {EventHandle} an object to that can be used to detach the listener
         *
         * @static
         */

        attach: function(type, fn, el, context) {
            return Event._attach(Y.Array(arguments, 0, true));
        },

        _createWrapper: function (el, type, capture, compat, facade) {

            var cewrapper,
                ek  = Y.stamp(el),
                key = 'event:' + ek + type;

            if (false === facade) {
                key += 'native';
            }
            if (capture) {
                key += 'capture';
            }


            cewrapper = _wrappers[key];


            if (!cewrapper) {
                // create CE wrapper
                cewrapper = Y.publish(key, {
                    silent: true,
                    bubbles: false,
                    contextFn: function() {
                        if (compat) {
                            return cewrapper.el;
                        } else {
                            cewrapper.nodeRef = cewrapper.nodeRef || Y.one(cewrapper.el);
                            return cewrapper.nodeRef;
                        }
                    }
                });

                cewrapper.overrides = {};

                // for later removeListener calls
                cewrapper.el = el;
                cewrapper.key = key;
                cewrapper.domkey = ek;
                cewrapper.type = type;
                cewrapper.fn = function(e) {
                    cewrapper.fire(Event.getEvent(e, el, (compat || (false === facade))));
                };
                cewrapper.capture = capture;

                if (el == win && type == "load") {
                    // window load happens once
                    cewrapper.fireOnce = true;
                    _windowLoadKey = key;
                }

                _wrappers[key] = cewrapper;
                _el_events[ek] = _el_events[ek] || {};
                _el_events[ek][key] = cewrapper;

                add(el, type, cewrapper.fn, capture);
            }

            return cewrapper;

        },

        _attach: function(args, conf) {

            var compat,
                handles, oEl, cewrapper, context,
                fireNow = false, ret,
                type = args[0],
                fn = args[1],
                el = args[2] || win,
                facade = conf && conf.facade,
                capture = conf && conf.capture,
                overrides = conf && conf.overrides;

            if (args[args.length-1] === COMPAT_ARG) {
                compat = true;
                // trimmedArgs.pop();
            }

            if (!fn || !fn.call) {
// throw new TypeError(type + " attach call failed, callback undefined");
                return false;
            }

            // The el argument can be an array of elements or element ids.
            if (shouldIterate(el)) {

                handles=[];

                Y.each(el, function(v, k) {
                    args[2] = v;
                    handles.push(Event._attach(args, conf));
                });

                // return (handles.length === 1) ? handles[0] : handles;
                return new Y.EventHandle(handles);

            // If the el argument is a string, we assume it is
            // actually the id of the element.  If the page is loaded
            // we convert el to the actual element, otherwise we
            // defer attaching the event until the element is
            // ready
            } else if (Y.Lang.isString(el)) {

                // oEl = (compat) ? Y.DOM.byId(el) : Y.Selector.query(el);

                if (compat) {
                    oEl = Y.DOM.byId(el);
                } else {

                    oEl = Y.Selector.query(el);

                    switch (oEl.length) {
                        case 0:
                            oEl = null;
                            break;
                        case 1:
                            oEl = oEl[0];
                            break;
                        default:
                            args[2] = oEl;
                            return Event._attach(args, conf);
                    }
                }

                if (oEl) {

                    el = oEl;

                // Not found = defer adding the event until the element is available
                } else {

                    ret = Event.onAvailable(el, function() {

                        ret.handle = Event._attach(args, conf);

                    }, Event, true, false, compat);

                    return ret;

                }
            }

            // Element should be an html element or node
            if (!el) {
                return false;
            }

            if (Y.Node && Y.instanceOf(el, Y.Node)) {
                el = Y.Node.getDOMNode(el);
            }

            cewrapper = Event._createWrapper(el, type, capture, compat, facade);
            if (overrides) {
                Y.mix(cewrapper.overrides, overrides);
            }

            if (el == win && type == "load") {

                // if the load is complete, fire immediately.
                // all subscribers, including the current one
                // will be notified.
                if (YUI.Env.windowLoaded) {
                    fireNow = true;
                }
            }

            if (compat) {
                args.pop();
            }

            context = args[3];

            // set context to the Node if not specified
            // ret = cewrapper.on.apply(cewrapper, trimmedArgs);
            ret = cewrapper._on(fn, context, (args.length > 4) ? args.slice(4) : null);

            if (fireNow) {
                cewrapper.fire();
            }

            return ret;

        },

        /**
         * Removes an event listener.  Supports the signature the event was bound
         * with, but the preferred way to remove listeners is using the handle
         * that is returned when using Y.on
         *
         * @method detach
         *
         * @param {String} type the type of event to remove.
         * @param {Function} fn the method the event invokes.  If fn is
         * undefined, then all event handlers for the type of event are
         * removed.
         * @param {String|HTMLElement|Array|NodeList|EventHandle} el An
         * event handle, an id, an element reference, or a collection
         * of ids and/or elements to remove the listener from.
         * @return {boolean} true if the unbind was successful, false otherwise.
         * @static
         */
        detach: function(type, fn, el, obj) {

            var args=Y.Array(arguments, 0, true), compat, l, ok, i,
                id, ce;

            if (args[args.length-1] === COMPAT_ARG) {
                compat = true;
                // args.pop();
            }

            if (type && type.detach) {
                return type.detach();
            }

            // The el argument can be a string
            if (typeof el == "string") {

                // el = (compat) ? Y.DOM.byId(el) : Y.all(el);
                if (compat) {
                    el = Y.DOM.byId(el);
                } else {
                    el = Y.Selector.query(el);
                    l = el.length;
                    if (l < 1) {
                        el = null;
                    } else if (l == 1) {
                        el = el[0];
                    }
                }
                // return Event.detach.apply(Event, args);
            }

            if (!el) {
                return false;
            }

            if (el.detach) {
                args.splice(2, 1);
                return el.detach.apply(el, args);
            // The el argument can be an array of elements or element ids.
            } else if (shouldIterate(el)) {
                ok = true;
                for (i=0, l=el.length; i<l; ++i) {
                    args[2] = el[i];
                    ok = ( Y.Event.detach.apply(Y.Event, args) && ok );
                }

                return ok;
            }

            if (!type || !fn || !fn.call) {
                return Event.purgeElement(el, false, type);
            }

            id = 'event:' + Y.stamp(el) + type;
            ce = _wrappers[id];

            if (ce) {
                return ce.detach(fn);
            } else {
                return false;
            }

        },

        /**
         * Finds the event in the window object, the caller's arguments, or
         * in the arguments of another method in the callstack.  This is
         * executed automatically for events registered through the event
         * manager, so the implementer should not normally need to execute
         * this function at all.
         * @method getEvent
         * @param {Event} e the event parameter from the handler
         * @param {HTMLElement} el the element the listener was attached to
         * @return {Event} the event
         * @static
         */
        getEvent: function(e, el, noFacade) {
            var ev = e || win.event;

            return (noFacade) ? ev :
                new Y.DOMEventFacade(ev, el, _wrappers['event:' + Y.stamp(el) + e.type]);
        },

        /**
         * Generates an unique ID for the element if it does not already
         * have one.
         * @method generateId
         * @param el the element to create the id for
         * @return {string} the resulting id of the element
         * @static
         */
        generateId: function(el) {
            return Y.DOM.generateID(el);
        },

        /**
         * We want to be able to use getElementsByTagName as a collection
         * to attach a group of events to.  Unfortunately, different
         * browsers return different types of collections.  This function
         * tests to determine if the object is array-like.  It will also
         * fail if the object is an array, but is empty.
         * @method _isValidCollection
         * @param o the object to test
         * @return {boolean} true if the object is array-like and populated
         * @deprecated was not meant to be used directly
         * @static
         * @private
         */
        _isValidCollection: shouldIterate,

        /**
         * hook up any deferred listeners
         * @method _load
         * @static
         * @private
         */
        _load: function(e) {
            if (!_loadComplete) {
                _loadComplete = true;

                // Just in case DOMReady did not go off for some reason
                // E._ready();
                if (Y.fire) {
                    Y.fire(EVENT_READY);
                }

                // Available elements may not have been detected before the
                // window load event fires. Try to find them now so that the
                // the user is more likely to get the onAvailable notifications
                // before the window load notification
                Event._poll();
            }
        },

        /**
         * Polling function that runs before the onload event fires,
         * attempting to attach to DOM Nodes as soon as they are
         * available
         * @method _poll
         * @static
         * @private
         */
        _poll: function() {
            if (Event.locked) {
                return;
            }

            if (Y.UA.ie && !YUI.Env.DOMReady) {
                // Hold off if DOMReady has not fired and check current
                // readyState to protect against the IE operation aborted
                // issue.
                Event.startInterval();
                return;
            }

            Event.locked = true;

            // keep trying until after the page is loaded.  We need to
            // check the page load state prior to trying to bind the
            // elements so that we can be certain all elements have been
            // tested appropriately
            var i, len, item, el, notAvail, executeItem,
                tryAgain = !_loadComplete;

            if (!tryAgain) {
                tryAgain = (_retryCount > 0);
            }

            // onAvailable
            notAvail = [];

            executeItem = function (el, item) {
                var context, ov = item.override;
                if (item.compat) {
                    if (item.override) {
                        if (ov === true) {
                            context = item.obj;
                        } else {
                            context = ov;
                        }
                    } else {
                        context = el;
                    }
                    item.fn.call(context, item.obj);
                } else {
                    context = item.obj || Y.one(el);
                    item.fn.apply(context, (Y.Lang.isArray(ov)) ? ov : []);
                }
            };

            // onAvailable
            for (i=0,len=_avail.length; i<len; ++i) {
                item = _avail[i];
                if (item && !item.checkReady) {

                    // el = (item.compat) ? Y.DOM.byId(item.id) : Y.one(item.id);
                    el = (item.compat) ? Y.DOM.byId(item.id) : Y.Selector.query(item.id, null, true);

                    if (el) {
                        executeItem(el, item);
                        _avail[i] = null;
                    } else {
                        notAvail.push(item);
                    }
                }
            }

            // onContentReady
            for (i=0,len=_avail.length; i<len; ++i) {
                item = _avail[i];
                if (item && item.checkReady) {

                    // el = (item.compat) ? Y.DOM.byId(item.id) : Y.one(item.id);
                    el = (item.compat) ? Y.DOM.byId(item.id) : Y.Selector.query(item.id, null, true);

                    if (el) {
                        // The element is available, but not necessarily ready
                        // @todo should we test parentNode.nextSibling?
                        if (_loadComplete || (el.get && el.get('nextSibling')) || el.nextSibling) {
                            executeItem(el, item);
                            _avail[i] = null;
                        }
                    } else {
                        notAvail.push(item);
                    }
                }
            }

            _retryCount = (notAvail.length === 0) ? 0 : _retryCount - 1;

            if (tryAgain) {
                // we may need to strip the nulled out items here
                Event.startInterval();
            } else {
                clearInterval(Event._interval);
                Event._interval = null;
            }

            Event.locked = false;

            return;

        },

        /**
         * Removes all listeners attached to the given element via addListener.
         * Optionally, the node's children can also be purged.
         * Optionally, you can specify a specific type of event to remove.
         * @method purgeElement
         * @param {HTMLElement} el the element to purge
         * @param {boolean} recurse recursively purge this element's children
         * as well.  Use with caution.
         * @param {string} type optional type of listener to purge. If
         * left out, all listeners will be removed
         * @static
         */
        purgeElement: function(el, recurse, type) {
            // var oEl = (Y.Lang.isString(el)) ? Y.one(el) : el,
            var oEl = (Y.Lang.isString(el)) ?  Y.Selector.query(el, null, true) : el,
                lis = Event.getListeners(oEl, type), i, len, props, children, child;

            if (recurse && oEl) {
                lis = lis || [];
                children = Y.Selector.query('*', oEl);
                i = 0;
                len = children.length;
                for (; i < len; ++i) {
                    child = Event.getListeners(children[i], type);
                    if (child) {
                        lis = lis.concat(child);
                    }
                }
            }

            if (lis) {
                i = 0;
                len = lis.length;
                for (; i < len; ++i) {
                    props = lis[i];
                    props.detachAll();
                    remove(props.el, props.type, props.fn, props.capture);
                    delete _wrappers[props.key];
                    delete _el_events[props.domkey][props.key];
                }
            }

        },


        /**
         * Returns all listeners attached to the given element via addListener.
         * Optionally, you can specify a specific type of event to return.
         * @method getListeners
         * @param el {HTMLElement|string} the element or element id to inspect
         * @param type {string} optional type of listener to return. If
         * left out, all listeners will be returned
         * @return {Y.Custom.Event} the custom event wrapper for the DOM event(s)
         * @static
         */
        getListeners: function(el, type) {
            var ek = Y.stamp(el, true), evts = _el_events[ek],
                results=[] , key = (type) ? 'event:' + ek + type : null,
                adapters = _eventenv.plugins;

            if (!evts) {
                return null;
            }

            if (key) {
                // look for synthetic events
                if (adapters[type] && adapters[type].eventDef) {
                    key += '_synth';
                }

                if (evts[key]) {
                    results.push(evts[key]);
                }

                // get native events as well
                key += 'native';
                if (evts[key]) {
                    results.push(evts[key]);
                }

            } else {
                Y.each(evts, function(v, k) {
                    results.push(v);
                });
            }

            return (results.length) ? results : null;
        },

        /**
         * Removes all listeners registered by pe.event.  Called
         * automatically during the unload event.
         * @method _unload
         * @static
         * @private
         */
        _unload: function(e) {
            Y.each(_wrappers, function(v, k) {
                v.detachAll();
                remove(v.el, v.type, v.fn, v.capture);
                delete _wrappers[k];
                delete _el_events[v.domkey][k];
            });
            remove(win, "unload", onUnload);
        },

        /**
         * Adds a DOM event directly without the caching, cleanup, context adj, etc
         *
         * @method nativeAdd
         * @param {HTMLElement} el      the element to bind the handler to
         * @param {string}      type   the type of event handler
         * @param {function}    fn      the callback to invoke
         * @param {boolen}      capture capture or bubble phase
         * @static
         * @private
         */
        nativeAdd: add,

        /**
         * Basic remove listener
         *
         * @method nativeRemove
         * @param {HTMLElement} el      the element to bind the handler to
         * @param {string}      type   the type of event handler
         * @param {function}    fn      the callback to invoke
         * @param {boolen}      capture capture or bubble phase
         * @static
         * @private
         */
        nativeRemove: remove
    };

}();

Y.Event = Event;

if (config.injected || YUI.Env.windowLoaded) {
    onLoad();
} else {
    add(win, "load", onLoad);
}

// Process onAvailable/onContentReady items when when the DOM is ready in IE
if (Y.UA.ie) {
    Y.on(EVENT_READY, Event._poll);
}

add(win, "unload", onUnload);

Event.Custom = Y.CustomEvent;
Event.Subscriber = Y.Subscriber;
Event.Target = Y.EventTarget;
Event.Handle = Y.EventHandle;
Event.Facade = Y.EventFacade;

Event._poll();

})();

/**
 * DOM event listener abstraction layer
 * @module event
 * @submodule event-base
 */

/**
 * Executes the callback as soon as the specified element
 * is detected in the DOM.  This function expects a selector
 * string for the element(s) to detect.  If you already have
 * an element reference, you don't need this event.
 * @event available
 * @param type {string} 'available'
 * @param fn {function} the callback function to execute.
 * @param el {string} an selector for the element(s) to attach
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 * These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.Env.evt.plugins.available = {
    on: function(type, fn, id, o) {
        var a = arguments.length > 4 ?  Y.Array(arguments, 4, true) : null;
        return Y.Event.onAvailable.call(Y.Event, id, fn, o, a);
    }
};

/**
 * Executes the callback as soon as the specified element
 * is detected in the DOM with a nextSibling property
 * (indicating that the element's children are available).
 * This function expects a selector
 * string for the element(s) to detect.  If you already have
 * an element reference, you don't need this event.
 * @event contentready
 * @param type {string} 'contentready'
 * @param fn {function} the callback function to execute.
 * @param el {string} an selector for the element(s) to attach.
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 * These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.Env.evt.plugins.contentready = {
    on: function(type, fn, id, o) {
        var a = arguments.length > 4 ? Y.Array(arguments, 4, true) : null;
        return Y.Event.onContentReady.call(Y.Event, id, fn, o, a);
    }
};


}, '3.3.0' ,{requires:['event-custom-base']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('dom-base', function(Y) {

(function(Y) {
/** 
 * The DOM utility provides a cross-browser abtraction layer
 * normalizing DOM tasks, and adds extra helper functionality
 * for other common tasks. 
 * @module dom
 * @submodule dom-base
 * @for DOM
 *
 */

/**
 * Provides DOM helper methods.
 * @class DOM
 *
 */
var NODE_TYPE = 'nodeType',
    OWNER_DOCUMENT = 'ownerDocument',
    DOCUMENT_ELEMENT = 'documentElement',
    DEFAULT_VIEW = 'defaultView',
    PARENT_WINDOW = 'parentWindow',
    TAG_NAME = 'tagName',
    PARENT_NODE = 'parentNode',
    FIRST_CHILD = 'firstChild',
    PREVIOUS_SIBLING = 'previousSibling',
    NEXT_SIBLING = 'nextSibling',
    CONTAINS = 'contains',
    COMPARE_DOCUMENT_POSITION = 'compareDocumentPosition',
    EMPTY_STRING = '',
    EMPTY_ARRAY = [],

    documentElement = Y.config.doc.documentElement,

    re_tag = /<([a-z]+)/i,

    createFromDIV = function(html, tag) {
        var div = Y.config.doc.createElement('div'),
            ret = true;

        div.innerHTML = html;
        if (!div.firstChild || div.firstChild.tagName !== tag.toUpperCase()) {
            ret = false;
        }

        return ret;
    },

    addFeature = Y.Features.add,
    testFeature = Y.Features.test,
    
Y_DOM = {
    /**
     * Returns the HTMLElement with the given ID (Wrapper for document.getElementById).
     * @method byId         
     * @param {String} id the id attribute 
     * @param {Object} doc optional The document to search. Defaults to current document 
     * @return {HTMLElement | null} The HTMLElement with the id, or null if none found. 
     */
    byId: function(id, doc) {
        // handle dupe IDs and IE name collision
        return Y_DOM.allById(id, doc)[0] || null;
    },

    /**
     * Returns the text content of the HTMLElement. 
     * @method getText         
     * @param {HTMLElement} element The html element. 
     * @return {String} The text content of the element (includes text of any descending elements).
     */
    getText: (documentElement.textContent !== undefined) ?
        function(element) {
            var ret = '';
            if (element) {
                ret = element.textContent;
            }
            return ret || '';
        } : function(element) {
            var ret = '';
            if (element) {
                ret = element.innerText || element.nodeValue; // might be a textNode
            }
            return ret || '';
        },

    /**
     * Sets the text content of the HTMLElement. 
     * @method setText         
     * @param {HTMLElement} element The html element. 
     * @param {String} content The content to add. 
     */
    setText: (documentElement.textContent !== undefined) ?
        function(element, content) {
            if (element) {
                element.textContent = content;
            }
        } : function(element, content) {
            if ('innerText' in element) {
                element.innerText = content;
            } else if ('nodeValue' in element) {
                element.nodeValue = content;
            }

        },

    /*
     * Finds the ancestor of the element.
     * @method ancestor
     * @param {HTMLElement} element The html element.
     * @param {Function} fn optional An optional boolean test to apply.
     * The optional function is passed the current DOM node being tested as its only argument.
     * If no function is given, the parentNode is returned.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan 
     * @return {HTMLElement | null} The matching DOM node or null if none found. 
     */
    ancestor: function(element, fn, testSelf) {
        var ret = null;
        if (testSelf) {
            ret = (!fn || fn(element)) ? element : null;

        }
        return ret || Y_DOM.elementByAxis(element, PARENT_NODE, fn, null);
    },

    /*
     * Finds the ancestors of the element.
     * @method ancestors
     * @param {HTMLElement} element The html element.
     * @param {Function} fn optional An optional boolean test to apply.
     * The optional function is passed the current DOM node being tested as its only argument.
     * If no function is given, all ancestors are returned.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan 
     * @return {Array} An array containing all matching DOM nodes.
     */
    ancestors: function(element, fn, testSelf) {
        var ancestor = Y_DOM.ancestor.apply(Y_DOM, arguments),
            ret = (ancestor) ? [ancestor] : [];

        while ((ancestor = Y_DOM.ancestor(ancestor, fn))) {
            if (ancestor) {
                ret.unshift(ancestor);
            }
        }

        return ret;
    },

    /**
     * Searches the element by the given axis for the first matching element.
     * @method elementByAxis
     * @param {HTMLElement} element The html element.
     * @param {String} axis The axis to search (parentNode, nextSibling, previousSibling).
     * @param {Function} fn optional An optional boolean test to apply.
     * @param {Boolean} all optional Whether all node types should be returned, or just element nodes.
     * The optional function is passed the current HTMLElement being tested as its only argument.
     * If no function is given, the first element is returned.
     * @return {HTMLElement | null} The matching element or null if none found.
     */
    elementByAxis: function(element, axis, fn, all) {
        while (element && (element = element[axis])) { // NOTE: assignment
                if ( (all || element[TAG_NAME]) && (!fn || fn(element)) ) {
                    return element;
                }
        }
        return null;
    },

    /**
     * Determines whether or not one HTMLElement is or contains another HTMLElement.
     * @method contains
     * @param {HTMLElement} element The containing html element.
     * @param {HTMLElement} needle The html element that may be contained.
     * @return {Boolean} Whether or not the element is or contains the needle.
     */
    contains: function(element, needle) {
        var ret = false;

        if ( !needle || !element || !needle[NODE_TYPE] || !element[NODE_TYPE]) {
            ret = false;
        } else if (element[CONTAINS])  {
            if (Y.UA.opera || needle[NODE_TYPE] === 1) { // IE & SAF contains fail if needle not an ELEMENT_NODE
                ret = element[CONTAINS](needle);
            } else {
                ret = Y_DOM._bruteContains(element, needle); 
            }
        } else if (element[COMPARE_DOCUMENT_POSITION]) { // gecko
            if (element === needle || !!(element[COMPARE_DOCUMENT_POSITION](needle) & 16)) { 
                ret = true;
            }
        }

        return ret;
    },

    /**
     * Determines whether or not the HTMLElement is part of the document.
     * @method inDoc
     * @param {HTMLElement} element The containing html element.
     * @param {HTMLElement} doc optional The document to check.
     * @return {Boolean} Whether or not the element is attached to the document. 
     */
    inDoc: function(element, doc) {
        var ret = false,
            rootNode;

        if (element && element.nodeType) {
            (doc) || (doc = element[OWNER_DOCUMENT]);

            rootNode = doc[DOCUMENT_ELEMENT];

            // contains only works with HTML_ELEMENT
            if (rootNode && rootNode.contains && element.tagName) {
                ret = rootNode.contains(element);
            } else {
                ret = Y_DOM.contains(rootNode, element);
            }
        }

        return ret;

    },

   allById: function(id, root) {
        root = root || Y.config.doc;
        var nodes = [],
            ret = [],
            i,
            node;

        if (root.querySelectorAll) {
            ret = root.querySelectorAll('[id="' + id + '"]');
        } else if (root.all) {
            nodes = root.all(id);

            if (nodes) {
                // root.all may return HTMLElement or HTMLCollection.
                // some elements are also HTMLCollection (FORM, SELECT).
                if (nodes.nodeName) {
                    if (nodes.id === id) { // avoid false positive on name
                        ret.push(nodes);
                        nodes = EMPTY_ARRAY; // done, no need to filter
                    } else { //  prep for filtering
                        nodes = [nodes];
                    }
                }

                if (nodes.length) {
                    // filter out matches on node.name
                    // and element.id as reference to element with id === 'id'
                    for (i = 0; node = nodes[i++];) {
                        if (node.id === id  || 
                                (node.attributes && node.attributes.id &&
                                node.attributes.id.value === id)) { 
                            ret.push(node);
                        }
                    }
                }
            }
        } else {
            ret = [Y_DOM._getDoc(root).getElementById(id)];
        }
    
        return ret;
   },

    /**
     * Creates a new dom node using the provided markup string. 
     * @method create
     * @param {String} html The markup used to create the element
     * @param {HTMLDocument} doc An optional document context 
     * @return {HTMLElement|DocumentFragment} returns a single HTMLElement 
     * when creating one node, and a documentFragment when creating
     * multiple nodes.
     */
    create: function(html, doc) {
        if (typeof html === 'string') {
            html = Y.Lang.trim(html); // match IE which trims whitespace from innerHTML

        }

        doc = doc || Y.config.doc;
        var m = re_tag.exec(html),
            create = Y_DOM._create,
            custom = Y_DOM.creators,
            ret = null,
            creator,
            tag, nodes;

        if (html != undefined) { // not undefined or null
            if (m && m[1]) {
                creator = custom[m[1].toLowerCase()];
                if (typeof creator === 'function') {
                    create = creator; 
                } else {
                    tag = creator;
                }
            }

            nodes = create(html, doc, tag).childNodes;

            if (nodes.length === 1) { // return single node, breaking parentNode ref from "fragment"
                ret = nodes[0].parentNode.removeChild(nodes[0]);
            } else if (nodes[0] && nodes[0].className === 'yui3-big-dummy') { // using dummy node to preserve some attributes (e.g. OPTION not selected)
                if (nodes.length === 2) {
                    ret = nodes[0].nextSibling;
                } else {
                    nodes[0].parentNode.removeChild(nodes[0]); 
                     ret = Y_DOM._nl2frag(nodes, doc);
                }
            } else { // return multiple nodes as a fragment
                 ret = Y_DOM._nl2frag(nodes, doc);
            }
        }

        return ret;
    },

    _nl2frag: function(nodes, doc) {
        var ret = null,
            i, len;

        if (nodes && (nodes.push || nodes.item) && nodes[0]) {
            doc = doc || nodes[0].ownerDocument; 
            ret = doc.createDocumentFragment();

            if (nodes.item) { // convert live list to static array
                nodes = Y.Array(nodes, 0, true);
            }

            for (i = 0, len = nodes.length; i < len; i++) {
                ret.appendChild(nodes[i]); 
            }
        } // else inline with log for minification
        return ret;
    },


    CUSTOM_ATTRIBUTES: (!documentElement.hasAttribute) ? { // IE < 8
        'for': 'htmlFor',
        'class': 'className'
    } : { // w3c
        'htmlFor': 'for',
        'className': 'class'
    },

    /**
     * Provides a normalized attribute interface. 
     * @method setAttibute
     * @param {HTMLElement} el The target element for the attribute.
     * @param {String} attr The attribute to set.
     * @param {String} val The value of the attribute.
     */
    setAttribute: function(el, attr, val, ieAttr) {
        if (el && attr && el.setAttribute) {
            attr = Y_DOM.CUSTOM_ATTRIBUTES[attr] || attr;
            el.setAttribute(attr, val, ieAttr);
        }
    },


    /**
     * Provides a normalized attribute interface. 
     * @method getAttibute
     * @param {HTMLElement} el The target element for the attribute.
     * @param {String} attr The attribute to get.
     * @return {String} The current value of the attribute. 
     */
    getAttribute: function(el, attr, ieAttr) {
        ieAttr = (ieAttr !== undefined) ? ieAttr : 2;
        var ret = '';
        if (el && attr && el.getAttribute) {
            attr = Y_DOM.CUSTOM_ATTRIBUTES[attr] || attr;
            ret = el.getAttribute(attr, ieAttr);

            if (ret === null) {
                ret = ''; // per DOM spec
            }
        }
        return ret;
    },

    isWindow: function(obj) {
        return !!(obj && obj.alert && obj.document);
    },

    _fragClones: {},

    _create: function(html, doc, tag) {
        tag = tag || 'div';

        var frag = Y_DOM._fragClones[tag];
        if (frag) {
            frag = frag.cloneNode(false);
        } else {
            frag = Y_DOM._fragClones[tag] = doc.createElement(tag);
        }
        frag.innerHTML = html;
        return frag;
    },

    _removeChildNodes: function(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    },

    /**
     * Inserts content in a node at the given location 
     * @method addHTML
     * @param {HTMLElement} node The node to insert into
     * @param {HTMLElement | Array | HTMLCollection} content The content to be inserted 
     * @param {HTMLElement} where Where to insert the content
     * If no "where" is given, content is appended to the node
     * Possible values for "where"
     * <dl>
     * <dt>HTMLElement</dt>
     * <dd>The element to insert before</dd>
     * <dt>"replace"</dt>
     * <dd>Replaces the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts before the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts content before the node</dd>
     * <dt>"after"</dt>
     * <dd>Inserts content after the node</dd>
     * </dl>
     */
    addHTML: function(node, content, where) {
        var nodeParent = node.parentNode,
            i = 0,
            item,
            ret = content,
            newNode;
            

        if (content != undefined) { // not null or undefined (maybe 0)
            if (content.nodeType) { // DOM node, just add it
                newNode = content;
            } else if (typeof content == 'string' || typeof content == 'number') {
                ret = newNode = Y_DOM.create(content);
            } else if (content[0] && content[0].nodeType) { // array or collection 
                newNode = Y.config.doc.createDocumentFragment();
                while ((item = content[i++])) {
                    newNode.appendChild(item); // append to fragment for insertion
                }
            }
        }

        if (where) {
            if (where.nodeType) { // insert regardless of relationship to node
                where.parentNode.insertBefore(newNode, where);
            } else {
                switch (where) {
                    case 'replace':
                        while (node.firstChild) {
                            node.removeChild(node.firstChild);
                        }
                        if (newNode) { // allow empty content to clear node
                            node.appendChild(newNode);
                        }
                        break;
                    case 'before':
                        nodeParent.insertBefore(newNode, node);
                        break;
                    case 'after':
                        if (node.nextSibling) { // IE errors if refNode is null
                            nodeParent.insertBefore(newNode, node.nextSibling);
                        } else {
                            nodeParent.appendChild(newNode);
                        }
                        break;
                    default:
                        node.appendChild(newNode);
                }
            }
        } else if (newNode) {
            node.appendChild(newNode);
        }

        return ret;
    },

    VALUE_SETTERS: {},

    VALUE_GETTERS: {},

    getValue: function(node) {
        var ret = '', // TODO: return null?
            getter;

        if (node && node[TAG_NAME]) {
            getter = Y_DOM.VALUE_GETTERS[node[TAG_NAME].toLowerCase()];

            if (getter) {
                ret = getter(node);
            } else {
                ret = node.value;
            }
        }

        // workaround for IE8 JSON stringify bug
        // which converts empty string values to null
        if (ret === EMPTY_STRING) {
            ret = EMPTY_STRING; // for real
        }

        return (typeof ret === 'string') ? ret : '';
    },

    setValue: function(node, val) {
        var setter;

        if (node && node[TAG_NAME]) {
            setter = Y_DOM.VALUE_SETTERS[node[TAG_NAME].toLowerCase()];

            if (setter) {
                setter(node, val);
            } else {
                node.value = val;
            }
        }
    },

    siblings: function(node, fn) {
        var nodes = [],
            sibling = node;

        while ((sibling = sibling[PREVIOUS_SIBLING])) {
            if (sibling[TAG_NAME] && (!fn || fn(sibling))) {
                nodes.unshift(sibling);
            }
        }

        sibling = node;
        while ((sibling = sibling[NEXT_SIBLING])) {
            if (sibling[TAG_NAME] && (!fn || fn(sibling))) {
                nodes.push(sibling);
            }
        }

        return nodes;
    },

    /**
     * Brute force version of contains.
     * Used for browsers without contains support for non-HTMLElement Nodes (textNodes, etc).
     * @method _bruteContains
     * @private
     * @param {HTMLElement} element The containing html element.
     * @param {HTMLElement} needle The html element that may be contained.
     * @return {Boolean} Whether or not the element is or contains the needle.
     */
    _bruteContains: function(element, needle) {
        while (needle) {
            if (element === needle) {
                return true;
            }
            needle = needle.parentNode;
        }
        return false;
    },

// TODO: move to Lang?
    /**
     * Memoizes dynamic regular expressions to boost runtime performance. 
     * @method _getRegExp
     * @private
     * @param {String} str The string to convert to a regular expression.
     * @param {String} flags optional An optinal string of flags.
     * @return {RegExp} An instance of RegExp
     */
    _getRegExp: function(str, flags) {
        flags = flags || '';
        Y_DOM._regexCache = Y_DOM._regexCache || {};
        if (!Y_DOM._regexCache[str + flags]) {
            Y_DOM._regexCache[str + flags] = new RegExp(str, flags);
        }
        return Y_DOM._regexCache[str + flags];
    },

// TODO: make getDoc/Win true privates?
    /**
     * returns the appropriate document.
     * @method _getDoc
     * @private
     * @param {HTMLElement} element optional Target element.
     * @return {Object} The document for the given element or the default document. 
     */
    _getDoc: function(element) {
        var doc = Y.config.doc;
        if (element) {
            doc = (element[NODE_TYPE] === 9) ? element : // element === document
                element[OWNER_DOCUMENT] || // element === DOM node
                element.document || // element === window
                Y.config.doc; // default
        }

        return doc;
    },

    /**
     * returns the appropriate window.
     * @method _getWin
     * @private
     * @param {HTMLElement} element optional Target element.
     * @return {Object} The window for the given element or the default window. 
     */
    _getWin: function(element) {
        var doc = Y_DOM._getDoc(element);
        return doc[DEFAULT_VIEW] || doc[PARENT_WINDOW] || Y.config.win;
    },

    _batch: function(nodes, fn, arg1, arg2, arg3, etc) {
        fn = (typeof fn === 'string') ? Y_DOM[fn] : fn;
        var result,
            args = Array.prototype.slice.call(arguments, 2),
            i = 0,
            node,
            ret;

        if (fn && nodes) {
            while ((node = nodes[i++])) {
                result = result = fn.call(Y_DOM, node, arg1, arg2, arg3, etc);
                if (typeof result !== 'undefined') {
                    (ret) || (ret = []);
                    ret.push(result);
                }
            }
        }

        return (typeof ret !== 'undefined') ? ret : nodes;
    },

    wrap: function(node, html) {
        var parent = Y.DOM.create(html),
            nodes = parent.getElementsByTagName('*');

        if (nodes.length) {
            parent = nodes[nodes.length - 1];
        }

        if (node.parentNode) { 
            node.parentNode.replaceChild(parent, node);
        }
        parent.appendChild(node);
    },

    unwrap: function(node) {
        var parent = node.parentNode,
            lastChild = parent.lastChild,
            node = parent.firstChild,
            next = node,
            grandparent;

        if (parent) {
            grandparent = parent.parentNode;
            if (grandparent) {
                while (node !== lastChild) {
                    next = node.nextSibling;
                    grandparent.insertBefore(node, parent);
                    node = next;
                }
                grandparent.replaceChild(lastChild, parent);
            } else {
                parent.removeChild(node);
            }
        }
    },

    generateID: function(el) {
        var id = el.id;

        if (!id) {
            id = Y.stamp(el);
            el.id = id; 
        }   

        return id; 
    },

    creators: {}
};

addFeature('innerhtml', 'table', {
    test: function() {
        var node = Y.config.doc.createElement('table');
        try {
            node.innerHTML = '<tbody></tbody>';
        } catch(e) {
            return false;
        }
        return (node.firstChild && node.firstChild.nodeName === 'TBODY');
    }
});

addFeature('innerhtml-div', 'tr', {
    test: function() {
        return createFromDIV('<tr></tr>', 'tr');
    }
});

addFeature('innerhtml-div', 'script', {
    test: function() {
        return createFromDIV('<script></script>', 'script');
    }
});

addFeature('value-set', 'select', {
    test: function() {
        var node = Y.config.doc.createElement('select');
        node.innerHTML = '<option>1</option><option>2</option>';
        node.value = '2';
        return (node.value && node.value === '2');
    }
});

(function(Y) {
    var creators = Y_DOM.creators,
        create = Y_DOM.create,
        re_tbody = /(?:\/(?:thead|tfoot|tbody|caption|col|colgroup)>)+\s*<tbody/,

        TABLE_OPEN = '<table>',
        TABLE_CLOSE = '</table>';

    if (!testFeature('innerhtml', 'table')) {
        // TODO: thead/tfoot with nested tbody
            // IE adds TBODY when creating TABLE elements (which may share this impl)
        creators.tbody = function(html, doc) {
            var frag = create(TABLE_OPEN + html + TABLE_CLOSE, doc),
                tb = frag.children.tags('tbody')[0];

            if (frag.children.length > 1 && tb && !re_tbody.test(html)) {
                tb[PARENT_NODE].removeChild(tb); // strip extraneous tbody
            }
            return frag;
        };
    }

    if (!testFeature('innerhtml-div', 'script')) {
        creators.script = function(html, doc) {
            var frag = doc.createElement('div');

            frag.innerHTML = '-' + html;
            frag.removeChild(frag[FIRST_CHILD]);
            return frag;
        }

        Y_DOM.creators.link = Y_DOM.creators.style = Y_DOM.creators.script;
    }

    
    if (!testFeature('value-set', 'select')) {
        Y_DOM.VALUE_SETTERS.select = function(node, val) {
            for (var i = 0, options = node.getElementsByTagName('option'), option;
                    option = options[i++];) {
                if (Y_DOM.getValue(option) === val) {
                    option.selected = true;
                    //Y_DOM.setAttribute(option, 'selected', 'selected');
                    break;
                }
            }
        }
    }

    Y.mix(Y_DOM.VALUE_GETTERS, {
        button: function(node) {
            return (node.attributes && node.attributes.value) ? node.attributes.value.value : '';
        }
    });

    Y.mix(Y_DOM.VALUE_SETTERS, {
        // IE: node.value changes the button text, which should be handled via innerHTML
        button: function(node, val) {
            var attr = node.attributes.value;
            if (!attr) {
                attr = node[OWNER_DOCUMENT].createAttribute('value');
                node.setAttributeNode(attr);
            }

            attr.value = val;
        }
    });


    if (!testFeature('innerhtml-div', 'tr')) {
        Y.mix(creators, {
            option: function(html, doc) {
                return create('<select><option class="yui3-big-dummy" selected></option>' + html + '</select>', doc);
            },

            tr: function(html, doc) {
                return create('<tbody>' + html + '</tbody>', doc);
            },

            td: function(html, doc) {
                return create('<tr>' + html + '</tr>', doc);
            }, 

            col: function(html, doc) {
                return create('<colgroup>' + html + '</colgroup>', doc);
            }, 

            tbody: 'table'
        });

        Y.mix(creators, {
            legend: 'fieldset',
            th: creators.td,
            thead: creators.tbody,
            tfoot: creators.tbody,
            caption: creators.tbody,
            colgroup: creators.tbody,
            optgroup: creators.option
        });
    }

    Y.mix(Y_DOM.VALUE_GETTERS, {
        option: function(node) {
            var attrs = node.attributes;
            return (attrs.value && attrs.value.specified) ? node.value : node.text;
        },

        select: function(node) {
            var val = node.value,
                options = node.options;

            if (options && options.length) {
                // TODO: implement multipe select
                if (node.multiple) {
                } else {
                    val = Y_DOM.getValue(options[node.selectedIndex]);
                }
            }

            return val;
        }
    });
})(Y);

Y.DOM = Y_DOM;
})(Y);
var addClass, hasClass, removeClass;

Y.mix(Y.DOM, {
    /**
     * Determines whether a DOM element has the given className.
     * @method hasClass
     * @for DOM
     * @param {HTMLElement} element The DOM element. 
     * @param {String} className the class name to search for
     * @return {Boolean} Whether or not the element has the given class. 
     */
    hasClass: function(node, className) {
        var re = Y.DOM._getRegExp('(?:^|\\s+)' + className + '(?:\\s+|$)');
        return re.test(node.className);
    },

    /**
     * Adds a class name to a given DOM element.
     * @method addClass         
     * @for DOM
     * @param {HTMLElement} element The DOM element. 
     * @param {String} className the class name to add to the class attribute
     */
    addClass: function(node, className) {
        if (!Y.DOM.hasClass(node, className)) { // skip if already present 
            node.className = Y.Lang.trim([node.className, className].join(' '));
        }
    },

    /**
     * Removes a class name from a given element.
     * @method removeClass         
     * @for DOM
     * @param {HTMLElement} element The DOM element. 
     * @param {String} className the class name to remove from the class attribute
     */
    removeClass: function(node, className) {
        if (className && hasClass(node, className)) {
            node.className = Y.Lang.trim(node.className.replace(Y.DOM._getRegExp('(?:^|\\s+)' +
                            className + '(?:\\s+|$)'), ' '));

            if ( hasClass(node, className) ) { // in case of multiple adjacent
                removeClass(node, className);
            }
        }                 
    },

    /**
     * Replace a class with another class for a given element.
     * If no oldClassName is present, the newClassName is simply added.
     * @method replaceClass  
     * @for DOM
     * @param {HTMLElement} element The DOM element 
     * @param {String} oldClassName the class name to be replaced
     * @param {String} newClassName the class name that will be replacing the old class name
     */
    replaceClass: function(node, oldC, newC) {
        removeClass(node, oldC); // remove first in case oldC === newC
        addClass(node, newC);
    },

    /**
     * If the className exists on the node it is removed, if it doesn't exist it is added.
     * @method toggleClass  
     * @for DOM
     * @param {HTMLElement} element The DOM element
     * @param {String} className the class name to be toggled
     * @param {Boolean} addClass optional boolean to indicate whether class
     * should be added or removed regardless of current state
     */
    toggleClass: function(node, className, force) {
        var add = (force !== undefined) ? force :
                !(hasClass(node, className));

        if (add) {
            addClass(node, className);
        } else {
            removeClass(node, className);
        }
    }
});

hasClass = Y.DOM.hasClass;
removeClass = Y.DOM.removeClass;
addClass = Y.DOM.addClass;

Y.mix(Y.DOM, {
    /**
     * Sets the width of the element to the given size, regardless
     * of box model, border, padding, etc.
     * @method setWidth
     * @param {HTMLElement} element The DOM element. 
     * @param {String|Int} size The pixel height to size to
     */

    setWidth: function(node, size) {
        Y.DOM._setSize(node, 'width', size);
    },

    /**
     * Sets the height of the element to the given size, regardless
     * of box model, border, padding, etc.
     * @method setHeight
     * @param {HTMLElement} element The DOM element. 
     * @param {String|Int} size The pixel height to size to
     */

    setHeight: function(node, size) {
        Y.DOM._setSize(node, 'height', size);
    },

    _setSize: function(node, prop, val) {
        val = (val > 0) ? val : 0;
        var size = 0;

        node.style[prop] = val + 'px';
        size = (prop === 'height') ? node.offsetHeight : node.offsetWidth;

        if (size > val) {
            val = val - (size - val);

            if (val < 0) {
                val = 0;
            }

            node.style[prop] = val + 'px';
        }
    }
});


}, '3.3.0' ,{requires:['oop']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('dom-style', function(Y) {

(function(Y) {
/** 
 * Add style management functionality to DOM.
 * @module dom
 * @submodule dom-style
 * @for DOM
 */

var DOCUMENT_ELEMENT = 'documentElement',
    DEFAULT_VIEW = 'defaultView',
    OWNER_DOCUMENT = 'ownerDocument',
    STYLE = 'style',
    FLOAT = 'float',
    CSS_FLOAT = 'cssFloat',
    STYLE_FLOAT = 'styleFloat',
    TRANSPARENT = 'transparent',
    GET_COMPUTED_STYLE = 'getComputedStyle',
    GET_BOUNDING_CLIENT_RECT = 'getBoundingClientRect',

    WINDOW = Y.config.win,
    DOCUMENT = Y.config.doc,
    UNDEFINED = undefined,

    Y_DOM = Y.DOM,

    TRANSFORM = 'transform',
    VENDOR_TRANSFORM = [
        'WebkitTransform',
        'MozTransform',
        'OTransform'
    ],

    re_color = /color$/i,
    re_unit = /width|height|top|left|right|bottom|margin|padding/i;

Y.Array.each(VENDOR_TRANSFORM, function(val) {
    if (val in DOCUMENT[DOCUMENT_ELEMENT].style) {
        TRANSFORM = val;
    }
});

Y.mix(Y_DOM, {
    DEFAULT_UNIT: 'px',

    CUSTOM_STYLES: {
    },


    /**
     * Sets a style property for a given element.
     * @method setStyle
     * @param {HTMLElement} An HTMLElement to apply the style to.
     * @param {String} att The style property to set. 
     * @param {String|Number} val The value. 
     */
    setStyle: function(node, att, val, style) {
        style = style || node.style;
        var CUSTOM_STYLES = Y_DOM.CUSTOM_STYLES;

        if (style) {
            if (val === null || val === '') { // normalize unsetting
                val = '';
            } else if (!isNaN(new Number(val)) && re_unit.test(att)) { // number values may need a unit
                val += Y_DOM.DEFAULT_UNIT;
            }

            if (att in CUSTOM_STYLES) {
                if (CUSTOM_STYLES[att].set) {
                    CUSTOM_STYLES[att].set(node, val, style);
                    return; // NOTE: return
                } else if (typeof CUSTOM_STYLES[att] === 'string') {
                    att = CUSTOM_STYLES[att];
                }
            } else if (att === '') { // unset inline styles
                att = 'cssText';
                val = '';
            }
            style[att] = val; 
        }
    },

    /**
     * Returns the current style value for the given property.
     * @method getStyle
     * @param {HTMLElement} An HTMLElement to get the style from.
     * @param {String} att The style property to get. 
     */
    getStyle: function(node, att, style) {
        style = style || node.style;
        var CUSTOM_STYLES = Y_DOM.CUSTOM_STYLES,
            val = '';

        if (style) {
            if (att in CUSTOM_STYLES) {
                if (CUSTOM_STYLES[att].get) {
                    return CUSTOM_STYLES[att].get(node, att, style); // NOTE: return
                } else if (typeof CUSTOM_STYLES[att] === 'string') {
                    att = CUSTOM_STYLES[att];
                }
            }
            val = style[att];
            if (val === '') { // TODO: is empty string sufficient?
                val = Y_DOM[GET_COMPUTED_STYLE](node, att);
            }
        }

        return val;
    },

    /**
     * Sets multiple style properties.
     * @method setStyles
     * @param {HTMLElement} node An HTMLElement to apply the styles to. 
     * @param {Object} hash An object literal of property:value pairs. 
     */
    setStyles: function(node, hash) {
        var style = node.style;
        Y.each(hash, function(v, n) {
            Y_DOM.setStyle(node, n, v, style);
        }, Y_DOM);
    },

    /**
     * Returns the computed style for the given node.
     * @method getComputedStyle
     * @param {HTMLElement} An HTMLElement to get the style from.
     * @param {String} att The style property to get. 
     * @return {String} The computed value of the style property. 
     */
    getComputedStyle: function(node, att) {
        var val = '',
            doc = node[OWNER_DOCUMENT];

        if (node[STYLE] && doc[DEFAULT_VIEW] && doc[DEFAULT_VIEW][GET_COMPUTED_STYLE]) {
            val = doc[DEFAULT_VIEW][GET_COMPUTED_STYLE](node, null)[att];
        }
        return val;
    }
});

// normalize reserved word float alternatives ("cssFloat" or "styleFloat")
if (DOCUMENT[DOCUMENT_ELEMENT][STYLE][CSS_FLOAT] !== UNDEFINED) {
    Y_DOM.CUSTOM_STYLES[FLOAT] = CSS_FLOAT;
} else if (DOCUMENT[DOCUMENT_ELEMENT][STYLE][STYLE_FLOAT] !== UNDEFINED) {
    Y_DOM.CUSTOM_STYLES[FLOAT] = STYLE_FLOAT;
}

// fix opera computedStyle default color unit (convert to rgb)
if (Y.UA.opera) {
    Y_DOM[GET_COMPUTED_STYLE] = function(node, att) {
        var view = node[OWNER_DOCUMENT][DEFAULT_VIEW],
            val = view[GET_COMPUTED_STYLE](node, '')[att];

        if (re_color.test(att)) {
            val = Y.Color.toRGB(val);
        }

        return val;
    };

}

// safari converts transparent to rgba(), others use "transparent"
if (Y.UA.webkit) {
    Y_DOM[GET_COMPUTED_STYLE] = function(node, att) {
        var view = node[OWNER_DOCUMENT][DEFAULT_VIEW],
            val = view[GET_COMPUTED_STYLE](node, '')[att];

        if (val === 'rgba(0, 0, 0, 0)') {
            val = TRANSPARENT; 
        }

        return val;
    };

}

Y.DOM._getAttrOffset = function(node, attr) {
    var val = Y.DOM[GET_COMPUTED_STYLE](node, attr),
        offsetParent = node.offsetParent,
        position,
        parentOffset,
        offset;

    if (val === 'auto') {
        position = Y.DOM.getStyle(node, 'position');
        if (position === 'static' || position === 'relative') {
            val = 0;    
        } else if (offsetParent && offsetParent[GET_BOUNDING_CLIENT_RECT]) {
            parentOffset = offsetParent[GET_BOUNDING_CLIENT_RECT]()[attr];
            offset = node[GET_BOUNDING_CLIENT_RECT]()[attr];
            if (attr === 'left' || attr === 'top') {
                val = offset - parentOffset;
            } else {
                val = parentOffset - node[GET_BOUNDING_CLIENT_RECT]()[attr];
            }
        }
    }

    return val;
};

Y.DOM._getOffset = function(node) {
    var pos,
        xy = null;

    if (node) {
        pos = Y_DOM.getStyle(node, 'position');
        xy = [
            parseInt(Y_DOM[GET_COMPUTED_STYLE](node, 'left'), 10),
            parseInt(Y_DOM[GET_COMPUTED_STYLE](node, 'top'), 10)
        ];

        if ( isNaN(xy[0]) ) { // in case of 'auto'
            xy[0] = parseInt(Y_DOM.getStyle(node, 'left'), 10); // try inline
            if ( isNaN(xy[0]) ) { // default to offset value
                xy[0] = (pos === 'relative') ? 0 : node.offsetLeft || 0;
            }
        } 

        if ( isNaN(xy[1]) ) { // in case of 'auto'
            xy[1] = parseInt(Y_DOM.getStyle(node, 'top'), 10); // try inline
            if ( isNaN(xy[1]) ) { // default to offset value
                xy[1] = (pos === 'relative') ? 0 : node.offsetTop || 0;
            }
        } 
    }

    return xy;

};

Y_DOM.CUSTOM_STYLES.transform = {
    set: function(node, val, style) {
        style[TRANSFORM] = val;
    },

    get: function(node, style) {
        return Y_DOM[GET_COMPUTED_STYLE](node, TRANSFORM);
    }
};


})(Y);
(function(Y) {
var PARSE_INT = parseInt,
    RE = RegExp;

Y.Color = {
    KEYWORDS: {
        black: '000',
        silver: 'c0c0c0',
        gray: '808080',
        white: 'fff',
        maroon: '800000',
        red: 'f00',
        purple: '800080',
        fuchsia: 'f0f',
        green: '008000',
        lime: '0f0',
        olive: '808000',
        yellow: 'ff0',
        navy: '000080',
        blue: '00f',
        teal: '008080',
        aqua: '0ff'
    },

    re_RGB: /^rgb\(([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\)$/i,
    re_hex: /^#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i,
    re_hex3: /([0-9A-F])/gi,

    toRGB: function(val) {
        if (!Y.Color.re_RGB.test(val)) {
            val = Y.Color.toHex(val);
        }

        if(Y.Color.re_hex.exec(val)) {
            val = 'rgb(' + [
                PARSE_INT(RE.$1, 16),
                PARSE_INT(RE.$2, 16),
                PARSE_INT(RE.$3, 16)
            ].join(', ') + ')';
        }
        return val;
    },

    toHex: function(val) {
        val = Y.Color.KEYWORDS[val] || val;
        if (Y.Color.re_RGB.exec(val)) {
            val = [
                Number(RE.$1).toString(16),
                Number(RE.$2).toString(16),
                Number(RE.$3).toString(16)
            ];

            for (var i = 0; i < val.length; i++) {
                if (val[i].length < 2) {
                    val[i] = '0' + val[i];
                }
            }

            val = val.join('');
        }

        if (val.length < 6) {
            val = val.replace(Y.Color.re_hex3, '$1$1');
        }

        if (val !== 'transparent' && val.indexOf('#') < 0) {
            val = '#' + val;
        }

        return val.toUpperCase();
    }
};
})(Y);



}, '3.3.0' ,{requires:['dom-base']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('selector-native', function(Y) {

(function(Y) {
/**
 * The selector-native module provides support for native querySelector
 * @module dom
 * @submodule selector-native
 * @for Selector
 */

/**
 * Provides support for using CSS selectors to query the DOM 
 * @class Selector 
 * @static
 * @for Selector
 */

Y.namespace('Selector'); // allow native module to standalone

var COMPARE_DOCUMENT_POSITION = 'compareDocumentPosition',
    OWNER_DOCUMENT = 'ownerDocument';

var Selector = {
    _foundCache: [],

    useNative: true,

    _compare: ('sourceIndex' in Y.config.doc.documentElement) ?
        function(nodeA, nodeB) {
            var a = nodeA.sourceIndex,
                b = nodeB.sourceIndex;

            if (a === b) {
                return 0;
            } else if (a > b) {
                return 1;
            }

            return -1;

        } : (Y.config.doc.documentElement[COMPARE_DOCUMENT_POSITION] ?
        function(nodeA, nodeB) {
            if (nodeA[COMPARE_DOCUMENT_POSITION](nodeB) & 4) {
                return -1;
            } else {
                return 1;
            }
        } :
        function(nodeA, nodeB) {
            var rangeA, rangeB, compare;
            if (nodeA && nodeB) {
                rangeA = nodeA[OWNER_DOCUMENT].createRange();
                rangeA.setStart(nodeA, 0);
                rangeB = nodeB[OWNER_DOCUMENT].createRange();
                rangeB.setStart(nodeB, 0);
                compare = rangeA.compareBoundaryPoints(1, rangeB); // 1 === Range.START_TO_END
            }

            return compare;
        
    }),

    _sort: function(nodes) {
        if (nodes) {
            nodes = Y.Array(nodes, 0, true);
            if (nodes.sort) {
                nodes.sort(Selector._compare);
            }
        }

        return nodes;
    },

    _deDupe: function(nodes) {
        var ret = [],
            i, node;

        for (i = 0; (node = nodes[i++]);) {
            if (!node._found) {
                ret[ret.length] = node;
                node._found = true;
            }
        }

        for (i = 0; (node = ret[i++]);) {
            node._found = null;
            node.removeAttribute('_found');
        }

        return ret;
    },

    /**
     * Retrieves a set of nodes based on a given CSS selector. 
     * @method query
     *
     * @param {string} selector The CSS Selector to test the node against.
     * @param {HTMLElement} root optional An HTMLElement to start the query from. Defaults to Y.config.doc
     * @param {Boolean} firstOnly optional Whether or not to return only the first match.
     * @return {Array} An array of nodes that match the given selector.
     * @static
     */
    query: function(selector, root, firstOnly, skipNative) {
        root = root || Y.config.doc;
        var ret = [],
            useNative = (Y.Selector.useNative && Y.config.doc.querySelector && !skipNative),
            queries = [[selector, root]],
            query,
            result,
            i,
            fn = (useNative) ? Y.Selector._nativeQuery : Y.Selector._bruteQuery;

        if (selector && fn) {
            // split group into seperate queries
            if (!skipNative && // already done if skipping
                    (!useNative || root.tagName)) { // split native when element scoping is needed
                queries = Selector._splitQueries(selector, root);
            }

            for (i = 0; (query = queries[i++]);) {
                result = fn(query[0], query[1], firstOnly);
                if (!firstOnly) { // coerce DOM Collection to Array
                    result = Y.Array(result, 0, true);
                }
                if (result) {
                    ret = ret.concat(result);
                }
            }

            if (queries.length > 1) { // remove dupes and sort by doc order 
                ret = Selector._sort(Selector._deDupe(ret));
            }
        }

        return (firstOnly) ? (ret[0] || null) : ret;

    },

    // allows element scoped queries to begin with combinator
    // e.g. query('> p', document.body) === query('body > p')
    _splitQueries: function(selector, node) {
        var groups = selector.split(','),
            queries = [],
            prefix = '',
            i, len;

        if (node) {
            // enforce for element scoping
            if (node.tagName) {
                node.id = node.id || Y.guid();
                prefix = '[id="' + node.id + '"] ';
            }

            for (i = 0, len = groups.length; i < len; ++i) {
                selector =  prefix + groups[i];
                queries.push([selector, node]);
            }
        }

        return queries;
    },

    _nativeQuery: function(selector, root, one) {
        if (Y.UA.webkit && selector.indexOf(':checked') > -1 &&
                (Y.Selector.pseudos && Y.Selector.pseudos.checked)) { // webkit (chrome, safari) fails to find "selected"
            return Y.Selector.query(selector, root, one, true); // redo with skipNative true to try brute query
        }
        try {
            return root['querySelector' + (one ? '' : 'All')](selector);
        } catch(e) { // fallback to brute if available
            return Y.Selector.query(selector, root, one, true); // redo with skipNative true
        }
    },

    filter: function(nodes, selector) {
        var ret = [],
            i, node;

        if (nodes && selector) {
            for (i = 0; (node = nodes[i++]);) {
                if (Y.Selector.test(node, selector)) {
                    ret[ret.length] = node;
                }
            }
        } else {
        }

        return ret;
    },

    test: function(node, selector, root) {
        var ret = false,
            groups = selector.split(','),
            useFrag = false,
            parent,
            item,
            items,
            frag,
            i, j, group;

        if (node && node.tagName) { // only test HTMLElements

            // we need a root if off-doc
            if (!root && !Y.DOM.inDoc(node)) {
                parent = node.parentNode;
                if (parent) { 
                    root = parent;
                } else { // only use frag when no parent to query
                    frag = node[OWNER_DOCUMENT].createDocumentFragment();
                    frag.appendChild(node);
                    root = frag;
                    useFrag = true;
                }
            }
            root = root || node[OWNER_DOCUMENT];

            if (!node.id) {
                node.id = Y.guid();
            }
            for (i = 0; (group = groups[i++]);) { // TODO: off-dom test
                group += '[id="' + node.id + '"]';
                items = Y.Selector.query(group, root);

                for (j = 0; item = items[j++];) {
                    if (item === node) {
                        ret = true;
                        break;
                    }
                }
                if (ret) {
                    break;
                }
            }

            if (useFrag) { // cleanup
                frag.removeChild(node);
            }
        }

        return ret;
    },

    /**
     * A convenience function to emulate Y.Node's aNode.ancestor(selector).
     * @param {HTMLElement} element An HTMLElement to start the query from.
     * @param {String} selector The CSS selector to test the node against.
     * @return {HTMLElement} The ancestor node matching the selector, or null.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan 
     * @static
     * @method ancestor
     */
    ancestor: function (element, selector, testSelf) {
        return Y.DOM.ancestor(element, function(n) {
            return Y.Selector.test(n, selector);
        }, testSelf);
    }
};

Y.mix(Y.Selector, Selector, true);

})(Y);


}, '3.3.0' ,{requires:['dom-base']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('selector-css2', function(Y) {

/**
 * The selector module provides helper methods allowing CSS2 Selectors to be used with DOM elements.
 * @module dom
 * @submodule selector-css2
 * @for Selector
 */

/**
 * Provides helper methods for collecting and filtering DOM elements.
 */

var PARENT_NODE = 'parentNode',
    TAG_NAME = 'tagName',
    ATTRIBUTES = 'attributes',
    COMBINATOR = 'combinator',
    PSEUDOS = 'pseudos',

    Selector = Y.Selector,

    SelectorCSS2 = {
        _reRegExpTokens: /([\^\$\?\[\]\*\+\-\.\(\)\|\\])/, // TODO: move?
        SORT_RESULTS: true,
        _children: function(node, tag) {
            var ret = node.children,
                i,
                children = [],
                childNodes,
                child;

            if (node.children && tag && node.children.tags) {
                children = node.children.tags(tag);
            } else if ((!ret && node[TAG_NAME]) || (ret && tag)) { // only HTMLElements have children
                childNodes = ret || node.childNodes;
                ret = [];
                for (i = 0; (child = childNodes[i++]);) {
                    if (child.tagName) {
                        if (!tag || tag === child.tagName) {
                            ret.push(child);
                        }
                    }
                }
            }

            return ret || [];
        },

        _re: {
            //attr: /(\[.*\])/g,
            attr: /(\[[^\]]*\])/g,
            pseudos: /:([\-\w]+(?:\(?:['"]?(.+)['"]?\)))*/i
        },

        /**
         * Mapping of shorthand tokens to corresponding attribute selector 
         * @property shorthand
         * @type object
         */
        shorthand: {
            '\\#(-?[_a-z]+[-\\w]*)': '[id=$1]',
            '\\.(-?[_a-z]+[-\\w]*)': '[className~=$1]'
        },

        /**
         * List of operators and corresponding boolean functions. 
         * These functions are passed the attribute and the current node's value of the attribute.
         * @property operators
         * @type object
         */
        operators: {
            '': function(node, attr) { return Y.DOM.getAttribute(node, attr) !== ''; }, // Just test for existence of attribute
            //'': '.+',
            //'=': '^{val}$', // equality
            '~=': '(?:^|\\s+){val}(?:\\s+|$)', // space-delimited
            '|=': '^{val}-?' // optional hyphen-delimited
        },

        pseudos: {
           'first-child': function(node) { 
                return Y.Selector._children(node[PARENT_NODE])[0] === node; 
            } 
        },

        _bruteQuery: function(selector, root, firstOnly) {
            var ret = [],
                nodes = [],
                tokens = Selector._tokenize(selector),
                token = tokens[tokens.length - 1],
                rootDoc = Y.DOM._getDoc(root),
                child,
                id,
                className,
                tagName;


            // if we have an initial ID, set to root when in document
            /*
            if (tokens[0] && rootDoc === root &&  
                    (id = tokens[0].id) &&
                    rootDoc.getElementById(id)) {
                root = rootDoc.getElementById(id);
            }
            */

            if (token) {
                // prefilter nodes
                id = token.id;
                className = token.className;
                tagName = token.tagName || '*';

                if (root.getElementsByTagName) { // non-IE lacks DOM api on doc frags
                    // try ID first, unless no root.all && root not in document
                    // (root.all works off document, but not getElementById)
                    // TODO: move to allById?
                    if (id && (root.all || (root.nodeType === 9 || Y.DOM.inDoc(root)))) {
                        nodes = Y.DOM.allById(id, root);
                    // try className
                    } else if (className) {
                        nodes = root.getElementsByClassName(className);
                    } else { // default to tagName
                        nodes = root.getElementsByTagName(tagName);
                    }

                } else { // brute getElementsByTagName('*')
                    child = root.firstChild;
                    while (child) {
                        if (child.tagName) { // only collect HTMLElements
                            nodes.push(child);
                        }
                        child = child.nextSilbing || child.firstChild;
                    }
                }
                if (nodes.length) {
                    ret = Selector._filterNodes(nodes, tokens, firstOnly);
                }
            }

            return ret;
        },
        
        _filterNodes: function(nodes, tokens, firstOnly) {
            var i = 0,
                j,
                len = tokens.length,
                n = len - 1,
                result = [],
                node = nodes[0],
                tmpNode = node,
                getters = Y.Selector.getters,
                operator,
                combinator,
                token,
                path,
                pass,
                //FUNCTION = 'function',
                value,
                tests,
                test;

            //do {
            for (i = 0; (tmpNode = node = nodes[i++]);) {
                n = len - 1;
                path = null;
                
                testLoop:
                while (tmpNode && tmpNode.tagName) {
                    token = tokens[n];
                    tests = token.tests;
                    j = tests.length;
                    if (j && !pass) {
                        while ((test = tests[--j])) {
                            operator = test[1];
                            if (getters[test[0]]) {
                                value = getters[test[0]](tmpNode, test[0]);
                            } else {
                                value = tmpNode[test[0]];
                                // use getAttribute for non-standard attributes
                                if (value === undefined && tmpNode.getAttribute) {
                                    value = tmpNode.getAttribute(test[0]);
                                }
                            }

                            if ((operator === '=' && value !== test[2]) ||  // fast path for equality
                                (typeof operator !== 'string' && // protect against String.test monkey-patch (Moo)
                                operator.test && !operator.test(value)) ||  // regex test
                                (!operator.test && // protect against RegExp as function (webkit)
                                        typeof operator === 'function' && !operator(tmpNode, test[0]))) { // function test

                                // skip non element nodes or non-matching tags
                                if ((tmpNode = tmpNode[path])) {
                                    while (tmpNode &&
                                        (!tmpNode.tagName ||
                                            (token.tagName && token.tagName !== tmpNode.tagName))
                                    ) {
                                        tmpNode = tmpNode[path]; 
                                    }
                                }
                                continue testLoop;
                            }
                        }
                    }

                    n--; // move to next token
                    // now that we've passed the test, move up the tree by combinator
                    if (!pass && (combinator = token.combinator)) {
                        path = combinator.axis;
                        tmpNode = tmpNode[path];

                        // skip non element nodes
                        while (tmpNode && !tmpNode.tagName) {
                            tmpNode = tmpNode[path]; 
                        }

                        if (combinator.direct) { // one pass only
                            path = null; 
                        }

                    } else { // success if we made it this far
                        result.push(node);
                        if (firstOnly) {
                            return result;
                        }
                        break;
                    }
                }
            }// while (tmpNode = node = nodes[++i]);
            node = tmpNode = null;
            return result;
        },

        combinators: {
            ' ': {
                axis: 'parentNode'
            },

            '>': {
                axis: 'parentNode',
                direct: true
            },


            '+': {
                axis: 'previousSibling',
                direct: true
            }
        },

        _parsers: [
            {
                name: ATTRIBUTES,
                re: /^\[(-?[a-z]+[\w\-]*)+([~\|\^\$\*!=]=?)?['"]?([^\]]*?)['"]?\]/i,
                fn: function(match, token) {
                    var operator = match[2] || '',
                        operators = Y.Selector.operators,
                        test;

                    // add prefiltering for ID and CLASS
                    if ((match[1] === 'id' && operator === '=') ||
                            (match[1] === 'className' &&
                            Y.config.doc.documentElement.getElementsByClassName &&
                            (operator === '~=' || operator === '='))) {
                        token.prefilter = match[1];
                        token[match[1]] = match[3];
                    }

                    // add tests
                    if (operator in operators) {
                        test = operators[operator];
                        if (typeof test === 'string') {
                            match[3] = match[3].replace(Y.Selector._reRegExpTokens, '\\$1');
                            test = Y.DOM._getRegExp(test.replace('{val}', match[3]));
                        }
                        match[2] = test;
                    }
                    if (!token.last || token.prefilter !== match[1]) {
                        return match.slice(1);
                    }
                }

            },
            {
                name: TAG_NAME,
                re: /^((?:-?[_a-z]+[\w-]*)|\*)/i,
                fn: function(match, token) {
                    var tag = match[1].toUpperCase();
                    token.tagName = tag;

                    if (tag !== '*' && (!token.last || token.prefilter)) {
                        return [TAG_NAME, '=', tag];
                    }
                    if (!token.prefilter) {
                        token.prefilter = 'tagName';
                    }
                }
            },
            {
                name: COMBINATOR,
                re: /^\s*([>+~]|\s)\s*/,
                fn: function(match, token) {
                }
            },
            {
                name: PSEUDOS,
                re: /^:([\-\w]+)(?:\(['"]?(.+)['"]?\))*/i,
                fn: function(match, token) {
                    var test = Selector[PSEUDOS][match[1]];
                    if (test) { // reorder match array
                        return [match[2], test];
                    } else { // selector token not supported (possibly missing CSS3 module)
                        return false;
                    }
                }
            }
            ],

        _getToken: function(token) {
            return {
                tagName: null,
                id: null,
                className: null,
                attributes: {},
                combinator: null,
                tests: []
            };
        },

        /**
            Break selector into token units per simple selector.
            Combinator is attached to the previous token.
         */
        _tokenize: function(selector) {
            selector = selector || '';
            selector = Selector._replaceShorthand(Y.Lang.trim(selector)); 
            var token = Selector._getToken(),     // one token per simple selector (left selector holds combinator)
                query = selector, // original query for debug report
                tokens = [],    // array of tokens
                found = false,  // whether or not any matches were found this pass
                match,         // the regex match
                test,
                i, parser;

            /*
                Search for selector patterns, store, and strip them from the selector string
                until no patterns match (invalid selector) or we run out of chars.

                Multiple attributes and pseudos are allowed, in any order.
                for example:
                    'form:first-child[type=button]:not(button)[lang|=en]'
            */
            outer:
            do {
                found = false; // reset after full pass
                for (i = 0; (parser = Selector._parsers[i++]);) {
                    if ( (match = parser.re.exec(selector)) ) { // note assignment
                        if (parser.name !== COMBINATOR ) {
                            token.selector = selector;
                        }
                        selector = selector.replace(match[0], ''); // strip current match from selector
                        if (!selector.length) {
                            token.last = true;
                        }

                        if (Selector._attrFilters[match[1]]) { // convert class to className, etc.
                            match[1] = Selector._attrFilters[match[1]];
                        }

                        test = parser.fn(match, token);
                        if (test === false) { // selector not supported
                            found = false;
                            break outer;
                        } else if (test) {
                            token.tests.push(test);
                        }

                        if (!selector.length || parser.name === COMBINATOR) {
                            tokens.push(token);
                            token = Selector._getToken(token);
                            if (parser.name === COMBINATOR) {
                                token.combinator = Y.Selector.combinators[match[1]];
                            }
                        }
                        found = true;
                    }
                }
            } while (found && selector.length);

            if (!found || selector.length) { // not fully parsed
                tokens = [];
            }
            return tokens;
        },

        _replaceShorthand: function(selector) {
            var shorthand = Selector.shorthand,
                attrs = selector.match(Selector._re.attr), // pull attributes to avoid false pos on "." and "#"
                pseudos = selector.match(Selector._re.pseudos), // pull attributes to avoid false pos on "." and "#"
                re, i, len;

            if (pseudos) {
                selector = selector.replace(Selector._re.pseudos, '!!REPLACED_PSEUDO!!');
            }

            if (attrs) {
                selector = selector.replace(Selector._re.attr, '!!REPLACED_ATTRIBUTE!!');
            }

            for (re in shorthand) {
                if (shorthand.hasOwnProperty(re)) {
                    selector = selector.replace(Y.DOM._getRegExp(re, 'gi'), shorthand[re]);
                }
            }

            if (attrs) {
                for (i = 0, len = attrs.length; i < len; ++i) {
                    selector = selector.replace('!!REPLACED_ATTRIBUTE!!', attrs[i]);
                }
            }
            if (pseudos) {
                for (i = 0, len = pseudos.length; i < len; ++i) {
                    selector = selector.replace('!!REPLACED_PSEUDO!!', pseudos[i]);
                }
            }
            return selector;
        },

        _attrFilters: {
            'class': 'className',
            'for': 'htmlFor'
        },

        getters: {
            href: function(node, attr) {
                return Y.DOM.getAttribute(node, attr);
            }
        }
    };

Y.mix(Y.Selector, SelectorCSS2, true);
Y.Selector.getters.src = Y.Selector.getters.rel = Y.Selector.getters.href;

// IE wants class with native queries
if (Y.Selector.useNative && Y.config.doc.querySelector) {
    Y.Selector.shorthand['\\.(-?[_a-z]+[-\\w]*)'] = '[class~=$1]';
}



}, '3.3.0' ,{requires:['selector-native']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('node-base', function(Y) {

/**
 * The Node Utility provides a DOM-like interface for interacting with DOM nodes.
 * @module node
 * @submodule node-base
 */

/**
 * The Node class provides a wrapper for manipulating DOM Nodes.
 * Node properties can be accessed via the set/get methods.
 * Use Y.get() to retrieve Node instances.
 *
 * <strong>NOTE:</strong> Node properties are accessed using
 * the <code>set</code> and <code>get</code> methods.
 *
 * @class Node
 * @constructor
 * @param {DOMNode} node the DOM node to be mapped to the Node instance.
 * @for Node
 */

// "globals"
var DOT = '.',
    NODE_NAME = 'nodeName',
    NODE_TYPE = 'nodeType',
    OWNER_DOCUMENT = 'ownerDocument',
    TAG_NAME = 'tagName',
    UID = '_yuid',

    _slice = Array.prototype.slice,

    Y_DOM = Y.DOM,

    Y_Node = function(node) {
        var uid = (node.nodeType !== 9) ? node.uniqueID : node[UID];

        if (uid && Y_Node._instances[uid] && Y_Node._instances[uid]._node !== node) {
            node[UID] = null; // unset existing uid to prevent collision (via clone or hack)
        }

        uid = uid || Y.stamp(node);
        if (!uid) { // stamp failed; likely IE non-HTMLElement
            uid = Y.guid();
        }

        this[UID] = uid;

        /**
         * The underlying DOM node bound to the Y.Node instance
         * @property _node
         * @private
         */
        this._node = node;
        Y_Node._instances[uid] = this;

        this._stateProxy = node; // when augmented with Attribute

        Y.EventTarget.call(this, {emitFacade:true});

        if (this._initPlugins) { // when augmented with Plugin.Host
            this._initPlugins();
        }

        this.SHOW_TRANSITION = Y_Node.SHOW_TRANSITION;
        this.HIDE_TRANSITION = Y_Node.HIDE_TRANSITION;
    },

    // used with previous/next/ancestor tests
    _wrapFn = function(fn) {
        var ret = null;
        if (fn) {
            ret = (typeof fn == 'string') ?
            function(n) {
                return Y.Selector.test(n, fn);
            } :
            function(n) {
                return fn(Y.one(n));
            };
        }

        return ret;
    };
// end "globals"

/**
 * The name of the component
 * @static
 * @property NAME
 */
Y_Node.NAME = 'node';

/*
 * The pattern used to identify ARIA attributes
 */
Y_Node.re_aria = /^(?:role$|aria-)/;

Y_Node.SHOW_TRANSITION = 'fadeIn';
Y_Node.HIDE_TRANSITION = 'fadeOut';

/**
 * List of events that route to DOM events
 * @static
 * @property DOM_EVENTS
 */

Y_Node.DOM_EVENTS = {
    abort: 1,
    beforeunload: 1,
    blur: 1,
    change: 1,
    click: 1,
    close: 1,
    command: 1,
    contextmenu: 1,
    dblclick: 1,
    DOMMouseScroll: 1,
    drag: 1,
    dragstart: 1,
    dragenter: 1,
    dragover: 1,
    dragleave: 1,
    dragend: 1,
    drop: 1,
    error: 1,
    focus: 1,
    key: 1,
    keydown: 1,
    keypress: 1,
    keyup: 1,
    load: 1,
    message: 1,
    mousedown: 1,
    mouseenter: 1,
    mouseleave: 1,
    mousemove: 1,
    mousemultiwheel: 1,
    mouseout: 1,
    mouseover: 1,
    mouseup: 1,
    mousewheel: 1,
    orientationchange: 1,
    reset: 1,
    resize: 1,
    select: 1,
    selectstart: 1,
    submit: 1,
    scroll: 1,
    textInput: 1,
    unload: 1
};

// Add custom event adaptors to this list.  This will make it so
// that delegate, key, available, contentready, etc all will
// be available through Node.on
Y.mix(Y_Node.DOM_EVENTS, Y.Env.evt.plugins);

/**
 * A list of Node instances that have been created
 * @private
 * @property _instances
 * @static
 *
 */
Y_Node._instances = {};

/**
 * Retrieves the DOM node bound to a Node instance
 * @method getDOMNode
 * @static
 *
 * @param {Y.Node || HTMLNode} node The Node instance or an HTMLNode
 * @return {HTMLNode} The DOM node bound to the Node instance.  If a DOM node is passed
 * as the node argument, it is simply returned.
 */
Y_Node.getDOMNode = function(node) {
    if (node) {
        return (node.nodeType) ? node : node._node || null;
    }
    return null;
};

/**
 * Checks Node return values and wraps DOM Nodes as Y.Node instances
 * and DOM Collections / Arrays as Y.NodeList instances.
 * Other return values just pass thru.  If undefined is returned (e.g. no return)
 * then the Node instance is returned for chainability.
 * @method scrubVal
 * @static
 *
 * @param {any} node The Node instance or an HTMLNode
 * @return {Y.Node | Y.NodeList | any} Depends on what is returned from the DOM node.
 */
Y_Node.scrubVal = function(val, node) {
    if (val) { // only truthy values are risky
         if (typeof val == 'object' || typeof val == 'function') { // safari nodeList === function
            if (NODE_TYPE in val || Y_DOM.isWindow(val)) {// node || window
                val = Y.one(val);
            } else if ((val.item && !val._nodes) || // dom collection or Node instance
                    (val[0] && val[0][NODE_TYPE])) { // array of DOM Nodes
                val = Y.all(val);
            }
        }
    } else if (typeof val === 'undefined') {
        val = node; // for chaining
    } else if (val === null) {
        val = null; // IE: DOM null not the same as null
    }

    return val;
};

/**
 * Adds methods to the Y.Node prototype, routing through scrubVal.
 * @method addMethod
 * @static
 *
 * @param {String} name The name of the method to add
 * @param {Function} fn The function that becomes the method
 * @param {Object} context An optional context to call the method with
 * (defaults to the Node instance)
 * @return {any} Depends on what is returned from the DOM node.
 */
Y_Node.addMethod = function(name, fn, context) {
    if (name && fn && typeof fn == 'function') {
        Y_Node.prototype[name] = function() {
            var args = _slice.call(arguments),
                node = this,
                ret;

            if (args[0] && Y.instanceOf(args[0], Y_Node)) {
                args[0] = args[0]._node;
            }

            if (args[1] && Y.instanceOf(args[1], Y_Node)) {
                args[1] = args[1]._node;
            }
            args.unshift(node._node);

            ret = fn.apply(node, args);

            if (ret) { // scrub truthy
                ret = Y_Node.scrubVal(ret, node);
            }

            (typeof ret != 'undefined') || (ret = node);
            return ret;
        };
    } else {
    }
};

/**
 * Imports utility methods to be added as Y.Node methods.
 * @method importMethod
 * @static
 *
 * @param {Object} host The object that contains the method to import.
 * @param {String} name The name of the method to import
 * @param {String} altName An optional name to use in place of the host name
 * @param {Object} context An optional context to call the method with
 */
Y_Node.importMethod = function(host, name, altName) {
    if (typeof name == 'string') {
        altName = altName || name;
        Y_Node.addMethod(altName, host[name], host);
    } else {
        Y.Array.each(name, function(n) {
            Y_Node.importMethod(host, n);
        });
    }
};

/**
 * Returns a single Node instance bound to the node or the
 * first element matching the given selector. Returns null if no match found.
 * <strong>Note:</strong> For chaining purposes you may want to
 * use <code>Y.all</code>, which returns a NodeList when no match is found.
 * @method Y.one
 * @static
 * @param {String | HTMLElement} node a node or Selector
 * @return {Y.Node | null} a Node instance or null if no match found.
 */
Y_Node.one = function(node) {
    var instance = null,
        cachedNode,
        uid;

    if (node) {
        if (typeof node == 'string') {
            if (node.indexOf('doc') === 0) { // doc OR document
                node = Y.config.doc;
            } else if (node.indexOf('win') === 0) { // win OR window
                node = Y.config.win;
            } else {
                node = Y.Selector.query(node, null, true);
            }
            if (!node) {
                return null;
            }
        } else if (Y.instanceOf(node, Y_Node)) {
            return node; // NOTE: return
        }

        if (node.nodeType || Y.DOM.isWindow(node)) { // avoid bad input (numbers, boolean, etc)
            uid = (node.uniqueID && node.nodeType !== 9) ? node.uniqueID : node._yuid;
            instance = Y_Node._instances[uid]; // reuse exising instances
            cachedNode = instance ? instance._node : null;
            if (!instance || (cachedNode && node !== cachedNode)) { // new Node when nodes don't match
                instance = new Y_Node(node);
            }
        }
    }
    return instance;
};

/**
 * Returns a new dom node using the provided markup string.
 * @method create
 * @static
 * @param {String} html The markup used to create the element
 * @param {HTMLDocument} doc An optional document context
 * @return {Node} A Node instance bound to a DOM node or fragment
 */
Y_Node.create = function(html, doc) {
    if (doc && doc._node) {
        doc = doc._node;
    }
    return Y.one(Y_DOM.create(html, doc));
};

/**
 * Static collection of configuration attributes for special handling
 * @property ATTRS
 * @static
 * @type object
 */
Y_Node.ATTRS = {
    /**
     * Allows for getting and setting the text of an element.
     * Formatting is preserved and special characters are treated literally.
     * @config text
     * @type String
     */
    text: {
        getter: function() {
            return Y_DOM.getText(this._node);
        },

        setter: function(content) {
            Y_DOM.setText(this._node, content);
            return content;
        }
    },

    'options': {
        getter: function() {
            return this._node.getElementsByTagName('option');
        }
    },

    /**
     * Returns a NodeList instance of all HTMLElement children.
     * @readOnly
     * @config children
     * @type NodeList
     */
    'children': {
        getter: function() {
            var node = this._node,
                children = node.children,
                childNodes, i, len;

            if (!children) {
                childNodes = node.childNodes;
                children = [];

                for (i = 0, len = childNodes.length; i < len; ++i) {
                    if (childNodes[i][TAG_NAME]) {
                        children[children.length] = childNodes[i];
                    }
                }
            }
            return Y.all(children);
        }
    },

    value: {
        getter: function() {
            return Y_DOM.getValue(this._node);
        },

        setter: function(val) {
            Y_DOM.setValue(this._node, val);
            return val;
        }
    }
};

/**
 * The default setter for DOM properties
 * Called with instance context (this === the Node instance)
 * @method DEFAULT_SETTER
 * @static
 * @param {String} name The attribute/property being set
 * @param {any} val The value to be set
 * @return {any} The value
 */
Y_Node.DEFAULT_SETTER = function(name, val) {
    var node = this._stateProxy,
        strPath;

    if (name.indexOf(DOT) > -1) {
        strPath = name;
        name = name.split(DOT);
        // only allow when defined on node
        Y.Object.setValue(node, name, val);
    } else if (typeof node[name] != 'undefined') { // pass thru DOM properties
        node[name] = val;
    }

    return val;
};

/**
 * The default getter for DOM properties
 * Called with instance context (this === the Node instance)
 * @method DEFAULT_GETTER
 * @static
 * @param {String} name The attribute/property to look up
 * @return {any} The current value
 */
Y_Node.DEFAULT_GETTER = function(name) {
    var node = this._stateProxy,
        val;

    if (name.indexOf && name.indexOf(DOT) > -1) {
        val = Y.Object.getValue(node, name.split(DOT));
    } else if (typeof node[name] != 'undefined') { // pass thru from DOM
        val = node[name];
    }

    return val;
};

// Basic prototype augment - no lazy constructor invocation.
Y.mix(Y_Node, Y.EventTarget, false, null, 1);

Y.mix(Y_Node.prototype, {
/**
 * The method called when outputting Node instances as strings
 * @method toString
 * @return {String} A string representation of the Node instance
 */
    toString: function() {
        var str = this[UID] + ': not bound to a node',
            node = this._node,
            attrs, id, className;

        if (node) {
            attrs = node.attributes;
            id = (attrs && attrs.id) ? node.getAttribute('id') : null;
            className = (attrs && attrs.className) ? node.getAttribute('className') : null;
            str = node[NODE_NAME];

            if (id) {
                str += '#' + id;
            }

            if (className) {
                str += '.' + className.replace(' ', '.');
            }

            // TODO: add yuid?
            str += ' ' + this[UID];
        }
        return str;
    },

    /**
     * Returns an attribute value on the Node instance.
     * Unless pre-configured (via Node.ATTRS), get hands
     * off to the underlying DOM node.  Only valid
     * attributes/properties for the node will be set.
     * @method get
     * @param {String} attr The attribute
     * @return {any} The current value of the attribute
     */
    get: function(attr) {
        var val;

        if (this._getAttr) { // use Attribute imple
            val = this._getAttr(attr);
        } else {
            val = this._get(attr);
        }

        if (val) {
            val = Y_Node.scrubVal(val, this);
        } else if (val === null) {
            val = null; // IE: DOM null is not true null (even though they ===)
        }
        return val;
    },

    /**
     * Helper method for get.
     * @method _get
     * @private
     * @param {String} attr The attribute
     * @return {any} The current value of the attribute
     */
    _get: function(attr) {
        var attrConfig = Y_Node.ATTRS[attr],
            val;

        if (attrConfig && attrConfig.getter) {
            val = attrConfig.getter.call(this);
        } else if (Y_Node.re_aria.test(attr)) {
            val = this._node.getAttribute(attr, 2);
        } else {
            val = Y_Node.DEFAULT_GETTER.apply(this, arguments);
        }

        return val;
    },

    /**
     * Sets an attribute on the Node instance.
     * Unless pre-configured (via Node.ATTRS), set hands
     * off to the underlying DOM node.  Only valid
     * attributes/properties for the node will be set.
     * To set custom attributes use setAttribute.
     * @method set
     * @param {String} attr The attribute to be set.
     * @param {any} val The value to set the attribute to.
     * @chainable
     */
    set: function(attr, val) {
        var attrConfig = Y_Node.ATTRS[attr];

        if (this._setAttr) { // use Attribute imple
            this._setAttr.apply(this, arguments);
        } else { // use setters inline
            if (attrConfig && attrConfig.setter) {
                attrConfig.setter.call(this, val, attr);
            } else if (Y_Node.re_aria.test(attr)) { // special case Aria
                this._node.setAttribute(attr, val);
            } else {
                Y_Node.DEFAULT_SETTER.apply(this, arguments);
            }
        }

        return this;
    },

    /**
     * Sets multiple attributes.
     * @method setAttrs
     * @param {Object} attrMap an object of name/value pairs to set
     * @chainable
     */
    setAttrs: function(attrMap) {
        if (this._setAttrs) { // use Attribute imple
            this._setAttrs(attrMap);
        } else { // use setters inline
            Y.Object.each(attrMap, function(v, n) {
                this.set(n, v);
            }, this);
        }

        return this;
    },

    /**
     * Returns an object containing the values for the requested attributes.
     * @method getAttrs
     * @param {Array} attrs an array of attributes to get values
     * @return {Object} An object with attribute name/value pairs.
     */
    getAttrs: function(attrs) {
        var ret = {};
        if (this._getAttrs) { // use Attribute imple
            this._getAttrs(attrs);
        } else { // use setters inline
            Y.Array.each(attrs, function(v, n) {
                ret[v] = this.get(v);
            }, this);
        }

        return ret;
    },

    /**
     * Creates a new Node using the provided markup string.
     * @method create
     * @param {String} html The markup used to create the element
     * @param {HTMLDocument} doc An optional document context
     * @return {Node} A Node instance bound to a DOM node or fragment
     */
    create: Y_Node.create,

    /**
     * Compares nodes to determine if they match.
     * Node instances can be compared to each other and/or HTMLElements.
     * @method compareTo
     * @param {HTMLElement | Node} refNode The reference node to compare to the node.
     * @return {Boolean} True if the nodes match, false if they do not.
     */
    compareTo: function(refNode) {
        var node = this._node;

        if (Y.instanceOf(refNode, Y_Node)) {
            refNode = refNode._node;
        }
        return node === refNode;
    },

    /**
     * Determines whether the node is appended to the document.
     * @method inDoc
     * @param {Node|HTMLElement} doc optional An optional document to check against.
     * Defaults to current document.
     * @return {Boolean} Whether or not this node is appended to the document.
     */
    inDoc: function(doc) {
        var node = this._node;
        doc = (doc) ? doc._node || doc : node[OWNER_DOCUMENT];
        if (doc.documentElement) {
            return Y_DOM.contains(doc.documentElement, node);
        }
    },

    getById: function(id) {
        var node = this._node,
            ret = Y_DOM.byId(id, node[OWNER_DOCUMENT]);
        if (ret && Y_DOM.contains(node, ret)) {
            ret = Y.one(ret);
        } else {
            ret = null;
        }
        return ret;
    },

   /**
     * Returns the nearest ancestor that passes the test applied by supplied boolean method.
     * @method ancestor
     * @param {String | Function} fn A selector string or boolean method for testing elements.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} The matching Node instance or null if not found
     */
    ancestor: function(fn, testSelf) {
        return Y.one(Y_DOM.ancestor(this._node, _wrapFn(fn), testSelf));
    },

   /**
     * Returns the ancestors that pass the test applied by supplied boolean method.
     * @method ancestors
     * @param {String | Function} fn A selector string or boolean method for testing elements.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {NodeList} A NodeList instance containing the matching elements 
     */
    ancestors: function(fn, testSelf) {
        return Y.all(Y_DOM.ancestors(this._node, _wrapFn(fn), testSelf));
    },

    /**
     * Returns the previous matching sibling.
     * Returns the nearest element node sibling if no method provided.
     * @method previous
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} Node instance or null if not found
     */
    previous: function(fn, all) {
        return Y.one(Y_DOM.elementByAxis(this._node, 'previousSibling', _wrapFn(fn), all));
    },

    /**
     * Returns the next matching sibling.
     * Returns the nearest element node sibling if no method provided.
     * @method next
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} Node instance or null if not found
     */
    next: function(fn, all) {
        return Y.one(Y_DOM.elementByAxis(this._node, 'nextSibling', _wrapFn(fn), all));
    },

    /**
     * Returns all matching siblings.
     * Returns all siblings if no method provided.
     * @method siblings
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {NodeList} NodeList instance bound to found siblings
     */
    siblings: function(fn) {
        return Y.all(Y_DOM.siblings(this._node, _wrapFn(fn)));
    },

    /**
     * Retrieves a Node instance of nodes based on the given CSS selector.
     * @method one
     *
     * @param {string} selector The CSS selector to test against.
     * @return {Node} A Node instance for the matching HTMLElement.
     */
    one: function(selector) {
        return Y.one(Y.Selector.query(selector, this._node, true));
    },

    /**
     * Retrieves a nodeList based on the given CSS selector.
     * @method all
     *
     * @param {string} selector The CSS selector to test against.
     * @return {NodeList} A NodeList instance for the matching HTMLCollection/Array.
     */
    all: function(selector) {
        var nodelist = Y.all(Y.Selector.query(selector, this._node));
        nodelist._query = selector;
        nodelist._queryRoot = this._node;
        return nodelist;
    },

    // TODO: allow fn test
    /**
     * Test if the supplied node matches the supplied selector.
     * @method test
     *
     * @param {string} selector The CSS selector to test against.
     * @return {boolean} Whether or not the node matches the selector.
     */
    test: function(selector) {
        return Y.Selector.test(this._node, selector);
    },

    /**
     * Removes the node from its parent.
     * Shortcut for myNode.get('parentNode').removeChild(myNode);
     * @method remove
     * @param {Boolean} destroy whether or not to call destroy() on the node
     * after removal.
     * @chainable
     *
     */
    remove: function(destroy) {
        var node = this._node,
            parentNode = node.parentNode;

        if (parentNode) {
            parentNode.removeChild(node);
        }

        if (destroy) {
            this.destroy();
        }

        return this;
    },

    /**
     * Replace the node with the other node. This is a DOM update only
     * and does not change the node bound to the Node instance.
     * Shortcut for myNode.get('parentNode').replaceChild(newNode, myNode);
     * @method replace
     * @param {Y.Node || HTMLNode} newNode Node to be inserted
     * @chainable
     *
     */
    replace: function(newNode) {
        var node = this._node;
        if (typeof newNode == 'string') {
            newNode = Y_Node.create(newNode);
        }
        node.parentNode.replaceChild(Y_Node.getDOMNode(newNode), node);
        return this;
    },

    /**
     * @method replaceChild
     * @for Node
     * @param {String | HTMLElement | Node} node Node to be inserted 
     * @param {HTMLElement | Node} refNode Node to be replaced 
     * @return {Node} The replaced node
     */
    replaceChild: function(node, refNode) {
        if (typeof node == 'string') {
            node = Y_DOM.create(node);
        }

        return Y.one(this._node.replaceChild(Y_Node.getDOMNode(node), Y_Node.getDOMNode(refNode)));
    },

    /**
     * @method appendChild
     * @param {String | HTMLElement | Node} node Node to be appended 
     * @return {Node} The appended node 
     */
    appendChild: function(node) {
        return Y_Node.scrubVal(this._insert(node));
    },

    /**
     * @method insertBefore
     * @param {String | HTMLElement | Node} newNode Node to be appended 
     * @param {HTMLElement | Node} refNode Node to be inserted before 
     * @return {Node} The inserted node 
     */
    insertBefore: function(newNode, refNode) {
        return Y.Node.scrubVal(this._insert(newNode, refNode));
    },

    /**
     * Removes event listeners from the node and (optionally) its subtree
     * @method purge
     * @param {Boolean} recurse (optional) Whether or not to remove listeners from the
     * node's subtree
     * @param {String} type (optional) Only remove listeners of the specified type
     * @chainable
     *
     */
    purge: function(recurse, type) {
        Y.Event.purgeElement(this._node, recurse, type);
        return this;
    },

    /**
     * Nulls internal node references, removes any plugins and event listeners
     * @method destroy
     * @param {Boolean} recursivePurge (optional) Whether or not to remove listeners from the
     * node's subtree (default is false)
     *
     */
    destroy: function(recursive) {
        this.purge(); // TODO: only remove events add via this Node

        if (this.unplug) { // may not be a PluginHost
            this.unplug();
        }

        this.clearData();

        if (recursive) {
            this.all('*').destroy();
        }

        this._node = null;
        this._stateProxy = null;

        delete Y_Node._instances[this[UID]];
    },

    /**
     * Invokes a method on the Node instance
     * @method invoke
     * @param {String} method The name of the method to invoke
     * @param {Any}  a, b, c, etc. Arguments to invoke the method with.
     * @return Whatever the underly method returns.
     * DOM Nodes and Collections return values
     * are converted to Node/NodeList instances.
     *
     */
    invoke: function(method, a, b, c, d, e) {
        var node = this._node,
            ret;

        if (a && Y.instanceOf(a, Y_Node)) {
            a = a._node;
        }

        if (b && Y.instanceOf(b, Y_Node)) {
            b = b._node;
        }

        ret = node[method](a, b, c, d, e);
        return Y_Node.scrubVal(ret, this);
    },

    /**
     * Inserts the content before the reference node.
     * @method insert
     * @param {String | Y.Node | HTMLElement | Y.NodeList | HTMLCollection} content The content to insert
     * @param {Int | Y.Node | HTMLElement | String} where The position to insert at.
     * Possible "where" arguments
     * <dl>
     * <dt>Y.Node</dt>
     * <dd>The Node to insert before</dd>
     * <dt>HTMLElement</dt>
     * <dd>The element to insert before</dd>
     * <dt>Int</dt>
     * <dd>The index of the child element to insert before</dd>
     * <dt>"replace"</dt>
     * <dd>Replaces the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts before the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts content before the node</dd>
     * <dt>"after"</dt>
     * <dd>Inserts content after the node</dd>
     * </dl>
     * @chainable
     */
    insert: function(content, where) {
        this._insert(content, where);
        return this;
    },

    _insert: function(content, where) {
        var node = this._node,
            ret = null;

        if (typeof where == 'number') { // allow index
            where = this._node.childNodes[where];
        } else if (where && where._node) { // Node
            where = where._node;
        }

        if (content && typeof content != 'string') { // allow Node or NodeList/Array instances
            content = content._node || content._nodes || content;
        }
        ret = Y_DOM.addHTML(node, content, where);

        return ret;
    },

    /**
     * Inserts the content as the firstChild of the node.
     * @method prepend
     * @param {String | Y.Node | HTMLElement} content The content to insert
     * @chainable
     */
    prepend: function(content) {
        return this.insert(content, 0);
    },

    /**
     * Inserts the content as the lastChild of the node.
     * @method append
     * @param {String | Y.Node | HTMLElement} content The content to insert
     * @chainable
     */
    append: function(content) {
        return this.insert(content, null);
    },

    /**
     * Appends the node to the given node. 
     * @method appendTo
     * @param {Y.Node | HTMLElement} node The node to append to
     * @chainable
     */
    appendTo: function(node) {
        Y.one(node).append(this);
        return this;
    },

    /**
     * Replaces the node's current content with the content.
     * @method setContent
     * @param {String | Y.Node | HTMLElement | Y.NodeList | HTMLCollection} content The content to insert
     * @chainable
     */
    setContent: function(content) {
        this._insert(content, 'replace');
        return this;
    },

    /**
     * Returns the node's current content (e.g. innerHTML) 
     * @method getContent
     * @return {String} The current content
     */
    getContent: function(content) {
        return this.get('innerHTML');
    },

    /**
    * @method swap
    * @description Swap DOM locations with the given node.
    * This does not change which DOM node each Node instance refers to.
    * @param {Node} otherNode The node to swap with
     * @chainable
    */
    swap: Y.config.doc.documentElement.swapNode ?
        function(otherNode) {
            this._node.swapNode(Y_Node.getDOMNode(otherNode));
        } :
        function(otherNode) {
            otherNode = Y_Node.getDOMNode(otherNode);
            var node = this._node,
                parent = otherNode.parentNode,
                nextSibling = otherNode.nextSibling;

            if (nextSibling === node) {
                parent.insertBefore(node, otherNode);
            } else if (otherNode === node.nextSibling) {
                parent.insertBefore(otherNode, node);
            } else {
                node.parentNode.replaceChild(otherNode, node);
                Y_DOM.addHTML(parent, node, nextSibling);
            }
            return this;
        },


    /**
    * @method getData
    * @description Retrieves arbitrary data stored on a Node instance.
    * This is not stored with the DOM node.
    * @param {string} name Optional name of the data field to retrieve.
    * If no name is given, all data is returned.
    * @return {any | Object} Whatever is stored at the given field,
    * or an object hash of all fields.
    */
    getData: function(name) {
        var ret;
        this._data = this._data || {};
        if (arguments.length) {
            ret = this._data[name];
        } else {
            ret = this._data;
        }

        return ret;

    },

    /**
    * @method setData
    * @description Stores arbitrary data on a Node instance.
    * This is not stored with the DOM node.
    * @param {string} name The name of the field to set. If no name
    * is given, name is treated as the data and overrides any existing data.
    * @param {any} val The value to be assigned to the field.
    * @chainable
    */
    setData: function(name, val) {
        this._data = this._data || {};
        if (arguments.length > 1) {
            this._data[name] = val;
        } else {
            this._data = name;
        }

       return this;
    },

    /**
    * @method clearData
    * @description Clears stored data.
    * @param {string} name The name of the field to clear. If no name
    * is given, all data is cleared.
    * @chainable
    */
    clearData: function(name) {
        if ('_data' in this) {
            if (name) {
                delete this._data[name];
            } else {
                delete this._data;
            }
        }

        return this;
    },

    hasMethod: function(method) {
        var node = this._node;
        return !!(node && method in node &&
                typeof node[method] != 'unknown' &&
            (typeof node[method] == 'function' ||
                String(node[method]).indexOf('function') === 1)); // IE reports as object, prepends space
    },

    SHOW_TRANSITION: null,
    HIDE_TRANSITION: null,

    /**
     * Makes the node visible.
     * If the "transition" module is loaded, show optionally
     * animates the showing of the node using either the default
     * transition effect ('fadeIn'), or the given named effect.
     * @method show
     * @param {String} name A named Transition effect to use as the show effect. 
     * @param {Object} config Options to use with the transition. 
     * @param {Function} callback An optional function to run after the transition completes. 
     * @chainable
     */
    show: function(callback) {
        callback = arguments[arguments.length - 1];
        this.toggleView(true, callback);
        return this;
    },

    /**
     * The implementation for showing nodes.
     * Default is to toggle the style.display property.
     * @protected
     * @chainable
     */
    _show: function() {
        this.setStyle('display', '');

    },

    _isHidden: function() {
        return Y.DOM.getStyle(this._node, 'display') === 'none';
    },

    toggleView: function(on, callback) {
        this._toggleView.apply(this, arguments);
    },

    _toggleView: function(on, callback) {
        callback = arguments[arguments.length - 1];

        // base on current state if not forcing 
        if (typeof on != 'boolean') {
            on = (this._isHidden()) ? 1 : 0;
        }

        if (on) {
            this._show();
        }  else {
            this._hide();
        }

        if (typeof callback == 'function') {
            callback.call(this);
        }

        return this;
    },

    /**
     * Hides the node.
     * If the "transition" module is loaded, hide optionally
     * animates the hiding of the node using either the default
     * transition effect ('fadeOut'), or the given named effect.
     * @method hide
     * @param {String} name A named Transition effect to use as the show effect. 
     * @param {Object} config Options to use with the transition. 
     * @param {Function} callback An optional function to run after the transition completes. 
     * @chainable
     */
    hide: function(callback) {
        callback = arguments[arguments.length - 1];
        this.toggleView(false, callback);
        return this;
    },

    /**
     * The implementation for hiding nodes.
     * Default is to toggle the style.display property.
     * @protected
     * @chainable
     */
    _hide: function() {
        this.setStyle('display', 'none');
    },

    isFragment: function() {
        return (this.get('nodeType') === 11);
    },

    /**
     * Removes all of the child nodes from the node.
     * @param {Boolean} destroy Whether the nodes should also be destroyed. 
     * @chainable
     */
    empty: function(destroy) {
        this.get('childNodes').remove(destroy);
        return this;
    }

}, true);

Y.Node = Y_Node;
Y.one = Y.Node.one;
/**
 * The NodeList module provides support for managing collections of Nodes.
 * @module node
 * @submodule nodelist
 */

/**
 * The NodeList class provides a wrapper for manipulating DOM NodeLists.
 * NodeList properties can be accessed via the set/get methods.
 * Use Y.all() to retrieve NodeList instances.
 *
 * @class NodeList
 * @constructor
 */

var NodeList = function(nodes) {
    var tmp = [];
    if (typeof nodes === 'string') { // selector query
        this._query = nodes;
        nodes = Y.Selector.query(nodes);
    } else if (nodes.nodeType || Y_DOM.isWindow(nodes)) { // domNode || window
        nodes = [nodes];
    } else if (Y.instanceOf(nodes, Y.Node)) {
        nodes = [nodes._node];
    } else if (Y.instanceOf(nodes[0], Y.Node)) { // allow array of Y.Nodes
        Y.Array.each(nodes, function(node) {
            if (node._node) {
                tmp.push(node._node);
            }
        });
        nodes = tmp;
    } else { // array of domNodes or domNodeList (no mixed array of Y.Node/domNodes)
        nodes = Y.Array(nodes, 0, true);
    }

    /**
     * The underlying array of DOM nodes bound to the Y.NodeList instance
     * @property _nodes
     * @private
     */
    this._nodes = nodes;
};

NodeList.NAME = 'NodeList';

/**
 * Retrieves the DOM nodes bound to a NodeList instance
 * @method NodeList.getDOMNodes
 * @static
 *
 * @param {Y.NodeList} nodelist The NodeList instance
 * @return {Array} The array of DOM nodes bound to the NodeList
 */
NodeList.getDOMNodes = function(nodelist) {
    return (nodelist && nodelist._nodes) ? nodelist._nodes : nodelist;
};

NodeList.each = function(instance, fn, context) {
    var nodes = instance._nodes;
    if (nodes && nodes.length) {
        Y.Array.each(nodes, fn, context || instance);
    } else {
    }
};

NodeList.addMethod = function(name, fn, context) {
    if (name && fn) {
        NodeList.prototype[name] = function() {
            var ret = [],
                args = arguments;

            Y.Array.each(this._nodes, function(node) {
                var UID = (node.uniqueID && node.nodeType !== 9 ) ? 'uniqueID' : '_yuid',
                    instance = Y.Node._instances[node[UID]],
                    ctx,
                    result;

                if (!instance) {
                    instance = NodeList._getTempNode(node);
                }
                ctx = context || instance;
                result = fn.apply(ctx, args);
                if (result !== undefined && result !== instance) {
                    ret[ret.length] = result;
                }
            });

            // TODO: remove tmp pointer
            return ret.length ? ret : this;
        };
    } else {
    }
};

NodeList.importMethod = function(host, name, altName) {
    if (typeof name === 'string') {
        altName = altName || name;
        NodeList.addMethod(name, host[name]);
    } else {
        Y.Array.each(name, function(n) {
            NodeList.importMethod(host, n);
        });
    }
};

NodeList._getTempNode = function(node) {
    var tmp = NodeList._tempNode;
    if (!tmp) {
        tmp = Y.Node.create('<div></div>');
        NodeList._tempNode = tmp;
    }

    tmp._node = node;
    tmp._stateProxy = node;
    return tmp;
};

Y.mix(NodeList.prototype, {
    /**
     * Retrieves the Node instance at the given index.
     * @method item
     *
     * @param {Number} index The index of the target Node.
     * @return {Node} The Node instance at the given index.
     */
    item: function(index) {
        return Y.one((this._nodes || [])[index]);
    },

    /**
     * Applies the given function to each Node in the NodeList.
     * @method each
     * @param {Function} fn The function to apply. It receives 3 arguments:
     * the current node instance, the node's index, and the NodeList instance
     * @param {Object} context optional An optional context to apply the function with
     * Default context is the current Node instance
     * @chainable
     */
    each: function(fn, context) {
        var instance = this;
        Y.Array.each(this._nodes, function(node, index) {
            node = Y.one(node);
            return fn.call(context || node, node, index, instance);
        });
        return instance;
    },

    batch: function(fn, context) {
        var nodelist = this;

        Y.Array.each(this._nodes, function(node, index) {
            var instance = Y.Node._instances[node[UID]];
            if (!instance) {
                instance = NodeList._getTempNode(node);
            }

            return fn.call(context || instance, instance, index, nodelist);
        });
        return nodelist;
    },

    /**
     * Executes the function once for each node until a true value is returned.
     * @method some
     * @param {Function} fn The function to apply. It receives 3 arguments:
     * the current node instance, the node's index, and the NodeList instance
     * @param {Object} context optional An optional context to execute the function from.
     * Default context is the current Node instance
     * @return {Boolean} Whether or not the function returned true for any node.
     */
    some: function(fn, context) {
        var instance = this;
        return Y.Array.some(this._nodes, function(node, index) {
            node = Y.one(node);
            context = context || node;
            return fn.call(context, node, index, instance);
        });
    },

    /**
     * Creates a documenFragment from the nodes bound to the NodeList instance
     * @method toFrag
     * @return Node a Node instance bound to the documentFragment
     */
    toFrag: function() {
        return Y.one(Y.DOM._nl2frag(this._nodes));
    },

    /**
     * Returns the index of the node in the NodeList instance
     * or -1 if the node isn't found.
     * @method indexOf
     * @param {Y.Node || DOMNode} node the node to search for
     * @return {Int} the index of the node value or -1 if not found
     */
    indexOf: function(node) {
        return Y.Array.indexOf(this._nodes, Y.Node.getDOMNode(node));
    },

    /**
     * Filters the NodeList instance down to only nodes matching the given selector.
     * @method filter
     * @param {String} selector The selector to filter against
     * @return {NodeList} NodeList containing the updated collection
     * @see Selector
     */
    filter: function(selector) {
        return Y.all(Y.Selector.filter(this._nodes, selector));
    },


    /**
     * Creates a new NodeList containing all nodes at every n indices, where
     * remainder n % index equals r.
     * (zero-based index).
     * @method modulus
     * @param {Int} n The offset to use (return every nth node)
     * @param {Int} r An optional remainder to use with the modulus operation (defaults to zero)
     * @return {NodeList} NodeList containing the updated collection
     */
    modulus: function(n, r) {
        r = r || 0;
        var nodes = [];
        NodeList.each(this, function(node, i) {
            if (i % n === r) {
                nodes.push(node);
            }
        });

        return Y.all(nodes);
    },

    /**
     * Creates a new NodeList containing all nodes at odd indices
     * (zero-based index).
     * @method odd
     * @return {NodeList} NodeList containing the updated collection
     */
    odd: function() {
        return this.modulus(2, 1);
    },

    /**
     * Creates a new NodeList containing all nodes at even indices
     * (zero-based index), including zero.
     * @method even
     * @return {NodeList} NodeList containing the updated collection
     */
    even: function() {
        return this.modulus(2);
    },

    destructor: function() {
    },

    /**
     * Reruns the initial query, when created using a selector query
     * @method refresh
     * @chainable
     */
    refresh: function() {
        var doc,
            nodes = this._nodes,
            query = this._query,
            root = this._queryRoot;

        if (query) {
            if (!root) {
                if (nodes && nodes[0] && nodes[0].ownerDocument) {
                    root = nodes[0].ownerDocument;
                }
            }

            this._nodes = Y.Selector.query(query, root);
        }

        return this;
    },

    _prepEvtArgs: function(type, fn, context) {
        // map to Y.on/after signature (type, fn, nodes, context, arg1, arg2, etc)
        var args = Y.Array(arguments, 0, true);

        if (args.length < 2) { // type only (event hash) just add nodes
            args[2] = this._nodes;
        } else {
            args.splice(2, 0, this._nodes);
        }

        args[3] = context || this; // default to NodeList instance as context

        return args;
    },

    /**
     * Applies an event listener to each Node bound to the NodeList.
     * @method on
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance.
     * @param {Object} context The context to call the handler with.
     * param {mixed} arg* 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {Object} Returns an event handle that can later be use to detach().
     * @see Event.on
     */
    on: function(type, fn, context) {
        return Y.on.apply(Y, this._prepEvtArgs.apply(this, arguments));
    },

    /**
     * Applies an one-time event listener to each Node bound to the NodeList.
     * @method once
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance.
     * @return {Object} Returns an event handle that can later be use to detach().
     * @see Event.on
     */
    once: function(type, fn, context) {
        return Y.once.apply(Y, this._prepEvtArgs.apply(this, arguments));
    },

    /**
     * Applies an event listener to each Node bound to the NodeList.
     * The handler is called only after all on() handlers are called
     * and the event is not prevented.
     * @method after
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance.
     * @return {Object} Returns an event handle that can later be use to detach().
     * @see Event.on
     */
    after: function(type, fn, context) {
        return Y.after.apply(Y, this._prepEvtArgs.apply(this, arguments));
    },

    /**
     * Returns the current number of items in the NodeList.
     * @method size
     * @return {Int} The number of items in the NodeList.
     */
    size: function() {
        return this._nodes.length;
    },

    /**
     * Determines if the instance is bound to any nodes
     * @method isEmpty
     * @return {Boolean} Whether or not the NodeList is bound to any nodes
     */
    isEmpty: function() {
        return this._nodes.length < 1;
    },

    toString: function() {
        var str = '',
            errorMsg = this[UID] + ': not bound to any nodes',
            nodes = this._nodes,
            node;

        if (nodes && nodes[0]) {
            node = nodes[0];
            str += node[NODE_NAME];
            if (node.id) {
                str += '#' + node.id;
            }

            if (node.className) {
                str += '.' + node.className.replace(' ', '.');
            }

            if (nodes.length > 1) {
                str += '...[' + nodes.length + ' items]';
            }
        }
        return str || errorMsg;
    }

}, true);

NodeList.importMethod(Y.Node.prototype, [
    /**
     * Called on each Node instance
     * @for NodeList
     * @method append
     * @see Node.append
     */
    'append',

    /** Called on each Node instance
      * @method destroy
      * @see Node.destroy
      */
    'destroy',

    /**
      * Called on each Node instance
      * @method detach
      * @see Node.detach
      */
    'detach',

    /** Called on each Node instance
      * @method detachAll
      * @see Node.detachAll
      */
    'detachAll',

    /** Called on each Node instance
      * @method empty
      * @see Node.empty
      */
    'empty',

    /** Called on each Node instance
      * @method insert
      * @see Node.insert
      */
    'insert',

    /** Called on each Node instance
      * @method prepend
      * @see Node.prepend
      */
    'prepend',

    /** Called on each Node instance
      * @method remove
      * @see Node.remove
      */
    'remove',

    /** Called on each Node instance
      * @method set
      * @see Node.set
      */
    'set',

    /** Called on each Node instance
      * @method setContent
      * @see Node.setContent
      */
    'setContent',

    /**
     * Makes each node visible.
     * If the "transition" module is loaded, show optionally
     * animates the showing of the node using either the default
     * transition effect ('fadeIn'), or the given named effect.
     * @method show
     * @param {String} name A named Transition effect to use as the show effect. 
     * @param {Object} config Options to use with the transition. 
     * @param {Function} callback An optional function to run after the transition completes. 
     * @chainable
     */
    'show',

    /**
     * Hides each node.
     * If the "transition" module is loaded, hide optionally
     * animates the hiding of the node using either the default
     * transition effect ('fadeOut'), or the given named effect.
     * @method hide
     * @param {String} name A named Transition effect to use as the show effect. 
     * @param {Object} config Options to use with the transition. 
     * @param {Function} callback An optional function to run after the transition completes. 
     * @chainable
     */
    'hide',

    'toggleView'
]);

// one-off implementation to convert array of Nodes to NodeList
// e.g. Y.all('input').get('parentNode');

/** Called on each Node instance
  * @method get
  * @see Node
  */
NodeList.prototype.get = function(attr) {
    var ret = [],
        nodes = this._nodes,
        isNodeList = false,
        getTemp = NodeList._getTempNode,
        instance,
        val;

    if (nodes[0]) {
        instance = Y.Node._instances[nodes[0]._yuid] || getTemp(nodes[0]);
        val = instance._get(attr);
        if (val && val.nodeType) {
            isNodeList = true;
        }
    }

    Y.Array.each(nodes, function(node) {
        instance = Y.Node._instances[node._yuid];

        if (!instance) {
            instance = getTemp(node);
        }

        val = instance._get(attr);
        if (!isNodeList) { // convert array of Nodes to NodeList
            val = Y.Node.scrubVal(val, instance);
        }

        ret.push(val);
    });

    return (isNodeList) ? Y.all(ret) : ret;
};

Y.NodeList = NodeList;

Y.all = function(nodes) {
    return new NodeList(nodes);
};

Y.Node.all = Y.all;
Y.Array.each([
    /**
     * Passes through to DOM method.
     * @for Node
     * @method removeChild
     * @param {HTMLElement | Node} node Node to be removed 
     * @return {Node} The removed node 
     */
    'removeChild',

    /**
     * Passes through to DOM method.
     * @method hasChildNodes
     * @return {Boolean} Whether or not the node has any childNodes 
     */
    'hasChildNodes',

    /**
     * Passes through to DOM method.
     * @method cloneNode
     * @param {Boolean} deep Whether or not to perform a deep clone, which includes
     * subtree and attributes
     * @return {Node} The clone 
     */
    'cloneNode',

    /**
     * Passes through to DOM method.
     * @method hasAttribute
     * @param {String} attribute The attribute to test for 
     * @return {Boolean} Whether or not the attribute is present 
     */
    'hasAttribute',

    /**
     * Passes through to DOM method.
     * @method removeAttribute
     * @param {String} attribute The attribute to be removed 
     * @chainable
     */
    'removeAttribute',

    /**
     * Passes through to DOM method.
     * @method scrollIntoView
     * @chainable
     */
    'scrollIntoView',

    /**
     * Passes through to DOM method.
     * @method getElementsByTagName
     * @param {String} tagName The tagName to collect 
     * @return {NodeList} A NodeList representing the HTMLCollection
     */
    'getElementsByTagName',

    /**
     * Passes through to DOM method.
     * @method focus
     * @chainable
     */
    'focus',

    /**
     * Passes through to DOM method.
     * @method blur
     * @chainable
     */
    'blur',

    /**
     * Passes through to DOM method.
     * Only valid on FORM elements
     * @method submit
     * @chainable
     */
    'submit',

    /**
     * Passes through to DOM method.
     * Only valid on FORM elements
     * @method reset
     * @chainable
     */
    'reset',

    /**
     * Passes through to DOM method.
     * @method select
     * @chainable
     */
     'select',

    /**
     * Passes through to DOM method.
     * Only valid on TABLE elements
     * @method createCaption
     * @chainable
     */
    'createCaption'

], function(method) {
    Y.Node.prototype[method] = function(arg1, arg2, arg3) {
        var ret = this.invoke(method, arg1, arg2, arg3);
        return ret;
    };
});

Y.Node.importMethod(Y.DOM, [
    /**
     * Determines whether the node is an ancestor of another HTML element in the DOM hierarchy.
     * @method contains
     * @param {Node | HTMLElement} needle The possible node or descendent
     * @return {Boolean} Whether or not this node is the needle its ancestor
     */
    'contains',
    /**
     * Allows setting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method setAttribute
     * @for Node
     * @for NodeList
     * @chainable
     * @param {string} name The attribute name 
     * @param {string} value The value to set
     */
    'setAttribute',
    /**
     * Allows getting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method getAttribute
     * @for Node
     * @for NodeList
     * @param {string} name The attribute name 
     * @return {string} The attribute value 
     */
    'getAttribute',

    /**
     * Wraps the given HTML around the node.
     * @method wrap
     * @param {String} html The markup to wrap around the node. 
     * @chainable
     */
    'wrap',

    /**
     * Removes the node's parent node. 
     * @method unwrap
     * @chainable
     */
    'unwrap',

    /**
     * Applies a unique ID to the node if none exists
     * @method generateID
     * @return {String} The existing or generated ID
     */
    'generateID'
]);

Y.NodeList.importMethod(Y.Node.prototype, [
/**
 * Allows getting attributes on DOM nodes, normalizing in some cases.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method getAttribute
 * @see Node
 * @for NodeList
 * @param {string} name The attribute name 
 * @return {string} The attribute value 
 */

    'getAttribute',
/**
 * Allows setting attributes on DOM nodes, normalizing in some cases.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method setAttribute
 * @see Node
 * @for NodeList
 * @chainable
 * @param {string} name The attribute name 
 * @param {string} value The value to set
 */
    'setAttribute',
 
/**
 * Allows for removing attributes on DOM nodes.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method removeAttribute
 * @see Node
 * @for NodeList
 * @param {string} name The attribute to remove 
 */
    'removeAttribute',
/**
 * Removes the parent node from node in the list. 
 * @method unwrap
 * @chainable
 */
    'unwrap',
/**
 * Wraps the given HTML around each node.
 * @method wrap
 * @param {String} html The markup to wrap around the node. 
 * @chainable
 */
    'wrap',

/**
 * Applies a unique ID to each node if none exists
 * @method generateID
 * @return {String} The existing or generated ID
 */
    'generateID'
]);
(function(Y) {
    var methods = [
    /**
     * Determines whether each node has the given className.
     * @method hasClass
     * @for Node
     * @param {String} className the class name to search for
     * @return {Boolean} Whether or not the element has the specified class 
     */
     'hasClass',

    /**
     * Adds a class name to each node.
     * @method addClass         
     * @param {String} className the class name to add to the node's class attribute
     * @chainable
     */
     'addClass',

    /**
     * Removes a class name from each node.
     * @method removeClass         
     * @param {String} className the class name to remove from the node's class attribute
     * @chainable
     */
     'removeClass',

    /**
     * Replace a class with another class for each node.
     * If no oldClassName is present, the newClassName is simply added.
     * @method replaceClass  
     * @param {String} oldClassName the class name to be replaced
     * @param {String} newClassName the class name that will be replacing the old class name
     * @chainable
     */
     'replaceClass',

    /**
     * If the className exists on the node it is removed, if it doesn't exist it is added.
     * @method toggleClass  
     * @param {String} className the class name to be toggled
     * @param {Boolean} force Option to force adding or removing the class. 
     * @chainable
     */
     'toggleClass'
    ];

    Y.Node.importMethod(Y.DOM, methods);
    /**
     * Determines whether each node has the given className.
     * @method hasClass
     * @see Node.hasClass
     * @for NodeList
     * @param {String} className the class name to search for
     * @return {Array} An array of booleans for each node bound to the NodeList. 
     */

    /**
     * Adds a class name to each node.
     * @method addClass         
     * @see Node.addClass
     * @param {String} className the class name to add to the node's class attribute
     * @chainable
     */

    /**
     * Removes a class name from each node.
     * @method removeClass         
     * @see Node.removeClass
     * @param {String} className the class name to remove from the node's class attribute
     * @chainable
     */

    /**
     * Replace a class with another class for each node.
     * If no oldClassName is present, the newClassName is simply added.
     * @method replaceClass  
     * @see Node.replaceClass
     * @param {String} oldClassName the class name to be replaced
     * @param {String} newClassName the class name that will be replacing the old class name
     * @chainable
     */

    /**
     * If the className exists on the node it is removed, if it doesn't exist it is added.
     * @method toggleClass  
     * @see Node.toggleClass
     * @param {String} className the class name to be toggled
     * @chainable
     */
    Y.NodeList.importMethod(Y.Node.prototype, methods);
})(Y);

if (!Y.config.doc.documentElement.hasAttribute) { // IE < 8
    Y.Node.prototype.hasAttribute = function(attr) {
        if (attr === 'value') {
            if (this.get('value') !== "") { // IE < 8 fails to populate specified when set in HTML
                return true;
            }
        }
        return !!(this._node.attributes[attr] &&
                this._node.attributes[attr].specified);
    };
}

// IE throws an error when calling focus() on an element that's invisible, not
// displayed, or disabled.
Y.Node.prototype.focus = function () {
    try {
        this._node.focus();
    } catch (e) {
    }
};

// IE throws error when setting input.type = 'hidden',
// input.setAttribute('type', 'hidden') and input.attributes.type.value = 'hidden'
Y.Node.ATTRS.type = {
    setter: function(val) {
        if (val === 'hidden') {
            try {
                this._node.type = 'hidden';
            } catch(e) {
                this.setStyle('display', 'none');
                this._inputType = 'hidden';
            }
        } else {
            try { // IE errors when changing the type from "hidden'
                this._node.type = val;
            } catch (e) {
            }
        }
        return val;
    },

    getter: function() {
        return this._inputType || this._node.type;
    },

    _bypassProxy: true // don't update DOM when using with Attribute
};

if (Y.config.doc.createElement('form').elements.nodeType) {
    // IE: elements collection is also FORM node which trips up scrubVal.
    Y.Node.ATTRS.elements = {
            getter: function() {
                return this.all('input, textarea, button, select');
            }
    };
}

Y.mix(Y.Node.ATTRS, {
    offsetHeight: {
        setter: function(h) {
            Y.DOM.setHeight(this._node, h);
            return h;
        },

        getter: function() {
            return this._node.offsetHeight;
        }
    },

    offsetWidth: {
        setter: function(w) {
            Y.DOM.setWidth(this._node, w);
            return w;
        },

        getter: function() {
            return this._node.offsetWidth;
        }
    }
});

Y.mix(Y.Node.prototype, {
    sizeTo: function(w, h) {
        var node;
        if (arguments.length < 2) {
            node = Y.one(w);
            w = node.get('offsetWidth');
            h = node.get('offsetHeight');
        }

        this.setAttrs({
            offsetWidth: w,
            offsetHeight: h
        });
    }
});
var Y_NodeList = Y.NodeList,
    ArrayProto = Array.prototype,
    ArrayMethods = [
        /** Returns a new NodeList combining the given NodeList(s) 
          * @for NodeList
          * @method concat
          * @param {NodeList | Array} valueN Arrays/NodeLists and/or values to
          * concatenate to the resulting NodeList
          * @return {NodeList} A new NodeList comprised of this NodeList joined with the input.
          */
        'concat',
        /** Removes the first last from the NodeList and returns it.
          * @for NodeList
          * @method pop
          * @return {Node} The last item in the NodeList.
          */
        'pop',
        /** Adds the given Node(s) to the end of the NodeList. 
          * @for NodeList
          * @method push
          * @param {Node | DOMNode} nodeN One or more nodes to add to the end of the NodeList. 
          */
        'push',
        /** Removes the first item from the NodeList and returns it.
          * @for NodeList
          * @method shift
          * @return {Node} The first item in the NodeList.
          */
        'shift',
        /** Returns a new NodeList comprising the Nodes in the given range. 
          * @for NodeList
          * @method slice
          * @param {Number} begin Zero-based index at which to begin extraction.
          As a negative index, start indicates an offset from the end of the sequence. slice(-2) extracts the second-to-last element and the last element in the sequence.
          * @param {Number} end Zero-based index at which to end extraction. slice extracts up to but not including end.
          slice(1,4) extracts the second element through the fourth element (elements indexed 1, 2, and 3).
          As a negative index, end indicates an offset from the end of the sequence. slice(2,-1) extracts the third element through the second-to-last element in the sequence.
          If end is omitted, slice extracts to the end of the sequence.
          * @return {NodeList} A new NodeList comprised of this NodeList joined with the input.
          */
        'slice',
        /** Changes the content of the NodeList, adding new elements while removing old elements.
          * @for NodeList
          * @method splice
          * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end.
          * @param {Number} howMany An integer indicating the number of old array elements to remove. If howMany is 0, no elements are removed. In this case, you should specify at least one new element. If no howMany parameter is specified (second syntax above, which is a SpiderMonkey extension), all elements after index are removed.
          * {Node | DOMNode| element1, ..., elementN 
          The elements to add to the array. If you don't specify any elements, splice simply removes elements from the array.
          * @return {NodeList} The element(s) removed.
          */
        'splice',
        /** Adds the given Node(s) to the beginning of the NodeList. 
          * @for NodeList
          * @method push
          * @param {Node | DOMNode} nodeN One or more nodes to add to the NodeList. 
          */
        'unshift'
    ];


Y.Array.each(ArrayMethods, function(name) {
    Y_NodeList.prototype[name] = function() {
        var args = [],
            i = 0,
            arg;

        while ((arg = arguments[i++])) { // use DOM nodes/nodeLists 
            args.push(arg._node || arg._nodes || arg);
        }
        return Y.Node.scrubVal(ArrayProto[name].apply(this._nodes, args));
    };
});


}, '3.3.0' ,{requires:['dom-base', 'selector-css2', 'event-base']});
/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.3.0
build: 3167
*/
YUI.add('node-style', function(Y) {

(function(Y) {
/**
 * Extended Node interface for managing node styles.
 * @module node
 * @submodule node-style
 */

var methods = [
    /**
     * Returns the style's current value.
     * @method getStyle
     * @for Node
     * @param {String} attr The style attribute to retrieve. 
     * @return {String} The current value of the style property for the element.
     */
    'getStyle',

    /**
     * Returns the computed value for the given style property.
     * @method getComputedStyle
     * @param {String} attr The style attribute to retrieve. 
     * @return {String} The computed value of the style property for the element.
     */
    'getComputedStyle',

    /**
     * Sets a style property of the node.
     * @method setStyle
     * @param {String} attr The style attribute to set. 
     * @param {String|Number} val The value. 
     * @chainable
     */
    'setStyle',

    /**
     * Sets multiple style properties on the node.
     * @method setStyles
     * @param {Object} hash An object literal of property:value pairs. 
     * @chainable
     */
    'setStyles'
];
Y.Node.importMethod(Y.DOM, methods);
/**
 * Returns an array of values for each node.
 * @method getStyle
 * @for NodeList
 * @see Node.getStyle
 * @param {String} attr The style attribute to retrieve. 
 * @return {Array} The current values of the style property for the element.
 */

/**
 * Returns an array of the computed value for each node.
 * @method getComputedStyle
 * @see Node.getComputedStyle
 * @param {String} attr The style attribute to retrieve. 
 * @return {Array} The computed values for each node.
 */

/**
 * Sets a style property on each node.
 * @method setStyle
 * @see Node.setStyle
 * @param {String} attr The style attribute to set. 
 * @param {String|Number} val The value. 
 * @chainable
 */

/**
 * Sets multiple style properties on each node.
 * @method setStyles
 * @see Node.setStyles
 * @param {Object} hash An object literal of property:value pairs. 
 * @chainable
 */
Y.NodeList.importMethod(Y.Node.prototype, methods);
})(Y);


}, '3.3.0' ,{requires:['dom-style', 'node-base']});
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW:true*/
/*jslint white: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */

/**
 * @module YSLOW
 * @class YSLOW
 * @static
 */
if (typeof YSLOW === 'undefined') {
    YSLOW = {};
}

/**
 * Enable/disable debbuging messages
 */
YSLOW.DEBUG = true;

/**
 *
 * Adds a new rule to the pool of rules.
 *
 * Rule objects must implement the rule interface or an error will be thrown. The interface
 * of a rule object is as follows:
 * <ul>
 *   <li><code>id</code>, e.g. "numreq"</li>
 *   <li><code>name</code>, e.g. "Minimize HTTP requests"</li>
 *   <li><code>url</code>, more info about the rule</li>
 *   <li><code>config</code>, configuration object with defaults</li>
 *   <li><code>lint()</code> a method that accepts a document, array of components and a config object and returns a reuslt object</li>
 * </ul>
 *
 * @param {YSLOW.Rule} rule A new rule object to add
 */
YSLOW.registerRule = function (rule) {
    YSLOW.controller.addRule(rule);
};

/**
 *
 * Adds a new ruleset (new grading algorithm).
 *
 * Ruleset objects must implement the ruleset interface or an error will be thrown. The interface
 * of a ruleset object is as follows:
 * <ul>
 *   <li><code>id</code>, e.g. "ydefault"</li>
 *   <li><code>name</code>, e.g. "Yahoo! Default"</li>
 *   <li><code>rules</code> a hash of ruleID => ruleconfig </li>
 *   <li><code>weights</code> a hash of ruleID => ruleweight </li>
 * </ul>
 *
 * @param {YSLOW.Ruleset} ruleset The new ruleset object to be registered
 */
YSLOW.registerRuleset = function (ruleset) {
    YSLOW.controller.addRuleset(ruleset);
};

/**
 * Register a renderer.
 *
 * Renderer objects must implement the renderer interface.
 * The interface is as follows:
 * <ul>
 * <li><code>id</code></li>
 * <li><code>supports</code> a hash of view_name => 1 or 0 to indicate what views are supported</li>
 * <li>and the methods</li>
 * </ul>
 *
 * For instance if you define a JSON renderer that only render grade. Your renderer object will look like this:
 * { id: 'json',
 *    supports: { reportcard: 1, components: 0, stats: 0, cookies: 0},
 *    reportcardView: function(resultset) { ... }
 * }
 *
 * Refer to YSLOW.HTMLRenderer for the function prototype.
 *
 *
 * @param {YSLOW.renderer} renderer The new renderer object to be registered.
 */
YSLOW.registerRenderer = function (renderer) {
    YSLOW.controller.addRenderer(renderer);
};

/**
 * Adds a new tool.
 *
 * Tool objects must implement the tool interface or an error will be thrown.
 * The interface of a tool object is as follows:
 * <ul>
 *   <li><code>id</code>, e.g. 'mytool'</li>
 *   <li><code>name</code>, eg. 'Custom tool #3'</li>
 *   <li><code>print_output</code>, whether this tool will produce output.</li>
 *   <li><code>run</code>, function that takes doc and componentset object, return content to be output</li>
 * </ul>
 *
 * @param {YSLOW.Tool} tool The new tool object to be registered
 */
YSLOW.registerTool = function (tool) {
    YSLOW.Tools.addCustomTool(tool);
};


/**
 * Register an event listener
 *
 * @param {String} event_name Name of the event
 * @param {Function} callback A function to be called when the event fires
 * @param {Object} that Object to be assigned to the "this" value of the callback function
 */
YSLOW.addEventListener = function (event_name, callback, that) {
    YSLOW.util.event.addListener(event_name, callback, that);
};

/**
 * Unregister an event listener.
 *
 * @param {String} event_name Name of the event
 * @param {Function} callback The callback function that was added as a listener
 * @return {Boolean} TRUE is the listener was removed successfully, FALSE otherwise (for example in cases when the listener doesn't exist)
 */
YSLOW.removeEventListener = function (event_name, callback) {
    return YSLOW.util.event.removeListener(event_name, callback);
};

/**
 * @namespace YSLOW
 * @constructor
 * @param {String} name Error type
 * @param {String} message Error description
 */
YSLOW.Error = function (name, message) {
    /**
     * Type of error, e.g. "Interface error"
     * @type String
     */
    this.name = name;
    /**
     * Error description
     * @type String
     */
    this.message = message;
};

YSLOW.Error.prototype = {
    toString: function () {
        return this.name + "\n" + this.message;
    }
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

YSLOW.version = '3.1.8';
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW,MutationEvent*/
/*jslint browser: true, continue: true, sloppy: true, maxerr: 50, indent: 4 */

/**
 * ComponentSet holds an array of all the components and get the response info from net module for each component.
 *
 * @constructor
 * @param {DOMElement} node DOM Element
 * @param {Number} onloadTimestamp onload timestamp
 */
YSLOW.ComponentSet = function (node, onloadTimestamp) {

    //
    // properties
    //
    this.root_node = node;
    this.components = [];
    this.outstanding_net_request = 0;
    this.component_info = [];
    this.onloadTimestamp = onloadTimestamp;
    this.nextID = 1;
    this.notified_fetch_done = false;

};

YSLOW.ComponentSet.prototype = {

    /**
     * Call this function when you don't use the component set any more.
     * A chance to do proper clean up, e.g. remove event listener.
     */
    clear: function () {
        this.components = [];
        this.component_info = [];
        this.cleared = true;
        if (this.outstanding_net_request > 0) {
            YSLOW.util.dump("YSLOW.ComponentSet.Clearing component set before all net requests finish.");
        }
    },

    /**
     * Add a new component to the set.
     * @param {String} url URL of component
     * @param {String} type type of component
     * @param {String} base_href base href of document that the component belongs.
     * @param {Object} obj DOMElement (for image type only)
     * @return Component object that was added to ComponentSet
     * @type ComponentObject
     */
    addComponent: function (url, type, base_href, o) {
        var comp, found, isDoc;

        if (!url) {
            if (!this.empty_url) {
                this.empty_url = [];
            }
            this.empty_url[type] = (this.empty_url[type] || 0) + 1;
        }
        if (url && type) {
            // check if url is valid.
            if (!YSLOW.ComponentSet.isValidProtocol(url) ||
                    !YSLOW.ComponentSet.isValidURL(url)) {
                return comp;
            }

            // Make sure url is absolute url.
            url = YSLOW.util.makeAbsoluteUrl(url, base_href);
            // For security purpose
            url = YSLOW.util.escapeHtml(url);

            found = typeof this.component_info[url] !== 'undefined';
            isDoc = type === 'doc';

            // make sure this component is not already in this component set,
            // but also check if a doc is coming after a redirect using same url
            if (!found || isDoc) {
                this.component_info[url] = {
                    'state': 'NONE',
                    'count': found ? this.component_info[url].count : 0
                };

                comp = new YSLOW.Component(url, type, this, o);
                if (comp) {
                    comp.id = this.nextID += 1;
                    this.components[this.components.length] = comp;

                    // shortcup for document component
                    if (!this.doc_comp && isDoc) {
                        this.doc_comp = comp;
                    }

                    if (this.component_info[url].state === 'NONE') {
                        // net.js has probably made an async request.
                        this.component_info[url].state = 'REQUESTED';
                        this.outstanding_net_request += 1;
                    }
                } else {
                    this.component_info[url].state = 'ERROR';
                    YSLOW.util.event.fire("componentFetchError");
                }
            }
            this.component_info[url].count += 1;
        }

        return comp;
    },

    /**
     * Add a new component to the set, ignore duplicate.
     * @param {String} url url of component
     * @param {String} type type of component
     * @param {String} base_href base href of document that the component belongs.
     */
    addComponentNoDuplicate: function (url, type, base_href) {

        if (url && type) {
            // For security purpose
            url = YSLOW.util.escapeHtml(url);
            url = YSLOW.util.makeAbsoluteUrl(url, base_href);
            if (this.component_info[url] === undefined) {
                return this.addComponent(url, type, base_href);
            }
        }

    },

    /**
     * Get components by type.
     *
     * @param {String|Array} type The type of component to get, e.g. "js" or
     *        ['js', 'css']
     * @param {Boolean} include_after_onload If component loaded after onload
     *        should be included in the returned results, default is FALSE,
     *        don't include
     * @param {Boolean} include_beacons If image beacons (1x1 images) should
     *        be included in the returned results, default is FALSE, don't
     *        include
     * @return An array of matching components
     * @type Array
     */
    getComponentsByType: function (type, includeAfterOnload, includeBeacons) {
        var i, j, len, lenJ, t, comp, info,
            components = this.components,
            compInfo = this.component_info,
            comps = [],
            types = {};

        if (typeof includeAfterOnload === 'undefined') {
            includeAfterOnload = !(YSLOW.util.Preference.getPref(
                'excludeAfterOnload',
                true
            ));
        }
        if (typeof includeBeacons === 'undefined') {
            includeBeacons = !(YSLOW.util.Preference.getPref(
                'excludeBeaconsFromLint',
                true
            ));
        }

        if (typeof type === 'string') {
            types[type] = 1;
        } else {
            for (i = 0, len = type.length; i < len; i += 1) {
                t = type[i];
                if (t) {
                    types[t] = 1;
                }
            }
        }

        for (i = 0, len = components.length; i < len; i += 1) {
            comp = components[i];
            if (!comp || (comp && !types[comp.type]) ||
                    (comp.is_beacon && !includeBeacons) ||
                    (comp.after_onload && !includeAfterOnload)) {
                continue;
            }
            comps[comps.length] = comp;
            info = compInfo[i];
            if (!info || (info && info.count <= 1)) {
                continue;
            }
            for (j = 1, lenJ = info.count; j < lenJ; j += 1) {
                comps[comps.length] = comp;
            }
        }

        return comps;
    },

    /**
     * @private
     * Get fetching progress.
     * @return { 'total' => total number of component, 'received' => number of components fetched  }
     */
    getProgress: function () {
        var i,
            total = 0,
            received = 0;

        for (i in this.component_info) {
            if (this.component_info.hasOwnProperty(i) &&
                    this.component_info[i]) {
                if (this.component_info[i].state === 'RECEIVED') {
                    received += 1;
                }
                total += 1;
            }
        }

        return {
            'total': total,
            'received': received
        };
    },

    /**
     * Event callback when component's GetInfoState changes.
     * @param {Object} event object
     */
    onComponentGetInfoStateChange: function (event_object) {
        var comp, state, progress;

        if (event_object) {
            if (typeof event_object.comp !== 'undefined') {
                comp = event_object.comp;
            }
            if (typeof event_object.state !== 'undefined') {
                state = event_object.state;
            }
        }
        if (typeof this.component_info[comp.url] === 'undefined') {
            // this should not happen.
            YSLOW.util.dump("YSLOW.ComponentSet.onComponentGetInfoStateChange(): Unexpected component: " + comp.url);
            return;
        }

        if (this.component_info[comp.url].state === "NONE" && state === 'DONE') {
            this.component_info[comp.url].state = "RECEIVED";
        } else if (this.component_info[comp.url].state === "REQUESTED" && state === 'DONE') {
            this.component_info[comp.url].state = "RECEIVED";
            this.outstanding_net_request -= 1;
            // Got all component detail info.
            if (this.outstanding_net_request === 0) {
                this.notified_fetch_done = true;
                YSLOW.util.event.fire("componentFetchDone", {
                    'component_set': this
                });
            }
        } else {
            // how does this happen?
            YSLOW.util.dump("Unexpected component info state: [" + comp.type + "]" + comp.url + "state: " + state + " comp_info_state: " + this.component_info[comp.url].state);
        }

        // fire event.
        progress = this.getProgress();
        YSLOW.util.event.fire("componentFetchProgress", {
            'total': progress.total,
            'current': progress.received,
            'last_component_url': comp.url
        });
    },

    /**
     * This is called when peeler is done.
     * If ComponentSet has all the component info, fire componentFetchDone event.
     */
    notifyPeelDone: function () {
        if (this.outstanding_net_request === 0 && !this.notified_fetch_done) {
            this.notified_fetch_done = true;
            YSLOW.util.event.fire("componentFetchDone", {
                'component_set': this
            });
        }
    },

    /**
     * After onload guess (simple version)
     * Checkes for elements with src or href attributes within
     * the original document html source
     */
    setSimpleAfterOnload: function (callback, obj) {
        var i, j, comp, doc_el, doc_comps, src,
            indoc, url, el, type, len, lenJ,
            docBody, doc, components, that;

        if (obj) {
            docBody = obj.docBody;
            doc = obj.doc;
            components = obj.components;
            that = obj.components;
        } else {
            docBody = this.doc_comp && this.doc_comp.body;
            doc = this.root_node;
            components = this.components;
            that = this;
        }

        // skip testing when doc not found
        if (!docBody) {
            YSLOW.util.dump('doc body is empty');
            return callback(that);
        }

        doc_el = doc.createElement('div');
        doc_el.innerHTML = docBody;
        doc_comps = doc_el.getElementsByTagName('*');

        for (i = 0, len = components.length; i < len; i += 1) {
            comp = components[i];
            type = comp.type;
            if (type === 'cssimage' || type === 'doc') {
                // docs are ignored
                // css images are likely to be loaded before onload
                continue;
            }
            indoc = false;
            url = comp.url;
            for (j = 0, lenJ = doc_comps.length; !indoc && j < lenJ; j += 1) {
                el = doc_comps[j];
                src = el.src || el.href || el.getAttribute('src') ||
                    el.getAttribute('href') ||
                    (el.nodeName === 'PARAM' && el.value);
                indoc = (src === url);
            }
            // if component wasn't found on original html doc
            // assume it was loaded after onload
            comp.after_onload = !indoc;
        }

        callback(that);
    },

    /**
     * After onload guess
     * Checkes for inserted elements with src or href attributes after the
     * page onload event triggers using an iframe with original doc html
     */
    setAfterOnload: function (callback, obj) {
        var ifrm, idoc, iwin, timer, done, noOnloadTimer,
            that, docBody, doc, components, ret, enough, triggered,
            util = YSLOW.util,
            addEventListener = util.addEventListener,
            removeEventListener = util.removeEventListener,
            setTimer = setTimeout,
            clearTimer = clearTimeout,
            comps = [],
            compsHT = {},

            // get changed component and push to comps array
            // reset timer for 1s after the last dom change
            getTarget = function (e) {
                var type, attr, target, src, oldSrc;

                clearTimer(timer);

                type = e.type;
                attr = e.attrName;
                target = e.target;
                src = target.src || target.href || (target.getAttribute && (
                    target.getAttribute('src') || target.getAttribute('href')
                ));
                oldSrc = target.dataOldSrc;

                if (src &&
                        (type === 'DOMNodeInserted' ||
                        (type === 'DOMSubtreeModified' && src !== oldSrc) ||
                        (type === 'DOMAttrModified' &&
                            (attr === 'src' || attr === 'href'))) &&
                        !compsHT[src]) {
                    compsHT[src] = 1;
                    comps.push(target);
                }

                timer = setTimer(done, 1000);
            },

            // temp iframe onload listener
            // - cancel noOnload timer since onload was fired
            // - wait 3s before calling done if no dom mutation happens
            // - set enough timer, limit is 10 seconds for mutations, this is
            //   for edge cases when page inserts/removes nodes within a loop
            iframeOnload =  function () {
                var i, len, all, el, src;

                clearTimer(noOnloadTimer);
                all = idoc.getElementsByTagName('*');
                for (i = 0, len = all.length; i < len; i += 1) {
                    el = all[i];
                    src = el.src || el.href;
                    if (src) {
                        el.dataOldSrc = src;
                    }
                }
                addEventListener(iwin, 'DOMSubtreeModified', getTarget);
                addEventListener(iwin, 'DOMNodeInserted', getTarget);
                addEventListener(iwin, 'DOMAttrModified', getTarget);
                timer = setTimer(done, 3000);
                enough = setTimer(done, 10000);
            };

        if (obj) {
            that = YSLOW.ComponentSet.prototype;
            docBody = obj.docBody;
            doc = obj.doc;
            components = obj.components;
            ret = components;
        } else {
            that = this;
            docBody = that.doc_comp && that.doc_comp.body;
            doc = that.root_node;
            components = that.components;
            ret = that;
        }

        // check for mutation event support or anti-iframe option
        if (typeof MutationEvent === 'undefined' || YSLOW.antiIframe) {
            return that.setSimpleAfterOnload(callback, obj);
        }

        // skip testing when doc not found
        if (!docBody) {
            util.dump('doc body is empty');

            return callback(ret);
        }

        // set afteronload properties for all components loaded after window onlod
        done = function () {
            var i, j, len, lenJ, comp, src, cmp;

            // to avoid executing this function twice
            // due to ifrm iwin double listeners
            if (triggered) {
                return;
            }

            // cancel timers
            clearTimer(enough);
            clearTimer(timer);

            // remove listeners
            removeEventListener(iwin, 'DOMSubtreeModified', getTarget);
            removeEventListener(iwin, 'DOMNodeInserted', getTarget);
            removeEventListener(iwin, 'DOMAttrModified', getTarget);
            removeEventListener(ifrm, 'load', iframeOnload);
            removeEventListener(iwin, 'load', iframeOnload);

            // changed components loop
            for (i = 0, len =  comps.length; i < len; i += 1) {
                comp = comps[i];
                src = comp.src || comp.href || (comp.getAttribute &&
                    (comp.getAttribute('src') || comp.getAttribute('href')));
                if (!src) {
                    continue;
                }
                for (j = 0, lenJ = components.length; j < lenJ; j += 1) {
                    cmp = components[j];
                    if (cmp.url === src) {
                        cmp.after_onload = true;
                    }
                }
            }

            // remove temp iframe and invoke callback passing cset
            ifrm.parentNode.removeChild(ifrm);
            triggered = 1;
            callback(ret);
        };

        // create temp iframe with doc html
        ifrm = doc.createElement('iframe');
        ifrm.style.cssText = 'position:absolute;top:-999em;';
        doc.body.appendChild(ifrm);
        iwin = ifrm.contentWindow;

        // set a fallback when onload is not triggered
        noOnloadTimer = setTimer(done, 3000);

        // set onload and ifram content
        if (iwin) {
            idoc = iwin.document;
        } else {
            iwin = idoc = ifrm.contentDocument;
        }
        addEventListener(iwin, 'load', iframeOnload);
        addEventListener(ifrm, 'load', iframeOnload);
        idoc.open().write(docBody);
        idoc.close();
        addEventListener(iwin, 'load', iframeOnload);
    }
};

/*
 * List of valid protocols in component sets.
 */
YSLOW.ComponentSet.validProtocols = ['http', 'https', 'ftp'];

/**
 * @private
 * Check if url has an allowed protocol (no chrome://, about:)
 * @param url
 * @return false if url does not contain hostname.
 */
YSLOW.ComponentSet.isValidProtocol = function (s) {
    var i, index, protocol,
        validProtocols = this.validProtocols,
        len = validProtocols.length;

    s = s.toLowerCase();
    index = s.indexOf(':');
    if (index > 0) {
        protocol = s.substr(0, index);
        for (i = 0; i < len; i += 1) {
            if (protocol === validProtocols[i]) {
                return true;
            }
        }
    }

    return false;
};


/**
 * @private
 * Check if passed url has hostname specified.
 * @param url
 * @return false if url does not contain hostname.
 */
YSLOW.ComponentSet.isValidURL = function (url) {
    var arr, host;

    url = url.toLowerCase();

    // all url is in the format of <protocol>:<the rest of the url>
    arr = url.split(":");

    // for http protocol, we want to make sure there is a host in the url.
    if (arr[0] === "http" || arr[0] === "https") {
        if (arr[1].substr(0, 2) !== "//") {
            return false;
        }
        host = arr[1].substr(2);
        if (host.length === 0 || host.indexOf("/") === 0) {
            // no host specified.
            return false;
        }
    }

    return true;
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, onevar: true, undef: true, newcap: true, nomen: true, plusplus: true, bitwise: true, browser: true, maxerr: 50, indent: 4 */

/**
 * @namespace YSLOW
 * @class Component
 * @constructor
 */
YSLOW.Component = function (url, type, parent_set, o) {
    var obj = o && o.obj,
        comp = (o && o.comp) || {};

    /**
     * URL of the component
     * @type String
     */
    this.url = url;

    /**
     * Component type, one of the following:
     * <ul>
     *  <li>doc</li>
     *  <li>js</li>
     *  <li>css</li>
     *  <li>...</li>
     * </ul>
     * @type String
     */
    this.type = type;

    /**
     * Parent component set.
     */
    this.parent = parent_set;

    this.headers = {};
    this.raw_headers = '';
    this.req_headers = null;
    this.body = '';
    this.compressed = false;
    this.expires = undefined; // to be replaced by a Date object
    this.size = 0;
    this.status = 0;
    this.is_beacon = false;
    this.method = 'unknown';
    this.cookie = '';
    this.respTime = null;
    this.after_onload = false;

    // component object properties
    // e.g. for image, image element width, image element height, actual width, actual height
    this.object_prop = undefined;

    // construction part
    if (type === undefined) {
        this.type = 'unknown';
    }

    this.get_info_state = 'NONE';

    if (obj && type === 'image' && obj.width && obj.height) {
        this.object_prop = {
            'width': obj.width,
            'height': obj.height
        };
    }

    if (comp.containerNode) {
        this.containerNode = comp.containerNode;
    }

    this.setComponentDetails(o);
};

/**
 * Return the state of getting detail info from the net.
 */
YSLOW.Component.prototype.getInfoState = function () {
    return this.get_info_state;
};

YSLOW.Component.prototype.populateProperties = function (resolveRedirect, ignoreImgReq) {
    var comp, encoding, expires, content_length, img_src, obj, dataUri,
        that = this,
        NULL = null,
        UNDEF = 'undefined';

    // check location
    // bookmarklet and har already handle redirects
    if (that.headers.location && resolveRedirect && that.headers.location !== that.url) {
        // Add a new component.
        comp = that.parent.addComponentNoDuplicate(that.headers.location,
            (that.type !== 'redirect' ? that.type : 'unknown'), that.url);
        if (comp && that.after_onload) {
            comp.after_onload = true;
        }
        that.type = 'redirect';
    }

    content_length = that.headers['content-length'];

    // gzip, deflate
    encoding = YSLOW.util.trim(that.headers['content-encoding']);
    if (encoding === 'gzip' || encoding === 'deflate') {
        that.compressed = encoding;
        that.size = (that.body.length) ? that.body.length : NULL;
        if (content_length) {
            that.size_compressed = parseInt(content_length, 10) ||
                content_length;
        } else if (typeof that.nsize !== UNDEF) {
            that.size_compressed = that.nsize;
        } else {
            // a hack
            that.size_compressed = Math.round(that.size / 3);
        }
    } else {
        that.compressed = false;
        that.size_compressed = NULL;
        if (content_length) {
            that.size = parseInt(content_length, 10);
        } else if (typeof that.nsize !== UNDEF) {
            that.size = parseInt(that.nsize, 10);
        } else {
            that.size = that.body.length;
        }
    }

    // size check/correction, @todo be more precise here
    if (!that.size) {
        if (typeof that.nsize !== UNDEF) {
            that.size = that.nsize;
        } else {
            that.size = that.body.length;
        }
    }
    that.uncompressed_size = that.body.length;

    // expiration based on either Expires or Cache-Control headers
    // always use max-age if exists following 1.1 spec
    // http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.3                                                                                      
    if (that.getMaxAge() !== undefined) {
        that.expires = that.getMaxAge();
    }
    else if (that.headers.expires && that.headers.expires.length > 0) {
        that.expires = new Date(that.headers.expires);
    }

    // compare image original dimensions with actual dimensions, data uri is
    // first attempted to get the orginal dimension, if it fails (btoa) then
    // another request to the orginal image is made
    if (that.type === 'image' && !ignoreImgReq) {
        if (typeof Image !== UNDEF) {
            obj = new Image();
        } else {
            obj = document.createElement('img');
        }
        if (that.body.length) {
            img_src = 'data:' + that.headers['content-type'] + ';base64,' +
                YSLOW.util.base64Encode(that.body);
            dataUri = 1;
        } else {
            img_src = that.url;
        }
        obj.onerror = function () {
            obj.onerror = NULL;
            if (dataUri) {
                obj.src = that.url;
            }
        };
        obj.onload = function () {
            obj.onload = NULL;
            if (obj && obj.width && obj.height) {
                if (that.object_prop) {
                    that.object_prop.actual_width = obj.width;
                    that.object_prop.actual_height = obj.height;
                } else {
                    that.object_prop = {
                        'width': obj.width,
                        'height': obj.height,
                        'actual_width': obj.width,
                        'actual_height': obj.height
                    };
                }
                if (obj.width < 2 && obj.height < 2) {
                    that.is_beacon = true;
                }
            }
        };
        obj.src = img_src;
    }
};

/**
 *  Return true if this object has a last-modified date significantly in the past.
 */
YSLOW.Component.prototype.hasOldModifiedDate = function () {
    var now = Number(new Date()),
        modified_date = this.headers['last-modified'];

    if (typeof modified_date !== 'undefined') {
        // at least 1 day in the past
        return ((now - Number(new Date(modified_date))) > (24 * 60 * 60 * 1000));
    }

    return false;
};

/**
 * Return true if this object has a far future Expires.
 * @todo: make the "far" interval configurable
 * @param expires Date object
 * @return true if this object has a far future Expires.
 */
YSLOW.Component.prototype.hasFarFutureExpiresOrMaxAge = function () {
    var expires_in_seconds,
        now = Number(new Date()),
        minSeconds = YSLOW.util.Preference.getPref('minFutureExpiresSeconds', 2 * 24 * 60 * 60),
        minMilliSeconds = minSeconds * 1000;

    if (typeof this.expires === 'object') {
        expires_in_seconds = Number(this.expires);
        if ((expires_in_seconds - now) > minMilliSeconds) {
            return true;
        }
    }

    return false;
};

YSLOW.Component.prototype.getEtag = function () {
    return this.headers.etag || '';
};

YSLOW.Component.prototype.getMaxAge = function () {
    var index, maxage, expires,
        cache_control = this.headers['cache-control'];

    if (cache_control) {
        index = cache_control.indexOf('max-age');
        if (index > -1) {
            maxage = parseInt(cache_control.substring(index + 8), 10);
            if (maxage > 0) {
                expires = YSLOW.util.maxAgeToDate(maxage);
            }
        }
    }

    return expires;
};

/**
 * Return total size of Set-Cookie headers of this component.
 * @return total size of Set-Cookie headers of this component.
 * @type Number
 */
YSLOW.Component.prototype.getSetCookieSize = function () {
    // only return total size of cookie received.
    var aCookies, k,
        size = 0;

    if (this.headers && this.headers['set-cookie']) {
        aCookies = this.headers['set-cookie'].split('\n');
        if (aCookies.length > 0) {
            for (k = 0; k < aCookies.length; k += 1) {
                size += aCookies[k].length;
            }
        }
    }

    return size;
};

/**
 * Return total size of Cookie HTTP Request headers of this component.
 * @return total size of Cookie headers Request of this component.
 * @type Number
 */
YSLOW.Component.prototype.getReceivedCookieSize = function () {
    // only return total size of cookie sent.
    var aCookies, k,
        size = 0;

    if (this.cookie && this.cookie.length > 0) {
        aCookies = this.cookie.split('\n');
        if (aCookies.length > 0) {
            for (k = 0; k < aCookies.length; k += 1) {
                size += aCookies[k].length;
            }
        }
    }

    return size;
};

/**
 * Platform implementation of
 * YSLOW.Component.prototype.setComponentDetails = function (o) {}
 * goes here
/*
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * Parse details (HTTP headers, content, etc) from a
 * given source and set component properties.
 * @param o The object containing component details.
 */
YSLOW.Component.prototype.setComponentDetails = function (o) {
    var comp = this,
        
        parseComponent = function (component) {
            var headerName, h, i, len, m,
                reHeader = /^([^:]+):\s*([\s\S]+)$/,
                headers = component.rawHeaders;

            // copy from the response object
            comp.status = component.status;
            comp.raw_headers = headers;
            if (component.headers) {
                for (headerName in component.headers) {
                    if (component.headers.hasOwnProperty(headerName)) {
                        comp.headers[headerName.toLowerCase()] = component.headers[headerName];
                    }
                }
            } else if (typeof headers === 'string') {
                h = headers.split('\n');
                for (i = 0, len = h.length; i < len; i += 1) {
                    m = reHeader.exec(h[i]);
                    if (m) {
                        comp.headers[m[1].toLowerCase()] = m[2];
                    }
                }
            }
            comp.req_headers = {};
            comp.method = 'GET';
            comp.body = component.content || component.body || '';
            comp.type = component.type;
            // for security checking
            comp.response_type = comp.type;
            comp.cookie = comp.headers['set-cookie'] || '';
            comp.nsize = parseInt(comp.headers['content-length'], 10) ||
                comp.body.length;
            comp.respTime = 0;
            if (component.after_onload) {
                comp.after_onload = component.after_onload;
            }
            if (typeof component.injected !== 'undefined') {
                comp.injected = component.injected;
            }
            if (typeof component.defer !== 'undefined') {
                comp.defer = component.defer;
            }
            if (typeof component.async !== 'undefined') {
                comp.async = component.async;
            }

            comp.populateProperties();

            comp.get_info_state = 'DONE';

            // notify parent ComponentSet that this
            // component has gotten net response.
            comp.parent.onComponentGetInfoStateChange({
                'comp': comp,
                'state': 'DONE'
            });
        };

    parseComponent(o.component);
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, browser: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */

/**
 * @namespace YSLOW
 * @class controller
 * @static
 */

YSLOW.controller = {

    rules: {},

    rulesets: {},

    onloadTimestamp: null,

    renderers: {},

    default_ruleset_id: 'ydefault',

    run_pending: 0,

    /**
     * Init code.  Add event listeners.
     */
    init: function () {
        var arr_rulesets, i, obj, value;

        // listen to onload event.
        YSLOW.util.event.addListener("onload", function (e) {
            this.onloadTimestamp = e.time;
            YSLOW.util.setTimer(function () {
                YSLOW.controller.run_pending_event();
            });
        }, this);

        // listen to onunload event.
        YSLOW.util.event.addListener("onUnload", function (e) {
            this.run_pending = 0;
            this.onloadTimestamp = null;
        }, this);

        // load custom ruleset
        arr_rulesets = YSLOW.util.Preference.getPrefList("customRuleset.", undefined);
        if (arr_rulesets && arr_rulesets.length > 0) {
            for (i = 0; i < arr_rulesets.length; i += 1) {
                value = arr_rulesets[i].value;
                if (typeof value === "string" && value.length > 0) {
                    obj = JSON.parse(value, null);
                    obj.custom = true;
                    this.addRuleset(obj);
                }
            }
        }

        this.default_ruleset_id = YSLOW.util.Preference.getPref("defaultRuleset", 'ydefault');

        // load rule config preference
        this.loadRulePreference();
    },

    /**
     * Run controller to start peeler. Don't start if the page is not done loading.
     * Delay the running until onload event.
     *
     * @param {Window} win window object
     * @param {YSLOW.context} yscontext YSlow context to use.
     * @param {Boolean} autorun value to indicate if triggered by autorun
     */
    run: function (win, yscontext, autorun) {
        var cset, line,
            doc = win.document;

        if (!doc || !doc.location || doc.location.href.indexOf("about:") === 0 || "undefined" === typeof doc.location.hostname) {
            if (!autorun) {
                line = 'Please enter a valid website address before running YSlow.';
                YSLOW.ysview.openDialog(YSLOW.ysview.panel_doc, 389, 150, line, '', 'Ok');
            }
            return;
        }

        // Since firebug 1.4, onload event is not passed to YSlow if firebug
        // panel is not opened. Recommendation from firebug dev team is to
        // refresh the page before running yslow, which is unnecessary from
        // yslow point of view.  For now, just don't enforce running YSlow
        // on a page has finished loading.
        if (!yscontext.PAGE.loaded) {
            this.run_pending = {
                'win': win,
                'yscontext': yscontext
            };
            // @todo: put up spining logo to indicate waiting for page finish loading.
            return;
        }

        YSLOW.util.event.fire("peelStart", undefined);
        cset = YSLOW.peeler.peel(doc, this.onloadTimestamp);
        // need to set yscontext_component_set before firing peelComplete,
        // otherwise, may run into infinite loop.
        yscontext.component_set = cset;
        YSLOW.util.event.fire("peelComplete", {
            'component_set': cset
        });

        // notify ComponentSet peeling is done.
        cset.notifyPeelDone();
    },

    /**
     * Start pending run function.
     */
    run_pending_event: function () {
        if (this.run_pending) {
            this.run(this.run_pending.win, this.run_pending.yscontext, false);
            this.run_pending = 0;
        }
    },

    /**
     * Run lint function of the ruleset matches the passed rulset_id.
     * If ruleset_id is undefined, use Controller's default ruleset.
     * @param {Document} doc Document object of the page to run lint.
     * @param {YSLOW.context} yscontext YSlow context to use.
     * @param {String} ruleset_id ID of the ruleset to run.
     * @return Lint result
     * @type YSLOW.ResultSet
     */
    lint: function (doc, yscontext, ruleset_id) {
        var rule, rules, i, conf, result, weight, score,
            ruleset = [],
            results = [],
            total_score = 0,
            total_weight = 0,
            that = this,
            rs = that.rulesets,
            defaultRuleSetId = that.default_ruleset_id;

        if (ruleset_id) {
            ruleset = rs[ruleset_id];
        } else if (defaultRuleSetId && rs[defaultRuleSetId]) {
            ruleset = rs[defaultRuleSetId];
        } else {
            // if no ruleset, take the first one available
            for (i in rs) {
                if (rs.hasOwnProperty(i) && rs[i]) {
                    ruleset = rs[i];
                    break;
                }
            }
        }

        rules = ruleset.rules;
        for (i in rules) {
            if (rules.hasOwnProperty(i) && rules[i] &&
                    this.rules.hasOwnProperty(i)) {
                try {
                    rule = this.rules[i];
                    conf = YSLOW.util.merge(rule.config, rules[i]);

                    result = rule.lint(doc, yscontext.component_set, conf);

                    // apply rule weight to result.
                    weight = (ruleset.weights ? ruleset.weights[i] : undefined);
                    if (weight !== undefined) {
                        weight = parseInt(weight, 10);
                    }
                    if (weight === undefined || weight < 0 || weight > 100) {
                        if (rs.ydefault.weights[i]) {
                            weight = rs.ydefault.weights[i];
                        } else {
                            weight = 5;
                        }
                    }
                    result.weight = weight;

                    if (result.score !== undefined) {
                        if (typeof result.score !== "number") {
                            score = parseInt(result.score, 10);
                            if (!isNaN(score)) {
                                result.score = score;
                            }
                        }

                        if (typeof result.score === 'number') {
                            total_weight += result.weight;

                            if (!YSLOW.util.Preference.getPref('allowNegativeScore', false)) {
                                if (result.score < 0) {
                                    result.score = 0;
                                }
                                if (typeof result.score !== 'number') {
                                    // for backward compatibilty of n/a
                                    result.score = -1;
                                }
                            }

                            if (result.score !== 0) {
                                total_score += result.score * (typeof result.weight !== 'undefined' ? result.weight : 1);
                            }
                        }
                    }

                    result.name = rule.name;
                    result.category = rule.category;
                    result.rule_id = i;

                    results[results.length] = result;
                } catch (err) {
                    YSLOW.util.dump("YSLOW.controller.lint: " + i, err);
                    YSLOW.util.event.fire("lintError", {
                        'rule': i,
                        'message': err
                    });
                }
            }
        }

        yscontext.PAGE.overallScore = total_score / (total_weight > 0 ? total_weight : 1);
        yscontext.result_set = new YSLOW.ResultSet(results, yscontext.PAGE.overallScore, ruleset);
        yscontext.result_set.url = yscontext.component_set.doc_comp.url;
        YSLOW.util.event.fire("lintResultReady", {
            'yslowContext': yscontext
        });

        return yscontext.result_set;
    },

    /**
     * Run tool that matches the passed tool_id
     * @param {String} tool_id ID of the tool to be run.
     * @param {YSLOW.context} yscontext YSlow context
     * @param {Object} param parameters to be passed to run method of tool.
     */
    runTool: function (tool_id, yscontext, param) {
        var result, html, doc, h, css, uri, req2, l, s, message, body,
            tool = YSLOW.Tools.getTool(tool_id);

        try {
            if (typeof tool === "object") {
                result = tool.run(yscontext.document, yscontext.component_set, param);
                if (tool.print_output) {
                    html = '';
                    if (typeof result === "object") {
                        html = result.html;
                    } else if (typeof result === "string") {
                        html = result;
                    }
                    doc = YSLOW.util.getNewDoc();
                    body = doc.body || doc.documentElement;
                    body.innerHTML = html;
                    h = doc.getElementsByTagName('head')[0];
                    if (typeof result.css === "undefined") {
                        // use default.
                        uri = 'chrome://yslow/content/yslow/tool.css';
                        req2 = new XMLHttpRequest();
                        req2.open('GET', uri, false);
                        req2.send(null);
                        css = req2.responseText;
                    } else {
                        css = result.css;
                    }
                    if (typeof css === "string") {
                        l = doc.createElement("style");
                        l.setAttribute("type", "text/css");
                        l.appendChild(doc.createTextNode(css));
                        h.appendChild(l);
                    }

                    if (typeof result.js !== "undefined") {
                        s = doc.createElement("script");
                        s.setAttribute("type", "text/javascript");
                        s.appendChild(doc.createTextNode(result.js));
                        h.appendChild(s);
                    }
                    if (typeof result.plot_component !== "undefined" && result.plot_component === true) {
                        // plot components
                        YSLOW.renderer.plotComponents(doc, yscontext);
                    }
                }
            } else {
                message = tool_id + " is not a tool.";
                YSLOW.util.dump(message);
                YSLOW.util.event.fire("toolError", {
                    'tool_id': tool_id,
                    'message': message
                });
            }
        } catch (err) {
            YSLOW.util.dump("YSLOW.controller.runTool: " + tool_id, err);
            YSLOW.util.event.fire("toolError", {
                'tool_id': tool_id,
                'message': err
            });
        }
    },

    /**
     * Find a registered renderer with the passed id to render the passed view.
     * @param {String} id ID of renderer to be used. eg. 'html'
     * @param {String} view id of view, e.g. 'reportcard', 'stats' and 'components'
     * @param {Object} params parameter object to pass to XXXview method of renderer.
     * @return content the renderer generated.
     */
    render: function (id, view, params) {
        var renderer = this.renderers[id],
            content = '';

        if (renderer.supports[view] !== undefined && renderer.supports[view] === 1) {
            switch (view) {
            case 'components':
                content = renderer.componentsView(params.comps, params.total_size);
                break;
            case 'reportcard':
                content = renderer.reportcardView(params.result_set);
                break;
            case 'stats':
                content = renderer.statsView(params.stats);
                break;
            case 'tools':
                content = renderer.toolsView(params.tools);
                break;
            case 'rulesetEdit':
                content = renderer.rulesetEditView(params.rulesets);
                break;
            }
        }
        return content;

    },

    /**
     * Get registered renderer with the passed id.
     * @param {String} id ID of the renderer
     */
    getRenderer: function (id) {
        return this.renderers[id];
    },

    /**
     * @see YSLOW.registerRule
     */
    addRule: function (rule) {
        var i, doc_obj,
            required = ['id', 'name', 'config', 'info', 'lint'];

        // check YSLOW.doc class for text
        if (YSLOW.doc.rules && YSLOW.doc.rules[rule.id]) {
            doc_obj = YSLOW.doc.rules[rule.id];
            if (doc_obj.name) {
                rule.name = doc_obj.name;
            }
            if (doc_obj.info) {
                rule.info = doc_obj.info;
            }
        }

        for (i = 0; i < required.length; i += 1) {
            if (typeof rule[required[i]] === 'undefined') {
                throw new YSLOW.Error('Interface error', 'Improperly implemented rule interface');
            }
        }
        if (this.rules[rule.id] !== undefined) {
            throw new YSLOW.Error('Rule register error', rule.id + " is already defined.");
        }
        this.rules[rule.id] = rule;
    },

    /**
     * @see YSLOW.registerRuleset
     */
    addRuleset: function (ruleset, update) {
        var i, required = ['id', 'name', 'rules'];

        for (i = 0; i < required.length; i += 1) {
            if (typeof ruleset[required[i]] === 'undefined') {
                throw new YSLOW.Error('Interface error', 'Improperly implemented ruleset interface');
            }
            if (this.checkRulesetName(ruleset.id) && update !== true) {
                throw new YSLOW.Error('Ruleset register error', ruleset.id + " is already defined.");
            }
        }
        this.rulesets[ruleset.id] = ruleset;
    },

    /**
     * Remove ruleset from controller.
     * @param {String} ruleset_id ID of the ruleset to be deleted.
     */
    removeRuleset: function (ruleset_id) {
        var ruleset = this.rulesets[ruleset_id];

        if (ruleset && ruleset.custom === true) {
            delete this.rulesets[ruleset_id];

            // if we are deleting the default ruleset, change default to 'ydefault'.
            if (this.default_ruleset_id === ruleset_id) {
                this.default_ruleset_id = 'ydefault';
                YSLOW.util.Preference.setPref("defaultRuleset", this.default_ruleset_id);
            }
            return ruleset;
        }

        return null;
    },

    /**
     * Save ruleset to preference.
     * @param {YSLOW.Ruleset} ruleset ruleset to be saved.
     */
    saveRulesetToPref: function (ruleset) {
        if (ruleset.custom === true) {
            YSLOW.util.Preference.setPref("customRuleset." + ruleset.id, JSON.stringify(ruleset, null, 2));
        }
    },

    /**
     * Remove ruleset from preference.
     * @param {YSLOW.Ruleset} ruleset ruleset to be deleted.
     */
    deleteRulesetFromPref: function (ruleset) {
        if (ruleset.custom === true) {
            YSLOW.util.Preference.deletePref("customRuleset." + ruleset.id);
        }
    },

    /**
     * Get ruleset with the passed id.
     * @param {String} ruleset_id ID of ruleset to be retrieved.
     */
    getRuleset: function (ruleset_id) {
        return this.rulesets[ruleset_id];
    },

    /**
     * @see YSLOW.registerRenderer
     */
    addRenderer: function (renderer) {
        this.renderers[renderer.id] = renderer;
    },

    /**
     * Return a hash of registered ruleset objects.
     * @return a hash of rulesets with ruleset_id => ruleset
     */
    getRegisteredRuleset: function () {
        return this.rulesets;
    },

    /**
     * Return a hash of registered rule objects.
     * @return all the registered rule objects in a hash. rule_id => rule object
     */
    getRegisteredRules: function () {
        return this.rules;
    },

    /**
     * Return the rule object identified by rule_id
     * @param {String} rule_id ID of rule object to be retrieved.
     * @return rule object.
     */
    getRule: function (rule_id) {
        return this.rules[rule_id];
    },

    /**
     * Check if name parameter is conflict with any existing ruleset name.
     * @param {String} name Name to check.
     * @return true if name conflicts, false otherwise.
     * @type Boolean
     */
    checkRulesetName: function (name) {
        var id, ruleset,
            rulesets = this.rulesets;

        name = name.toLowerCase();
        for (id in rulesets) {
            if (rulesets.hasOwnProperty(id)) {
                ruleset = rulesets[id];
                if (ruleset.id.toLowerCase() === name ||
                        ruleset.name.toLowerCase() === name) {
                    return true;
                }
            }
        }

        return false;
    },

    /**
     * Set default ruleset.
     * @param {String} id ID of the ruleset to be used as default.
     */
    setDefaultRuleset: function (id) {
        if (this.rulesets[id] !== undefined) {
            this.default_ruleset_id = id;
            // save to pref
            YSLOW.util.Preference.setPref("defaultRuleset", id);
        }
    },

    /**
     * Get default ruleset.
     * @return default ruleset
     * @type YSLOW.Ruleset
     */
    getDefaultRuleset: function () {
        if (this.rulesets[this.default_ruleset_id] === undefined) {
            this.setDefaultRuleset('ydefault');
        }
        return this.rulesets[this.default_ruleset_id];
    },

    /**
     * Get default ruleset id
     * @return ID of the default ruleset
     * @type String
     */
    getDefaultRulesetId: function () {
        return this.default_ruleset_id;
    },

    /**
     * Load user preference for some rules. This is needed before enabling user writing ruleset yslow plugin.
     */
    loadRulePreference: function () {
        var rule = this.getRule('yexpires'),
            minSeconds = YSLOW.util.Preference.getPref("minFutureExpiresSeconds", 2 * 24 * 60 * 60);

        if (minSeconds > 0 && rule) {
            rule.config.howfar = minSeconds;
        }
    }
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW, Firebug, Components, ActiveXObject, gBrowser, window, getBrowser*/
/*jslint sloppy: true, bitwise: true, browser: true, regexp: true*/

/**
 * @namespace YSLOW
 * @class util
 * @static
 */
YSLOW.util = {

    /**
     * merges two objects together, the properties of the second
     * overwrite the properties of the first
     *
     * @param {Object} a Object a
     * @param {Object} b Object b
     * @return {Object} A new object, result of the merge
     */
    merge: function (a, b) {
        var i, o = {};

        for (i in a) {
            if (a.hasOwnProperty(i)) {
                o[i] = a[i];
            }
        }
        for (i in b) {
            if (b.hasOwnProperty(i)) {
                o[i] = b[i];
            }
        }
        return o;

    },


    /**
     * Dumps debug information in FB console, Error console or alert
     *
     * @param {Object} what Object to dump
     */
    dump: function () {
        var args;

        // skip when debbuging is disabled
        if (!YSLOW.DEBUG) {
            return;
        }

        // get arguments and normalize single parameter
        args = Array.prototype.slice.apply(arguments);
        args = args && args.length === 1 ? args[0] : args;

        try {
            if (typeof Firebug !== 'undefined' && Firebug.Console
                    && Firebug.Console.log) { // Firebug
                Firebug.Console.log(args);
            } else if (typeof Components !== 'undefined' && Components.classes
                    && Components.interfaces) { // Firefox
                Components.classes['@mozilla.org/consoleservice;1']
                    .getService(Components.interfaces.nsIConsoleService)
                    .logStringMessage(JSON.stringify(args, null, 2));
            }
        } catch (e1) {
            try {
                console.log(args);
            } catch (e2) {
                // alert shouldn't be used due to its annoying modal behavior
            }
        }
    },

    /**
     * Filters an object/hash using a callback
     *
     * The callback function will be passed two params - a key and a value of each element
     * It should return TRUE is the element is to be kept, FALSE otherwise
     *
     * @param {Object} hash Object to be filtered
     * @param {Function} callback A callback function
     * @param {Boolean} rekey TRUE to return a new array, FALSE to return an object and keep the keys/properties
     */
    filter: function (hash, callback, rekey) {
        var i,
            result = rekey ? [] : {};

        for (i in hash) {
            if (hash.hasOwnProperty(i) && callback(i, hash[i])) {
                result[rekey ? result.length : i] = hash[i];
            }
        }

        return result;
    },

    expires_month: {
        Jan: 1,
        Feb: 2,
        Mar: 3,
        Apr: 4,
        May: 5,
        Jun: 6,
        Jul: 7,
        Aug: 8,
        Sep: 9,
        Oct: 10,
        Nov: 11,
        Dec: 12
    },


    /**
     * Make a pretty string out of an Expires object.
     *
     * @todo Remove or replace by a general-purpose date formatting method
     *
     * @param {String} s_expires Datetime string
     * @return {String} Prity date
     */
    prettyExpiresDate: function (expires) {
        var month;

        if (Object.prototype.toString.call(expires) === '[object Date]' && expires.toString() !== 'Invalid Date' && !isNaN(expires)) {
            month = expires.getMonth() + 1;
            return expires.getFullYear() + "/" + month + "/" + expires.getDate();
        } else if (!expires) {
            return 'no expires';
        }
        return 'invalid date object';
    },

    /**
     * Converts cache-control: max-age=? into a JavaScript date
     *
     * @param {Integer} seconds Number of seconds in the cache-control header
     * @return {Date} A date object coresponding to the expiry date
     */
    maxAgeToDate: function (seconds) {
        var d = new Date();

        d = d.getTime() + parseInt(seconds, 10) * 1000;
        return new Date(d);
    },

    /**
     * Produces nicer sentences accounting for single/plural occurences.
     *
     * For example: "There are 3 scripts" vs "There is 1 script".
     * Currently supported tags to be replaced are:
     * %are%, %s% and %num%
     *
     *
     * @param {String} template A template with tags, like "There %are% %num% script%s%"
     * @param {Integer} num An integer value that replaces %num% and also deternmines how the other tags will be replaced
     * @return {String} The text after substitution
     */
    plural: function (template, number) {
        var i,
            res = template,
            repl = {
                are: ['are', 'is'],
                s: ['s', ''],
                'do': ['do', 'does'],
                num: [number, number]
            };


        for (i in repl) {
            if (repl.hasOwnProperty(i)) {
                res = res.replace(new RegExp('%' + i + '%', 'gm'), (number === 1) ? repl[i][1] : repl[i][0]);
            }
        }

        return res;
    },

    /**
     * Counts the number of expression in a given piece of stylesheet.
     *
     * Expressions are identified by the presence of the literal string "expression(".
     * There could be false positives in commented out styles.
     *
     * @param {String} content Text to inspect for the presence of expressions
     * @return {Integer} The number of expressions in the text
     */
    countExpressions: function (content) {
        var num_expr = 0,
            index;

        index = content.indexOf("expression(");
        while (index !== -1) {
            num_expr += 1;
            index = content.indexOf("expression(", index + 1);
        }

        return num_expr;
    },

    /**
     * Counts the number of AlphaImageLoader filter in a given piece of stylesheet.
     *
     * AlphaImageLoader filters are identified by the presence of the literal string "filter:" and
     * "AlphaImageLoader" .
     * There could be false positives in commented out styles.
     *
     * @param {String} content Text to inspect for the presence of filters
     * @return {Hash} 'filter type' => count. For Example, {'_filter' : count }
     */
    countAlphaImageLoaderFilter: function (content) {
        var index, colon, filter_hack, value,
            num_filter = 0,
            num_hack_filter = 0,
            result = {};

        index = content.indexOf("filter:");
        while (index !== -1) {
            filter_hack = false;
            if (index > 0 && content.charAt(index - 1) === '_') {
                // check underscore.
                filter_hack = true;
            }
            // check literal string "AlphaImageLoader"
            colon = content.indexOf(";", index + 7);
            if (colon !== -1) {
                value = content.substring(index + 7, colon);
                if (value.indexOf("AlphaImageLoader") !== -1) {
                    if (filter_hack) {
                        num_hack_filter += 1;
                    } else {
                        num_filter += 1;
                    }
                }
            }
            index = content.indexOf("filter:", index + 1);
        }

        if (num_hack_filter > 0) {
            result.hackFilter = num_hack_filter;
        }
        if (num_filter > 0) {
            result.filter = num_filter;
        }

        return result;
    },

    /**
     * Returns the hostname (domain) for a given URL
     * 
     * @param {String} url The absolute URL to get hostname from
     * @return {String} The hostname
     */
    getHostname: function (url) {
        var hostname = url.split('/')[2];

        return (hostname && hostname.split(':')[0]) || '';
    },

    /**
     * Returns an array of unique domain names, based on a given array of components
     *
     * @param {Array} comps An array of components (not a @see ComponentSet)
     * @param {Boolean} exclude_ips Whether to exclude IP addresses from the list of domains (for DNS check purposes)
     * @return {Array} An array of unique domian names
     */
    getUniqueDomains: function (comps, exclude_ips) {
        var i, len, parts,
            domains = {},
            retval = [];

        for (i = 0, len = comps.length; i < len; i += 1) {
            parts = comps[i].url.split('/');
            if (parts[2]) {
                // add to hash, but remove port number first
                domains[parts[2].split(':')[0]] = 1;
            }
        }

        for (i in domains) {
            if (domains.hasOwnProperty(i)) {
                if (!exclude_ips) {
                    retval.push(i);
                } else {
                    // exclude ips, identify them by the pattern "what.e.v.e.r.[number]"
                    parts = i.split('.');
                    if (isNaN(parseInt(parts[parts.length - 1], 10))) {
                        // the last part is "com" or something that is NaN
                        retval.push(i);
                    }
                }
            }
        }

        return retval;
    },

    summaryByDomain: function (comps, sumFields, excludeIPs) {
        var i, j, len, parts, hostname, domain, comp, sumLen, field, sum,
            domains = {},
            retval = [];

        // normalize sumField to array (makes things easier)
        sumFields = [].concat(sumFields);
        sumLen = sumFields.length;

        // loop components, count and summarize fields
        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            parts = comp.url.split('/');
            if (parts[2]) {
                // add to hash, but remove port number first
                hostname = parts[2].split(':')[0];
                domain = domains[hostname];
                if (!domain) {
                    domain = {
                        domain: hostname,
                        count: 0
                    };
                    domains[hostname] = domain;
                }
                domain.count += 1;
                // fields summary
                for (j = 0; j < sumLen; j += 1) {
                    field = sumFields[j];
                    sum = domain['sum_' + field] || 0;
                    sum += parseInt(comp[field], 10) || 0;
                    domain['sum_' + field] = sum;
                }
            }
        }

        // loop hash of unique domains
        for (domain in domains) {
            if (domains.hasOwnProperty(domain)) {
                if (!excludeIPs) {
                    retval.push(domains[domain]);
                } else {
                    // exclude ips, identify them by the pattern "what.e.v.e.r.[number]"
                    parts = domain.split('.');
                    if (isNaN(parseInt(parts[parts.length - 1], 10))) {
                        // the last part is "com" or something that is NaN
                        retval.push(domains[domain]);
                    }
                }
            }
        }

        return retval;
    },

    /**
     * Checks if a given piece of text (sctipt, stylesheet) is minified.
     *
     * The logic is: we strip consecutive spaces, tabs and new lines and
     * if this improves the size by more that 20%, this means there's room for improvement.
     *
     * @param {String} contents The text to be checked for minification
     * @return {Boolean} TRUE if minified, FALSE otherwise
     */
    isMinified: function (contents) {
        var len = contents.length,
            striplen;

        if (len === 0) { // blank is as minified as can be
            return true;
        }

        // TODO: enhance minifier logic by adding comment checking: \/\/[\w\d \t]*|\/\*[\s\S]*?\*\/
        // even better: add jsmin/cssmin
        striplen = contents.replace(/\n| {2}|\t|\r/g, '').length; // poor man's minifier
        if (((len - striplen) / len) > 0.2) { // we saved 20%, so this component can get some mifinication done
            return false;
        }

        return true;
    },


    /**
     * Inspects the ETag.
     *
     * Returns FALSE (bad ETag) only if the server is Apache or IIS and the ETag format
     * matches the default ETag format for the server. Anything else, including blank etag
     * returns TRUE (good ETag).
     * Default IIS: Filetimestamp:ChangeNumber
     * Default Apache: inode-size-timestamp
     *
     * @param {String} etag ETag response header
     * @return {Boolean} TRUE if ETag is good, FALSE otherwise
     */
    isETagGood: function (etag) {
        var reIIS = /^[0-9a-f]+:([1-9a-f]|[0-9a-f]{2,})$/,
            reApache = /^[0-9a-f]+\-[0-9a-f]+\-[0-9a-f]+$/;

        if (!etag) {
            return true; // no etag is ok etag
        }

        etag = etag.replace(/^["']|["'][\s\S]*$/g, ''); // strip " and '
        return !(reApache.test(etag) || reIIS.test(etag));
    },

    /**
     * Get internal component type from passed mime type.
     * @param {String} content_type mime type of the content.
     * @return yslow internal component type
     * @type String
     */
    getComponentType: function (content_type) {
        var c_type = 'unknown';

        if (content_type && typeof content_type === "string") {
            if (content_type === "text/html" || content_type === "text/plain") {
                c_type = 'doc';
            } else if (content_type === "text/css") {
                c_type = 'css';
            } else if (/javascript/.test(content_type)) {
                c_type = 'js';
            } else if (/flash/.test(content_type)) {
                c_type = 'flash';
            } else if (/image/.test(content_type)) {
                c_type = 'image';
            } else if (/font/.test(content_type)) {
                c_type = 'font';
            }
        }

        return c_type;
    },

    /**
     * base64 encode the data. This works with data that fails win.atob.
     * @param {bytes} data data to be encoded.
     * @return bytes array of data base64 encoded.
     */
    base64Encode: function (data) {
        var i, a, b, c, new_data = '',
            padding = 0,
            arr = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'];

        for (i = 0; i < data.length; i += 3) {
            a = data.charCodeAt(i);
            if ((i + 1) < data.length) {
                b = data.charCodeAt(i + 1);
            } else {
                b = 0;
                padding += 1;
            }
            if ((i + 2) < data.length) {
                c = data.charCodeAt(i + 2);
            } else {
                c = 0;
                padding += 1;
            }

            new_data += arr[(a & 0xfc) >> 2];
            new_data += arr[((a & 0x03) << 4) | ((b & 0xf0) >> 4)];
            if (padding > 0) {
                new_data += "=";
            } else {
                new_data += arr[((b & 0x0f) << 2) | ((c & 0xc0) >> 6)];
            }
            if (padding > 1) {
                new_data += "=";
            } else {
                new_data += arr[(c & 0x3f)];
            }
        }

        return new_data;
    },

    /**
     * Creates x-browser XHR objects
     *
     * @return {XMLHTTPRequest} A new XHR object
     */
    getXHR: function () {
        var i = 0,
            xhr = null,
            ids = ['MSXML2.XMLHTTP.3.0', 'MSXML2.XMLHTTP', 'Microsoft.XMLHTTP'];


        if (typeof XMLHttpRequest === 'function') {
            return new XMLHttpRequest();
        }

        for (i = 0; i < ids.length; i += 1) {
            try {
                xhr = new ActiveXObject(ids[i]);
                break;
            } catch (e) {}

        }

        return xhr;
    },

    /**
     * Returns the computed style
     *
     * @param {HTMLElement} el A node
     * @param {String} st Style identifier, e.g. "backgroundImage"
     * @param {Boolean} get_url Whether to return a url
     * @return {String|Boolean} The value of the computed style, FALSE if get_url is TRUE and the style is not a URL
     */
    getComputedStyle: function (el, st, get_url) {
        var style, urlMatch,
            res = '';

        if (el.currentStyle) {
            res = el.currentStyle[st];
        }

        if (el.ownerDocument && el.ownerDocument.defaultView && document.defaultView.getComputedStyle) {
            style = el.ownerDocument.defaultView.getComputedStyle(el, '');
            if (style) {
                res = style[st];
            }
        }

        if (!get_url) {
            return res;
        }

        if (typeof res !== 'string') {
            return false;
        }

        urlMatch = res.match(/\burl\((\'|\"|)([^\'\"]+?)\1\)/);
        if (urlMatch) {
            return urlMatch[2];
        } else {
            return false;
        }
    },

    /**
     * escape '<' and '>' in the passed html code.
     * @param {String} html code to be escaped.
     * @return escaped html code
     * @type String
     */
    escapeHtml: function (html) {
        return (html || '').toString()
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    },

    /**
     * escape quotes in the passed html code.
     * @param {String} str string to be escaped.
     * @param {String} which type of quote to be escaped. 'single' or 'double'
     * @return escaped string code
     * @type String
     */
    escapeQuotes: function (str, which) {
        if (which === 'single') {
            return str.replace(/\'/g, '\\\''); // '
        }
        if (which === 'double') {
            return str.replace(/\"/g, '\\\"'); // "
        }
        return str.replace(/\'/g, '\\\'').replace(/\"/g, '\\\"'); // ' and "
    },

    /**
     * Convert a HTTP header name to its canonical form,
     * e.g. "content-length" => "Content-Length".
     * @param headerName the header name (case insensitive)
     * @return {String} the formatted header name
     */
    formatHeaderName: (function () {
        var specialCases = {
            'content-md5': 'Content-MD5',
            dnt: 'DNT',
            etag: 'ETag',
            p3p: 'P3P',
            te: 'TE',
            'www-authenticate': 'WWW-Authenticate',
            'x-att-deviceid': 'X-ATT-DeviceId',
            'x-cdn': 'X-CDN',
            'x-ua-compatible': 'X-UA-Compatible',
            'x-xss-protection': 'X-XSS-Protection'
        };
        return function (headerName) {
            var lowerCasedHeaderName = headerName.toLowerCase();
            if (specialCases.hasOwnProperty(lowerCasedHeaderName)) {
                return specialCases[lowerCasedHeaderName];
            } else {
                // Make sure that the first char and all chars following a dash are upper-case:
                return lowerCasedHeaderName.replace(/(^|-)([a-z])/g, function ($0, optionalLeadingDash, ch) {
                    return optionalLeadingDash + ch.toUpperCase();
                });
            }
        };
    }()),

    /**
     * Math mod method.
     * @param {Number} divisee
     * @param {Number} base
     * @return mod result
     * @type Number
     */
    mod: function (divisee, base) {
        return Math.round(divisee - (Math.floor(divisee / base) * base));
    },

    /**
     * Abbreviate the passed url to not exceed maxchars.
     * (Just display the hostname and first few chars after the last slash.
     * @param {String} url originial url
     * @param {Number} maxchars max. number of characters in the result string.
     * @return abbreviated url
     * @type String
     */
    briefUrl: function (url, maxchars) {
        var iDoubleSlash, iQMark, iFirstSlash, iLastSlash;

        maxchars = maxchars || 100; // default 100 characters
        if (url === undefined) {
            return '';
        }

        // We assume it's a full URL.
        iDoubleSlash = url.indexOf("//");
        if (-1 !== iDoubleSlash) {

            // remove query string
            iQMark = url.indexOf("?");
            if (-1 !== iQMark) {
                url = url.substring(0, iQMark) + "?...";
            }

            if (url.length > maxchars) {
                iFirstSlash = url.indexOf("/", iDoubleSlash + 2);
                iLastSlash = url.lastIndexOf("/");
                if (-1 !== iFirstSlash && -1 !== iLastSlash && iFirstSlash !== iLastSlash) {
                    url = url.substring(0, iFirstSlash + 1) + "..." + url.substring(iLastSlash);
                } else {
                    url = url.substring(0, maxchars + 1) + "...";
                }
            }
        }

        return url;
    },

    /**
     * Return a string with an anchor around a long piece of text.
     * (It's confusing, but often the "long piece of text" is the URL itself.)
     * Snip the long text if necessary.
     * Optionally, break the long text across multiple lines.
     * @param {String} text
     * @param {String} url
     * @param {String} sClass class name for the new anchor
     * @param {Boolean} bBriefUrl whether the url should be abbreviated.
     * @param {Number} maxChars max. number of chars allowed for each line.
     * @param {Number} numLines max. number of lines allowed
     * @param {String} rel rel attribute of anchor.
     * @return html code for the anchor.
     * @type String
     */
    prettyAnchor: function (text, url, sClass, bBriefUrl, maxChars, numLines, rel) {
        var escaped_dq_url,
            sTitle = '',
            sResults = '',
            iLines = 0;

        if (typeof url === 'undefined') {
            url = text;
        }
        if (typeof sClass === 'undefined') {
            sClass = '';
        } else {
            sClass = ' class="' + sClass + '"';
        }
        if (typeof maxChars === 'undefined') {
            maxChars = 100;
        }
        if (typeof numLines === 'undefined') {
            numLines = 1;
        }
        rel = (rel) ? ' rel="' + rel + '"' : '';

        url = YSLOW.util.escapeHtml(url);
        text = YSLOW.util.escapeHtml(text);

        escaped_dq_url = YSLOW.util.escapeQuotes(url, 'double');

        if (bBriefUrl) {
            text = YSLOW.util.briefUrl(text, maxChars);
            sTitle = ' title="' + escaped_dq_url + '"';
        }

        while (0 < text.length) {
            sResults += '<a' + rel + sClass + sTitle + ' href="' +
                escaped_dq_url +
                '" onclick="javascript:document.ysview.openLink(\'' +
                YSLOW.util.escapeQuotes(url) +
                '\'); return false;">' + text.substring(0, maxChars);
            text = text.substring(maxChars);
            iLines += 1;
            if (iLines >= numLines) {
                // We've reached the maximum number of lines.
                if (0 < text.length) {
                    // If there's still text leftover, snip it.
                    sResults += "[snip]";
                }
                sResults += "</a>";
                break;
            } else {
                // My (weak) attempt to break long URLs.
                sResults += "</a><font style='font-size: 0px;'> </font>";
            }
        }

        return sResults;
    },

    /**
     * Convert a number of bytes into a readable KB size string.
     * @param {Number} size
     * @return readable KB size string
     * @type String
     */
    kbSize: function (size) {
        var remainder = size % (size > 100 ? 100 : 10);
        size -= remainder;
        return parseFloat(size / 1000) + (0 === (size % 1000) ? ".0" : "") + "K";
    },

    /**
     * @final
     */
    prettyTypes: {
        "image": "Image",
        "doc": "HTML/Text",
        "cssimage": "CSS Image",
        "css": "Stylesheet File",
        "js": "JavaScript File",
        "flash": "Flash Object",
        "iframe": "IFrame",
        "xhr": "XMLHttpRequest",
        "redirect": "Redirect",
        "favicon": "Favicon",
        "unknown": "Unknown"
    },

/*
     *  Convert a type (eg, "cssimage") to a prettier name (eg, "CSS Images").
     * @param {String} sType component type
     * @return display name of component type
     * @type String
     */
    prettyType: function (sType) {
        return YSLOW.util.prettyTypes[sType];
    },

    /**
     *  Return a letter grade for a score.
     * @param {String or Number} iScore
     * @return letter grade for a score
     * @type String
     */
    prettyScore: function (score) {
        var letter = 'F';

        if (!parseInt(score, 10) && score !== 0) {
            return score;
        }
        if (score === -1) {
            return 'N/A';
        }

        if (score >= 90) {
            letter = 'A';
        } else if (score >= 80) {
            letter = 'B';
        } else if (score >= 70) {
            letter = 'C';
        } else if (score >= 60) {
            letter = 'D';
        } else if (score >= 50) {
            letter = 'E';
        }

        return letter;
    },

    /**
     * Returns YSlow results as an Object.
     * @param {YSLOW.context} yscontext yslow context.
     * @param {String|Array} info Information to be shown
     *        (basic|grade|stats|comps|all) [basic].
     * @return {Object} the YSlow results object.
     */
    getResults: function (yscontext, info) {
        var i, l, results, url, type, comps, comp, encoded_url, obj, cr,
            cs, etag, name, len, include_grade, include_comps, include_stats,
            result, len2, spaceid, header, sourceHeaders, targetHeaders,
            reButton = / <button [\s\S]+<\/button>/,
            util = YSLOW.util,
            isArray = util.isArray,
            stats = {},
            stats_c = {},
            comp_objs = [],
            params = {},
            g = {};

        // default
        info = (info || 'basic').split(',');

        for (i = 0, len = info.length; i < len; i += 1) {
            if (info[i] === 'all') {
                include_grade = include_stats = include_comps = true;
                break;
            } else {
                switch (info[i]) {
                case 'grade':
                    include_grade = true;
                    break;
                case 'stats':
                    include_stats = true;
                    break;
                case 'comps':
                    include_comps = true;
                    break;
                }
            }
        }

        params.v = YSLOW.version;
        params.w = parseInt(yscontext.PAGE.totalSize, 10);
        params.o = parseInt(yscontext.PAGE.overallScore, 10);
        params.u = encodeURIComponent(yscontext.result_set.url);
        params.r = parseInt(yscontext.PAGE.totalRequests, 10);
        spaceid = util.getPageSpaceid(yscontext.component_set);
        if (spaceid) {
            params.s = encodeURI(spaceid);
        }
        params.i = yscontext.result_set.getRulesetApplied().id;
        if (yscontext.PAGE.t_done) {
            params.lt = parseInt(yscontext.PAGE.t_done, 10);
        }

        if (include_grade) {
            results = yscontext.result_set.getResults();
            for (i = 0, len = results.length; i < len; i += 1) {
                obj = {};
                result = results[i];
                if (result.hasOwnProperty('score')) {
                    if (result.score >= 0) {
                        obj.score = parseInt(result.score, 10);
                    } else if (result.score === -1) {
                        obj.score = 'n/a';
                    }
                }
                // removing hardcoded open link,
                // TODO: remove those links from original messages
                obj.message = result.message.replace(
                    /javascript:document\.ysview\.openLink\('(.+)'\)/,
                    '$1'
                );
                comps = result.components;
                if (isArray(comps)) {
                    obj.components = [];
                    for (l = 0, len2 = comps.length; l < len2; l += 1) {
                        comp = comps[l];
                        if (typeof comp === 'string') {
                            url = comp;
                        } else if (typeof comp.url === 'string') {
                            url = comp.url;
                        }
                        if (url) {
                            url = encodeURIComponent(url.replace(reButton, ''));
                            obj.components.push(url);
                        }
                    }
                }
                g[result.rule_id] = obj;
            }
            params.g = g;
        }

        if (include_stats) {
            params.w_c = parseInt(yscontext.PAGE.totalSizePrimed, 10);
            params.r_c = parseInt(yscontext.PAGE.totalRequestsPrimed, 10);

            for (type in yscontext.PAGE.totalObjCount) {
                if (yscontext.PAGE.totalObjCount.hasOwnProperty(type)) {
                    stats[type] = {
                        'r': yscontext.PAGE.totalObjCount[type],
                        'w': yscontext.PAGE.totalObjSize[type]
                    };
                }
            }
            params.stats = stats;

            for (type in yscontext.PAGE.totalObjCountPrimed) {
                if (yscontext.PAGE.totalObjCountPrimed.hasOwnProperty(type)) {
                    stats_c[type] = {
                        'r': yscontext.PAGE.totalObjCountPrimed[type],
                        'w': yscontext.PAGE.totalObjSizePrimed[type]
                    };
                }
            }
            params.stats_c = stats_c;
        }

        if (include_comps) {
            comps = yscontext.component_set.components;
            for (i = 0, len = comps.length; i < len; i += 1) {
                comp = comps[i];
                encoded_url = encodeURIComponent(comp.url);
                obj = {
                    'type': comp.type,
                    'url': encoded_url,
                    'size': comp.size,
                    'resp': comp.respTime
                };
                if (comp.size_compressed) {
                    obj.gzip = comp.size_compressed;
                }
                if (comp.expires && comp.expires instanceof Date) {
                    obj.expires = util.prettyExpiresDate(comp.expires);
                }
                cr = comp.getReceivedCookieSize();
                if (cr > 0) {
                    obj.cr = cr;
                }
                cs = comp.getSetCookieSize();
                if (cs > 0) {
                    obj.cs = cs;
                }
                etag = comp.getEtag();
                if (typeof etag === 'string' && etag.length > 0) {
                    obj.etag = etag;
                }
                // format req/res headers
                obj.headers = {};
                if (comp.req_headers) {
                    sourceHeaders = comp.req_headers;
                    obj.headers.request = {};
                    targetHeaders = obj.headers.request;
                    for (header in sourceHeaders) {
                        if (sourceHeaders.hasOwnProperty(header)) {
                            targetHeaders[util.formatHeaderName(header)] =
                                sourceHeaders[header];
                        }
                    }
                }
                if (comp.headers) {
                    sourceHeaders = comp.headers;
                    obj.headers.response = {};
                    targetHeaders = obj.headers.response;
                    for (header in sourceHeaders) {
                        if (sourceHeaders.hasOwnProperty(header)) {
                            targetHeaders[util.formatHeaderName(header)] =
                                sourceHeaders[header];
                        }
                    }
                }
                comp_objs.push(obj);
            }
            params.comps = comp_objs;
        }

        return params;
    },

    /**
     * Send YSlow beacon.
     * @param {Object} results Results object
     *        generated by {@link YSLOW.util.getResults}.
     * @param {String|Array} info Information to be beaconed
     *        (basic|grade|stats|comps|all).
     * @param {String} url The URL to fire beacon to.
     * @return {String} The beacon content sent.
     */
    sendBeacon: function (results, info, url) {
        var i, len, req, name, img,
            beacon = '',
            util = YSLOW.util,
            pref = util.Preference,
            method = 'get';

        // default
        info = (info || 'basic').split(',');

        for (i = 0, len = info.length; i < len; i += 1) {
            if (info[i] === 'all') {
                method = 'post';
                break;
            } else {
                switch (info[i]) {
                case 'grade':
                    method = 'post';
                    break;
                case 'stats':
                    method = 'post';
                    break;
                case 'comps':
                    method = 'post';
                    break;
                }
            }
        }

        if (method === 'post') {
            beacon = JSON.stringify(results, null);
            req = util.getXHR();
            req.open('POST', url, true);
            req.setRequestHeader('Content-Length', beacon.length);
            req.setRequestHeader('Content-Type', 'application/json');
            req.send(beacon);
        } else {
            for (name in results) {
                if (results.hasOwnProperty(name)) {
                    beacon += name + '=' + results[name] + '&';
                }
            }
            img = new Image();
            img.src = url + '?' + beacon;
        }

        return beacon;
    },

    /**
     * Get the dictionary of params used in results.
     * @param {String|Array} info Results information
     *        (basic|grade|stats|comps|all).
     * @param {String} ruleset The Results ruleset used
     *        (ydefault|yslow1|yblog).
     * @return {Object} The dictionary object {key: value}.
     */
    getDict: function (info, ruleset) {
        var i, len, include_grade, include_stats, include_comps,
            weights, rs,
            yslow = YSLOW,
            controller = yslow.controller,
            rules = yslow.doc.rules,
            dict = {
                v: 'version',
                w: 'size',
                o: 'overall score',
                u: 'url',
                r: 'total number of requests',
                s: 'space id of the page',
                i: 'id of the ruleset used',
                lt: 'page load time',
                grades: '100 >= A >= 90 > B >= 80 > C >= 70 > ' +
                    'D >= 60 > E >= 50 > F >= 0 > N/A = -1'
            };

        // defaults
        info = (info || 'basic').split(',');
        ruleset = ruleset || 'ydefault';
        weights = controller.rulesets[ruleset].weights;

        // check which info will be included
        for (i = 0, len = info.length; i < len; i += 1) {
            if (info[i] === 'all') {
                include_grade = include_stats = include_comps = true;
                break;
            } else {
                switch (info[i]) {
                case 'grade':
                    include_grade = true;
                    break;
                case 'stats':
                    include_stats = true;
                    break;
                case 'comps':
                    include_comps = true;
                    break;
                }
            }
        }

        // include dictionary
        if (include_grade) {
            dict.g = 'scores of all rules in the ruleset';
            dict.rules = {};
            for (rs in weights) {
                if (weights.hasOwnProperty(rs)) {
                    dict.rules[rs] = rules[rs];
                    dict.rules[rs].weight = weights[rs];
                }
            }
        }
        if (include_stats) {
            dict.w_c = 'page weight with primed cache';
            dict.r_c = 'number of requests with primed cache';
            dict.stats = 'number of requests and weight grouped by ' +
                'component type';
            dict.stats_c = 'number of request and weight of ' +
                'components group by component type with primed cache';
        }
        if (include_comps) {
            dict.comps = 'array of all the components found on the page';
        }

        return dict;
    },

    /**
     * Check if input is an Object
     * @param {Object} the input to check wheter it's an object or not
     * @return {Booleam} true for Object
     */
    isObject: function (o) {
        return Object.prototype.toString.call(o).indexOf('Object') > -1;
    },

    /**
     * Check if input is an Array
     * @param {Array} the input to check wheter it's an array or not
     * @return {Booleam} true for Array
     */
    isArray: function (o) {
        if (Array.isArray) {
            return Array.isArray(o);
        } else {
            return Object.prototype.toString.call(o).indexOf('Array') > -1;
        }
    },


    /**
     * Wrapper for decodeURIComponent, try to decode
     * otherwise return the input value.
     * @param {String} value The value to be decoded.
     * @return {String} The decoded value.
     */
    decodeURIComponent: function (value) {
        try {
            return decodeURIComponent(value);
        } catch (err) {
            return value;
        }
    },

    /**
     * Decode html entities. e.g.: &lt; becomes <
     * @param {String} str the html string to decode entities from.
     * @return {String} the input html with entities decoded.
     */
    decodeEntities: function (str) {
        return String(str)
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
    },

    safeXML: (function () {
        var decodeComp = this.decodeURIComponent,
            reInvalid = /[<&>]/;

        return function (value, decode) {
            if (decode) {
                value = decodeComp(value);
            }
            if (reInvalid.test(value)) {
                return '<![CDATA[' + value + ']]>';
            }
            return value;
        };
    }()),

    /**
     * convert Object to XML
     * @param {Object} obj the Object to be converted to XML
     * @param {String} root the XML root (default = results)
     * @return {String} the XML
     */
    objToXML: function (obj, root) {
        var toXML,
            util = YSLOW.util,
            safeXML = util.safeXML,
            xml = '<?xml version="1.0" encoding="UTF-8"?>';

        toXML = function (o) {
            var item, value, i, len, val, type;

            for (item in o) {
                if (o.hasOwnProperty(item)) {
                    value = o[item];
                    xml += '<' + item + '>';
                    if (util.isArray(value)) {
                        for (i = 0, len = value.length; i < len; i += 1) {
                            val = value[i];
                            type = typeof val;
                            xml += '<item>';
                            if (type === 'string' || type === 'number') {
                                xml += safeXML(val, item === 'components');
                            } else {
                                toXML(val);
                            }
                            xml += '</item>';
                        }
                    } else if (util.isObject(value)) {
                        toXML(value);
                    } else {
                        xml += safeXML(value, item === 'u' || item === 'url');
                    }
                    xml += '</' + item + '>';
                }
            }
        };

        root = root || 'results';
        xml += '<' + root + '>';
        toXML(obj);
        xml += '</' + root + '>';

        return xml;
    },

    /**
     * Pretty print results
     * @param {Object} obj the Object with YSlow results
     * @return {String} the results in plain text (pretty printed)
     */
    prettyPrintResults: function (obj) {
        var pp,
            util = YSLOW.util,
            str = '',
            mem = {},

            dict = {
                v: 'version',
                w: 'size',
                o: 'overall score',
                u: 'url',
                r: '# of requests',
                s: 'space id',
                i: 'ruleset',
                lt: 'page load time',
                g: 'scores',
                w_c: 'page size (primed cache)',
                r_c: '# of requests (primed cache)',
                stats: 'statistics by component',
                stats_c: 'statistics by component (primed cache)',
                comps: 'components found on the page',
                components: 'offenders',
                cr: 'received cookie size',
                cs: 'set cookie size',
                resp: 'response time'
            },

            indent = function (n) {
                var arr,
                    res = mem[n];

                if (typeof res === 'undefined') {
                    arr = [];
                    arr.length = (4 * n) + 1;
                    mem[n] = res = arr.join(' ');
                }

                return res;
            };

        pp = function (o, level) {
            var item, value, i, len, val, type;

            for (item in o) {
                if (o.hasOwnProperty(item)) {
                    value = o[item];
                    str += indent(level) + (dict[item] || item) + ':';
                    if (util.isArray(value)) {
                        str += '\n';
                        for (i = 0, len = value.length; i < len; i += 1) {
                            val = value[i];
                            type = typeof val;
                            if (type === 'string' || type === 'number') {
                                str += indent(level + 1) +
                                    util.decodeURIComponent(val) + '\n';
                            } else {
                                pp(val, level + 1);
                                if (i < len - 1) {
                                    str += '\n';
                                }
                            }
                        }
                    } else if (util.isObject(value)) {
                        str += '\n';
                        pp(value, level + 1);
                    } else {
                        if (item === 'score' || item === 'o') {
                            value = util.prettyScore(value) + ' (' + value + ')';
                        }
                        if (item === 'w' || item === 'w_c' ||
                                item === 'size' || item === 'gzip' ||
                                item === 'cr' || item === 'cs') {
                            value = util.kbSize(value) + ' (' + value + ' bytes)';
                        }
                        str += ' ' + util.decodeURIComponent(value) + '\n';
                    }
                }
            }
        };

        pp(obj, 0);

        return str;
    },

    /**
     * Test result against a certain threshold for CI
     * @param {Object} obj the Object with YSlow results
     * @param {String|Number|Object} threshold The definition of OK (inclusive)
     *        Anything >= threshold == OK. It can be a number [0-100],
     *        a letter [A-F] as follows:
     *        100 >= A >= 90 > B >= 80 > C >= 70 > D >= 60 > E >= 50 > F >= 0 > N/A = -1
     *        It can also be a specific per rule. e.g:
     *        {overall: 80, ycdn: 65, ynumreq: 'B'}
     *        where overall is the common threshold to be
     *        used by all rules except those listed
     * @return {Array} the test result array containing each test result details:
     */
    testResults: function (obj, threshold) {
        var overall, g, grade, grades, score, commonScore, i, len,
            tests = [],
            scores = {
                a: 90,
                b: 80,
                c: 70,
                d: 60,
                e: 50,
                f: 0,
                'n/a': -1
            },
            yslow = YSLOW,
            util = yslow.util,
            isObj = util.isObject(threshold),
            rules = yslow.doc.rules,

            getScore = function (value) {
                var score = parseInt(value, 10);

                if (isNaN(score) && typeof value === 'string') {
                    score = scores[value.toLowerCase()];
                }

                // edge case for F or 0
                if (score === 0) {
                    return 0;
                }

                return score || overall || scores.b;
            },

            getThreshold = function (name) {
                if (commonScore) {
                    return commonScore;
                }

                if (!isObj) {
                    commonScore = getScore(threshold);
                    return commonScore;
                } else if (threshold.hasOwnProperty(name)) {
                    return getScore(threshold[name]);
                } else {
                    return overall || scores.b;
                }
            },

            test = function (score, ts, name, message, offenders) {
                var desc = rules.hasOwnProperty(name) && rules[name].name;

                tests.push({
                    ok: score >= ts,
                    score: score,
                    grade: util.prettyScore(score),
                    name: name,
                    description: desc || '',
                    message: message,
                    offenders: offenders
                });
            };

        // overall threshold (default b [80])
        overall = getThreshold('overall');

        // overall score
        test(obj.o, overall, 'overall score');

        // grades
        grades = obj.g;
        if (grades) {
            for (grade in grades) {
                if (grades.hasOwnProperty(grade)) {
                    g = grades[grade];
                    score = g.score;
                    if (typeof score === 'undefined') {
                        score = -1;
                    }
                    test(score, getThreshold(grade), grade,
                        g.message, g.components);
                }
            }
        }

        return tests;
    },

    /**
     * Format test results as TAP for CI
     * @see: http://testanything.org/wiki/index.php/TAP_specification
     * @param {Array} tests the arrays containing the test results from testResults.
     * @return {Object}:
     *    failures: {Number} total test failed,
     *    content: {String} the results as TAP plain text
     */
    formatAsTAP: function (results) {
        var i, res, line, offenders, j, lenJ,
            failures = 0,
            len = results.length,
            tap = [],
            util = YSLOW.util,
            decodeURI = util.decodeURIComponent;

        // tap version
        tap.push('TAP version 13');

        // test plan
        tap.push('1..' + len);

        for (i = 0; i < len; i += 1) {
            res = results[i];
            line = res.ok || res.score < 0 ? 'ok' : 'not ok';
            failures += (res.ok || res.score < 0) ? 0 : 1;
            line += ' ' + (i + 1) + ' ' + res.grade +
                ' (' + res.score + ') ' + res.name;
            if (res.description) {
                line += ': ' + res.description;
            }
            if (res.score < 0) {
                line += ' # SKIP score N/A';
            }
            tap.push(line);

            // message
            if (res.message) {
                tap.push('  ---');
                tap.push('  message: ' + res.message);
            }

            // offenders
            offenders = res.offenders;
            if (offenders) {
                lenJ = offenders.length;
                if (lenJ > 0) {
                    if (!res.message) {
                        tap.push('  ---');
                    }
                    tap.push('  offenders:');
                    for (j = 0; j < lenJ; j += 1) {
                        tap.push('    - "' +
                            decodeURI(offenders[j]) + '"');
                    }
                }
            }

            if (res.message || lenJ > 0) {
                tap.push('  ...');
            }
        }

        return {
          failures: failures,
          content: tap.join('\n')
        };
    },

    /**
     * Format test results as JUnit XML for CI
     * @see: http://www.junit.org/
     * @param {Array} tests the arrays containing the test results from testResults.
     * @return {Object}:
     *    failures: {Number} total test failed,
     *    content: {String} the results as JUnit XML text
     */
    formatAsJUnit: function (results) {
        var i, res, line, offenders, j, lenJ,
            len = results.length,
            skipped = 0,
            failures = 0,
            junit = [],
            cases = [],
            util = YSLOW.util,
            decodeURI = util.decodeURIComponent,
            safeXML = util.safeXML,

            safeAttr = function (str) {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            };

        for (i = 0; i < len; i += 1) {
            res = results[i];
            line = '    <testcase name="' + safeAttr(res.name +
                (res.description ? ': ' + res.description : '')) + '"';
            line += ' status="' + res.grade +
                ' (' + res.score + ')';
            if (res.ok) {
                cases.push(line + '"/>');
            } else {
                cases.push(line + '">');

                // skipped
                if (res.score < 0) {
                    skipped += 1;
                    cases.push('      <skipped>score N/A</skipped>');
                } else {
                  failures += 1;
                }

                line = '      <failure';
                if (res.message) {
                    line += ' message="' + safeAttr(res.message) + '"';
                }

                // offenders
                offenders = res.offenders;
                if (offenders) {
                    cases.push(line + '>');
                    lenJ = offenders.length;
                    for (j = 0; j < lenJ; j += 1) {
                        cases.push('        ' + safeXML(decodeURI(offenders[j])));
                    }
                    cases.push('      </failure>');
                } else {
                    cases.push(line + '/>');
                }

                cases.push('    </testcase>');
            }
        }

        // xml
        junit.push('<?xml version="1.0" encoding="UTF-8" ?>');

        // open test suites wrapper
        junit.push('<testsuites>');

        // open test suite w/ summary
        line = '  <testsuite name="YSlow" tests="' + len + '"';
        if (failures) {
            line += ' failures="' + failures + '"';
        }
        if (skipped) {
            line += ' skipped="' + skipped + '"';
        }
        line += '>';
        junit.push(line);

        // concat test cases
        junit = junit.concat(cases);

        // close test suite
        junit.push('  </testsuite>');

        // close test suites wrapper
        junit.push('</testsuites>');

        return {
            failures: failures,
            content: junit.join('\n')
        };
    },

    /**
     *  Try to find a spaceid in the HTML document source.
     * @param {YSLOW.ComponentSet} cset Component set.
     * @return spaceID string
     * @type string
     */
    getPageSpaceid: function (cset) {
        var sHtml, aDelims, aTerminators, i, sDelim, i1, i2, spaceid,
            reDigits = /^\d+$/,
            aComponents = cset.getComponentsByType('doc');

        if (aComponents[0] && typeof aComponents[0].body === 'string' && aComponents[0].body.length > 0) {
            sHtml = aComponents[0].body; // assume the first "doc" is the original HTML doc
            aDelims = ["%2fE%3d", "/S=", "SpaceID=", "?f=", " sid="]; // the beginning delimiter
            aTerminators = ["%2fR%3d", ":", " ", "&", " "]; // the terminating delimiter
            // Client-side counting (yzq) puts the spaceid in it as "/E=95810469/R=" but it's escaped!
            for (i = 0; i < aDelims.length; i += 1) {
                sDelim = aDelims[i];
                if (-1 !== sHtml.indexOf(sDelim)) { // if the delimiter is present
                    i1 = sHtml.indexOf(sDelim) + sDelim.length; // skip over the delimiter
                    i2 = sHtml.indexOf(aTerminators[i], i1); // find the terminator
                    if (-1 !== i2 && (i2 - i1) < 15) { // if the spaceid is < 15 digits
                        spaceid = sHtml.substring(i1, i2);
                        if (reDigits.test(spaceid)) { // make sure it's all digits
                            return spaceid;
                        }
                    }
                }
            }
        }

        return "";
    },

    /**
     *  Dynamically add a stylesheet to the document.
     * @param {String} url URL of the css file
     * @param {Document} doc Documnet object
     * @return CSS element
     * @type HTMLElement
     */
    loadCSS: function (url, doc) {
        var newCss;

        if (!doc) {
            YSLOW.util.dump('YSLOW.util.loadCSS: doc is not specified');
            return '';
        }

        newCss = doc.createElement("link");
        newCss.rel = "stylesheet";
        newCss.type = "text\/css";
        newCss.href = url;
        doc.body.appendChild(newCss);

        return newCss;
    },

    /**
     * Open a link.
     * @param {String} url URL of page to be opened.
     */
    openLink: function (url) {
        if (YSLOW.util.Preference.getPref("browser.link.open_external") === 3) {
            gBrowser.selectedTab = gBrowser.addTab(url);
        } else {
            window.open(url, " blank");
        }
    },

    /**
     * Sends a URL to smush.it for optimization
     * Example usage:
     * <code>YSLOW.util.smushIt('http://smush.it/css/skin/screenshot.png', function(resp){alert(resp.dest)});</code>
     * This code alerts the path to the optimized result image.
     *
     * @param {String} imgurl URL of the image to optimize
     * @param {Function} callback Callback function that accepts an object returned from smush.it
     */
    smushIt: function (imgurl, callback) {
        var xhr,
            smushurl = this.getSmushUrl(),
            url = smushurl + '/ws.php?img=' + encodeURIComponent(imgurl),
            req = YSLOW.util.getXHR();

        req.open('GET', url, true);
        req.onreadystatechange = function (e) {
            xhr = (e ? e.target : req);
            if (xhr.readyState === 4) {
                callback(JSON.parse(xhr.responseText));
            }
        };
        req.send(null);
    },

    /**
     * Get SmushIt server URL.
     * @return URL of SmushIt server.
     * @type String
     */
    getSmushUrl: function () {
        var g_default_smushit_url = 'http://www.smushit.com/ysmush.it';

        return YSLOW.util.Preference.getPref('smushItURL', g_default_smushit_url) + '/';
    },

    /**
     * Create new tab and return its document object
     * @return document object of the new tab content.
     * @type Document
     */
    getNewDoc: function () {
        var generatedPage = null,
            request = new XMLHttpRequest();

        getBrowser().selectedTab = getBrowser().addTab('about:blank');
        generatedPage = window;
        request.open("get", "about:blank", false);
        request.overrideMimeType('text/html');
        request.send(null);

        return generatedPage.content.document;
    },

    /**
     * Make absolute url.
     * @param url
     * @param base href
     * @return absolute url built with base href.
     */
    makeAbsoluteUrl: function (url, baseHref) {
        var hostIndex, path, lpath, protocol;

        if (typeof url === 'string' && baseHref) {
            hostIndex = baseHref.indexOf('://');
            protocol = baseHref.slice(0, 4);
            if (url.indexOf('://') < 0 && (protocol === 'http' ||
                    protocol === 'file')) {
                // This is a relative url
                if (url.slice(0, 1) === '/') {
                    // absolute path
                    path = baseHref.indexOf('/', hostIndex + 3);
                    if (path > -1) {
                        url = baseHref.slice(0, path) + url;
                    } else {
                        url = baseHref + url;
                    }
                } else {
                    // relative path
                    lpath = baseHref.lastIndexOf('/');
                    if (lpath > hostIndex + 3) {
                        url = baseHref.slice(0, lpath + 1) + url;
                    } else {
                        url = baseHref + '/' + url;
                    }
                }
            }
        }

        return url;
    },

    /**
     * Prevent event default action
     * @param {Object} event the event to prevent default action from
     */
    preventDefault: function (event) {
        if (typeof event.preventDefault === 'function') {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }
    },

    /**
     * String Trim
     * @param string s the string to remove trail and header spaces
     */
    trim: function (s) {
        try {
            return (s && s.trim) ? s.trim() : s.replace(/^\s+|\s+$/g, '');
        } catch (e) {
            return s;
        }
    },

    /**
     * Add Event Listener
     * @param HTMLElement el the element to add an event listener
     * @param string ev the event name to be added
     * @param function fn the function to be invoked by event listener
     */
    addEventListener: function (el, ev, fn) {
        var util = YSLOW.util;

        if (el.addEventListener) {
            util.addEventListener = function (el, ev, fn) {
                el.addEventListener(ev, fn, false);
            };
        } else if (el.attachEvent) {
            util.addEventListener = function (el, ev, fn) {
                el.attachEvent('on' + ev, fn);
            };
        } else {
            util.addEventListener = function (el, ev, fn) {
                el['on' + ev] = fn;
            };
        }
        util.addEventListener(el, ev, fn);
    },

    /**
     * Remove Event Listener
     * @param HTMLElement el the element to remove event listener from
     * @param string ev the event name to be removed
     * @param function fn the function invoked by the removed listener
     */
    removeEventListener: function (el, ev, fn) {
        var util = YSLOW.util;

        if (el.removeEventListener) {
            util.removeEventListener = function (el, ev, fn) {
                el.removeEventListener(ev, fn, false);
            };
        } else if (el.detachEvent) {
            util.removeEventListener = function (el, ev, fn) {
                el.detachEvent('on' + ev, fn);
            };
        } else {
            util.removeEventListener = function (el, ev, fn) {
                delete el['on' + ev];
            };
        }
        util.removeEventListener(el, ev, fn);
    },

    /**
     * Normalize currentTarget
     * @param evt the event received
     * @return HTMLElement the normilized currentTarget
     */
    getCurrentTarget: function (evt) {
        return evt.currentTarget || evt.srcElement;
    },

    /**
     * Normalize target
     * @param evt the event received
     * @return HTMLElement the normilized target
     */
    getTarget: function (evt) {
        return evt.target || evt.srcElement;
    },

    /**
     * Get all inline elements (style and script) from a document
     * @param doc (optional) the document to get all inline elements
     * @param head (optional) the head node to get inline elements, ignores doc
     * @param body (optional) the body node to get inline elements, ignores doc
     * @return object with scripts and styles arrays with the following info:
     * containerNode: either head or body
     * body: the innerHTML content
     */
    getInlineTags: function (doc, head, body) {
        var styles, scripts,

            loop = function (node, tag, contentNode) {
                var i, len, els, el,
                    objs = [];

                if (!node) {
                    return objs;
                }

                els = node.getElementsByTagName(tag);
                for (i = 0, len = els.length; i < len; i += 1) {
                    el = els[i];
                    if (!el.src) {
                        objs.push({
                            contentNode: contentNode,
                            body: el.innerHTML
                        });
                    }
                }

                return objs;
            };

        head = head || (doc && doc.getElementsByTagName('head')[0]);
        body = body || (doc && doc.getElementsByTagName('body')[0]);

        styles = loop(head, 'style', 'head');
        styles = styles.concat(loop(body, 'style', 'body'));
        scripts = loop(head, 'script', 'head');
        scripts = scripts.concat(loop(body, 'script', 'body'));

        return {
            styles: styles,
            scripts: scripts
        };
    },

    /**
     * Count all DOM elements from a node
     * @param node the root node to count all DOM elements from
     * @return number of DOM elements found on given node
     */
    countDOMElements: function (node) {
        return (node && node.getElementsByTagName('*').length) || 0;
    },

    /**
     * Get cookies from a document
     * @param doc the document to get the cookies from
     * @return the cookies string
     */
    getDocCookies: function (doc) {
        return (doc && doc.cookie) || '';
    },

    /**
     * identifies injected elements (js, css, iframe, flash, image)
     * @param doc the document to create/manipulate dom elements 
     * @param comps the component set components
     * @param body the root (raw) document body (html)
     * @return the same components with injected info
     */
    setInjected: function (doc, comps, body) {
        var i, len, els, el, src, comp, found, div,
            nodes = {};

        if (!body) {
            return comps;
        }

        // har uses a temp div already, reuse it
        if (typeof doc.createElement === 'function') {
            div = doc.createElement('div');
            div.innerHTML = body;
        } else {
            div = doc;
        }

        // js
        els = div.getElementsByTagName('script');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            src = el.src || el.getAttribute('src');
            if (src) {
                nodes[src] = {
                    defer: el.defer || el.getAttribute('defer'),
                    async: el.async || el.getAttribute('async')
                };
            }
        }

        // css
        els = div.getElementsByTagName('link');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            src = el.href || el.getAttribute('href');
            if (src && (el.rel === 'stylesheet' || el.type === 'text/css')) {
                nodes[src] = 1;
            }
        }

        // iframe
        els = div.getElementsByTagName('iframe');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            src = el.src || el.getAttribute('src');
            if (src) {
                nodes[src] = 1;
            }
        }

        // flash
        els = div.getElementsByTagName('embed');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            src = el.src || el.getAttribute('src');
            if (src) {
                nodes[src] = 1;
            }
        }
        els = div.getElementsByTagName('param');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            src = el.value || el.getAttribute('value');
            if (src) {
                nodes[src] = 1;
            }
        }

        // image
        els = div.getElementsByTagName('img');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            src = el.src || el.getAttribute('src');
            if (src) {
                nodes[src] = 1;
            }
        }

        // loop components and look it up on nodes
        // if not found then component was injected
        // for js, set defer and async attributes
        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (comp.type === 'js' || comp.type === 'css' ||
                    comp.type === 'flash' || comp.type === 'flash' ||
                    comp.type === 'image') {
                found = nodes[comp.url];
                comp.injected = !found;
                if (comp.type === 'js' && found) {
                    comp.defer = found.defer;
                    comp.async = found.async;
                }
            }
        }

        return comps;
    },

    // default setTimeout, FF overrides this with proprietary Mozilla timer
    setTimer: function (callback, delay) {
        setTimeout(callback, delay);
    }
};

/**
 * Class that implements the observer pattern.
 *
 * Oversimplified usage:
 * <pre>
 * // subscribe
 * YSLOW.util.event.addListener('martiansAttack', alert);
 * // fire the event
 * YSLOW.util.event.fire('martiansAttack', 'panic!');
 * </pre>
 *
 * More real life usage
 * <pre>
 * var myobj = {
 *   default_action: alert,
 *   panic: function(event) {
 *     this.default_action.call(null, event.message);
 *   }
 * };
 *
 * // subscribe
 * YSLOW.util.event.addListener('martiansAttack', myobj.panic, myobj);
 * // somewhere someone fires the event
 * YSLOW.util.event.fire('martiansAttack', {date: new Date(), message: 'panic!'});
 *
 *
 * @namespace YSLOW.util
 * @class event
 * @static
 */
YSLOW.util.event = {
    /**
     * Hash of subscribers where the key is the event name and the value is an array of callbacks-type objects
     * The callback objects have keys "callback" which is the function to be called and "that" which is the value
     * to be assigned to the "this" object when the function is called
     */
    subscribers: {},

    /**
     * Adds a new listener
     *
     * @param {String} event_name Name of the event
     * @param {Function} callback A function to be called when the event fires
     * @param {Object} that Object to be assigned to the "this" value of the callback function
     */
    addListener: function (eventName, callback, that) {
        var subs = this.subscribers,
            subscribers = subs[eventName];

        if (!subscribers) {
            subscribers = subs[eventName] = [];
        }
        subscribers.push({
            callback: callback,
            that: that
        });
    },

    /**
     * Removes a listener
     *
     * @param {String} event_name Name of the event
     * @param {Function} callback The callback function that was added as a listener
     * @return {Boolean} TRUE is the listener was removed successfully, FALSE otherwise (for example in cases when the listener doesn't exist)
     */
    removeListener: function (eventName, callback) {
        var i,
            subscribers = this.subscribers[eventName],
            len = (subscribers && subscribers.length) || 0;

        for (i = 0; i < len; i += 1) {
            if (subscribers[i].callback === callback) {
                subscribers.splice(i, 1);
                return true;
            }
        }

        return false;
    },

    /**
     * Fires the event
     *
     * @param {String} event_nama Name of the event
     * @param {Object} event_object Any object that will be passed to the subscribers, can be anything
     */
    fire: function (event_name, event_object) {
        var i, listener;

        if (typeof this.subscribers[event_name] === 'undefined') {
            return false;
        }

        for (i = 0; i < this.subscribers[event_name].length; i += 1) {
            listener = this.subscribers[event_name][i];
            try {
                listener.callback.call(listener.that, event_object);
            } catch (e) {}
        }

        return true;
    }

};

/**
 * Class that implements setting and unsetting preferences
 *
 * @namespace YSLOW.util
 * @class Preference
 * @static
 *
 */
YSLOW.util.Preference = {

    /**
     * @private
     */
    nativePref: null,

    /**
     * Register native preference mechanism.
     */
    registerNative: function (o) {
        this.nativePref = o;
    },

    /**
     * Get Preference with default value.  If the preference does not exist,
     * return the passed default_value.
     * @param {String} name name of preference
     * @return preference value or default value.
     */
    getPref: function (name, default_value) {
        if (this.nativePref) {
            return this.nativePref.getPref(name, default_value);
        }
        return default_value;
    },

    /**
     * Get child preference list in branch.
     * @param {String} branch_name
     * @return array of preference values.
     * @type Array
     */
    getPrefList: function (branch_name, default_value) {
        if (this.nativePref) {
            return this.nativePref.getPrefList(branch_name, default_value);
        }
        return default_value;
    },

    /**
     * Set Preference with passed value.
     * @param {String} name name of preference
     * @param {value type} value value to be used to set the preference
     */
    setPref: function (name, value) {
        if (this.nativePref) {
            this.nativePref.setPref(name, value);
        }
    },

    /**
     * Delete Preference with passed name.
     * @param {String} name name of preference to be deleted
     */
    deletePref: function (name) {
        if (this.nativePref) {
            this.nativePref.deletePref(name);
        }
    }
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */

/**
 * A class that collects all in-product text.
 * @namespace YSLOW
 * @class doc
 * @static
 */
YSLOW.doc = {

    tools_desc: undefined,

    view_names: {},

    splash: {},

    rules: {},

    tools: {},

    components_legend: {},

    addRuleInfo: function (id, name, info) {
        if (typeof id === "string" && typeof name === "string" && typeof info === "string") {
            this.rules[id] = {
                'name': name,
                'info': info
            };
        }
    },

    addToolInfo: function (id, name, info) {
        if (typeof id === "string" && typeof name === "string" && typeof info === "string") {
            this.tools[id] = {
                'name': name,
                'info': info
            };
        }
    }

};

//
// Rules text
//
YSLOW.doc.addRuleInfo('ynumreq', 'Make fewer HTTP requests', 'Decreasing the number of components on a page reduces the number of HTTP requests required to render the page, resulting in faster page loads.  Some ways to reduce the number of components include:  combine files, combine multiple scripts into one script, combine multiple CSS files into one style sheet, and use CSS Sprites and image maps.');

YSLOW.doc.addRuleInfo('ycdn', 'Use a Content Delivery Network (CDN)', 'User proximity to web servers impacts response times.  Deploying content across multiple geographically dispersed servers helps users perceive that pages are loading faster.');

YSLOW.doc.addRuleInfo('yexpires', 'Add Expires headers', 'Web pages are becoming increasingly complex with more scripts, style sheets, images, and Flash on them.  A first-time visit to a page may require several HTTP requests to load all the components.  By using Expires headers these components become cacheable, which avoids unnecessary HTTP requests on subsequent page views.  Expires headers are most often associated with images, but they can and should be used on all page components including scripts, style sheets, and Flash.');

YSLOW.doc.addRuleInfo('ycompress', 'Compress components with gzip', 'Compression reduces response times by reducing the size of the HTTP response.  Gzip is the most popular and effective compression method currently available and generally reduces the response size by about 70%.  Approximately 90% of today\'s Internet traffic travels through browsers that claim to support gzip.');

YSLOW.doc.addRuleInfo('ycsstop', 'Put CSS at top', 'Moving style sheets to the document HEAD element helps pages appear to load quicker since this allows pages to render progressively.');

YSLOW.doc.addRuleInfo('yjsbottom', 'Put JavaScript at bottom', 'JavaScript scripts block parallel downloads; that is, when a script is downloading, the browser will not start any other downloads.  To help the page load faster, move scripts to the bottom of the page if they are deferrable.');

YSLOW.doc.addRuleInfo('yexpressions', 'Avoid CSS expressions', 'CSS expressions (supported in IE beginning with Version 5) are a powerful, and dangerous, way to dynamically set CSS properties.  These expressions are evaluated frequently:  when the page is rendered and resized, when the page is scrolled, and even when the user moves the mouse over the page.  These frequent evaluations degrade the user experience.');

YSLOW.doc.addRuleInfo('yexternal', 'Make JavaScript and CSS external', 'Using external JavaScript and CSS files generally produces faster pages because the files are cached by the browser.  JavaScript and CSS that are inlined in HTML documents get downloaded each time the HTML document is requested.  This reduces the number of HTTP requests but increases the HTML document size.  On the other hand, if the JavaScript and CSS are in external files cached by the browser, the HTML document size is reduced without increasing the number of HTTP requests.');

YSLOW.doc.addRuleInfo('ydns', 'Reduce DNS lookups', 'The Domain Name System (DNS) maps hostnames to IP addresses, just like phonebooks map people\'s names to their phone numbers.  When you type URL www.yahoo.com into the browser, the browser contacts a DNS resolver that returns the server\'s IP address.  DNS has a cost; typically it takes 20 to 120 milliseconds for it to look up the IP address for a hostname.  The browser cannot download anything from the host until the lookup completes.');

YSLOW.doc.addRuleInfo('yminify', 'Minify JavaScript and CSS', 'Minification removes unnecessary characters from a file to reduce its size, thereby improving load times.  When a file is minified, comments and unneeded white space characters (space, newline, and tab) are removed.  This improves response time since the size of the download files is reduced.');

YSLOW.doc.addRuleInfo('yredirects', 'Avoid URL redirects', 'URL redirects are made using HTTP status codes 301 and 302.  They tell the browser to go to another location.  Inserting a redirect between the user and the final HTML document delays everything on the page since nothing on the page can be rendered and no components can be downloaded until the HTML document arrives.');

YSLOW.doc.addRuleInfo('ydupes', 'Remove duplicate JavaScript and CSS', 'Duplicate JavaScript and CSS files hurt performance by creating unnecessary HTTP requests (IE only) and wasted JavaScript execution (IE and Firefox).  In IE, if an external script is included twice and is not cacheable, it generates two HTTP requests during page loading.  Even if the script is cacheable, extra HTTP requests occur when the user reloads the page.  In both IE and Firefox, duplicate JavaScript scripts cause wasted time evaluating the same scripts more than once.  This redundant script execution happens regardless of whether the script is cacheable.');

YSLOW.doc.addRuleInfo('yetags', 'Configure entity tags (ETags)', 'Entity tags (ETags) are a mechanism web servers and the browser use to determine whether a component in the browser\'s cache matches one on the origin server.  Since ETags are typically constructed using attributes that make them unique to a specific server hosting a site, the tags will not match when a browser gets the original component from one server and later tries to validate that component on a different server.');

YSLOW.doc.addRuleInfo('yxhr', 'Make AJAX cacheable', 'One of AJAX\'s benefits is it provides instantaneous feedback to the user because it requests information asynchronously from the backend web server.  However, using AJAX does not guarantee the user will not wait for the asynchronous JavaScript and XML responses to return.  Optimizing AJAX responses is important to improve performance, and making the responses cacheable is the best way to optimize them.');

YSLOW.doc.addRuleInfo('yxhrmethod', 'Use GET for AJAX requests', 'When using the XMLHttpRequest object, the browser implements POST in two steps:  (1) send the headers, and (2) send the data.  It is better to use GET instead of POST since GET sends the headers and the data together (unless there are many cookies).  IE\'s maximum URL length is 2 KB, so if you are sending more than this amount of data you may not be able to use GET.');

YSLOW.doc.addRuleInfo('ymindom', 'Reduce the number of DOM elements', 'A complex page means more bytes to download, and it also means slower DOM access in JavaScript.  Reduce the number of DOM elements on the page to improve performance.');

YSLOW.doc.addRuleInfo('yno404', 'Avoid HTTP 404 (Not Found) error', 'Making an HTTP request and receiving a 404 (Not Found) error is expensive and degrades the user experience.  Some sites have helpful 404 messages (for example, "Did you mean ...?"), which may assist the user, but server resources are still wasted.');

YSLOW.doc.addRuleInfo('ymincookie', 'Reduce cookie size', 'HTTP cookies are used for authentication, personalization, and other purposes.  Cookie information is exchanged in the HTTP headers between web servers and the browser, so keeping the cookie size small minimizes the impact on response time.');

YSLOW.doc.addRuleInfo('ycookiefree', 'Use cookie-free domains', 'When the browser requests a static image and sends cookies with the request, the server ignores the cookies.  These cookies are unnecessary network traffic.  To workaround this problem, make sure that static components are requested with cookie-free requests by creating a subdomain and hosting them there.');

YSLOW.doc.addRuleInfo('ynofilter', 'Avoid AlphaImageLoader filter', 'The IE-proprietary AlphaImageLoader filter attempts to fix a problem with semi-transparent true color PNG files in IE versions less than Version 7.  However, this filter blocks rendering and freezes the browser while the image is being downloaded.  Additionally, it increases memory consumption.  The problem is further multiplied because it is applied per element, not per image.');

YSLOW.doc.addRuleInfo('yimgnoscale', 'Do not scale images in HTML', 'Web page designers sometimes set image dimensions by using the width and height attributes of the HTML image element.  Avoid doing this since it can result in images being larger than needed.  For example, if your page requires image myimg.jpg which has dimensions 240x720 but displays it with dimensions 120x360 using the width and height attributes, then the browser will download an image that is larger than necessary.');

YSLOW.doc.addRuleInfo('yfavicon', 'Make favicon small and cacheable', 'A favicon is an icon associated with a web page; this icon resides in the favicon.ico file in the server\'s root.  Since the browser requests this file, it needs to be present; if it is missing, the browser returns a 404 error (see "Avoid HTTP 404 (Not Found) error" above).  Since favicon.ico resides in the server\'s root, each time the browser requests this file, the cookies for the server\'s root are sent.  Making the favicon small and reducing the cookie size for the server\'s root cookies improves performance for retrieving the favicon.  Making favicon.ico cacheable avoids frequent requests for it.');

YSLOW.doc.addRuleInfo('yemptysrc', 'Avoid empty src or href', 'You may expect a browser to do nothing when it encounters an empty image src.  However, it is not the case in most browsers. IE makes a request to the directory in which the page is located; Safari, Chrome, Firefox 3 and earlier make a request to the actual page itself. This behavior could possibly corrupt user data, waste server computing cycles generating a page that will never be viewed, and in the worst case, cripple your servers by sending a large amount of unexpected traffic.');

//
// Tools text
//
YSLOW.doc.tools_desc = 'Click on the tool name to launch the tool.';

YSLOW.doc.addToolInfo('jslint', 'JSLint', 'Run JSLint on all JavaScript code in this document');

YSLOW.doc.addToolInfo('alljs', 'All JS', 'Show all JavaScript code in this document');

YSLOW.doc.addToolInfo('jsbeautified', 'All JS Beautified', 'Show all JavaScript code in this document in an easy to read format');

YSLOW.doc.addToolInfo('jsminified', 'All JS Minified', 'Show all JavaScript code in this document in a minified (no comments or white space) format');

YSLOW.doc.addToolInfo('allcss', 'All CSS', 'Show all CSS code in this document');

YSLOW.doc.addToolInfo('cssmin', 'YUI CSS Compressor', 'Show all CSS code in the document in a minified format');

YSLOW.doc.addToolInfo('smushItAll', 'All Smush.it&trade;', 'Run Smush.it&trade; on all image components in this document');

YSLOW.doc.addToolInfo('printableview', 'Printable View', 'Show a printable view of grades, component lists, and statistics');

//
// Splash text
//
YSLOW.doc.splash.title = 'Grade your web pages with YSlow';

YSLOW.doc.splash.content = {
    'header': 'YSlow gives you:',
    'text': '<ul><li>Grade based on the performance of the page (you can define your own ruleset)</li><li>Summary of the page components</li><li>Chart with statistics</li><li>Tools for analyzing performance, including Smush.it&trade; and JSLint</li></ul>'
};

YSLOW.doc.splash.more_info = 'Learn more about YSlow and the Yahoo! Developer Network';

//
// Rule Settings
//
YSLOW.doc.rulesettings_desc = 'Choose which ruleset (YSlow V2, Classic V1, or Small Site/Blog) best fits your specific needs.  Or create a new set and click Save as... to save it.';

//
// Components table legend
//
YSLOW.doc.components_legend.beacon = 'type column indicates the component is loaded after window onload event';
YSLOW.doc.components_legend.after_onload = 'denotes 1x1 pixels image that may be image beacon';

//
// View names
//
YSLOW.doc.view_names = {
    grade: 'Grade',
    components: 'Components',
    stats: 'Statistics',
    tools: 'Tools',
    rulesetedit: 'Rule Settings'
};

// copyright text
YSLOW.doc.copyright = 'Copyright &copy; ' + (new Date()).getFullYear() + ' Yahoo! Inc. All rights reserved.';
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, onevar: true, undef: true, nomen: true, regexp: true, continue: true, plusplus: true, bitwise: true, newcap: true, type: true, unparam: true, maxerr: 50, indent: 4*/

/**
 *
 * Example of a rule object:
 *
 * <pre>
 * YSLOW.registerRule({
 *
 *     id: 'myrule',
 *     name: 'Never say never',
 *     url: 'http://never.never/never.html',
 *     info: 'Short description of the rule',
 *
 *     config: {
 *          when: 'ever'
 *     },
 *
 *     lint: function(doc, components, config) {
 *         return {
 *             score: 100,
 *             message: "Did you just say never?",
 *             components: []
 *         };
 *     }
 * });
  </pre>
 */

//
// 3/2/2009
// Centralize all name and info of builtin tool to YSLOW.doc class.
//
YSLOW.registerRule({
    id: 'ynumreq',
    //name: 'Make fewer HTTP requests',
    url: 'http://developer.yahoo.com/performance/rules.html#num_http',
    category: ['content'],

    config: {
        max_js: 3,
        // the number of scripts allowed before we start penalizing
        points_js: 4,
        // penalty points for each script over the maximum
        max_css: 2,
        // number of external stylesheets allowed before we start penalizing
        points_css: 4,
        // penalty points for each external stylesheet over the maximum
        max_cssimages: 6,
        // // number of background images allowed before we start penalizing
        points_cssimages: 3 // penalty points for each bg image over the maximum
    },

    lint: function (doc, cset, config) {
        var js = cset.getComponentsByType('js').length - config.max_js,
            css = cset.getComponentsByType('css').length - config.max_css,
            cssimg = cset.getComponentsByType('cssimage').length - config.max_cssimages,
            score = 100,
            messages = [];

        if (js > 0) {
            score -= js * config.points_js;
            messages[messages.length] = 'This page has ' + YSLOW.util.plural('%num% external Javascript script%s%', (js + config.max_js)) + '.  Try combining them into one.';
        }
        if (css > 0) {
            score -= css * config.points_css;
            messages[messages.length] = 'This page has ' + YSLOW.util.plural('%num% external stylesheet%s%', (css + config.max_css)) + '.  Try combining them into one.';
        }
        if (cssimg > 0) {
            score -= cssimg * config.points_cssimages;
            messages[messages.length] = 'This page has ' + YSLOW.util.plural('%num% external background image%s%', (cssimg + config.max_cssimages)) + '.  Try combining them with CSS sprites.';
        }

        return {
            score: score,
            message: messages.join('\n'),
            components: []
        };
    }
});

YSLOW.registerRule({
    id: 'ycdn',
    //name: 'Use a CDN',
    url: 'http://developer.yahoo.com/performance/rules.html#cdn',
    category: ['server'],

    config: {
        // how many points to take out for each component not on CDN
        points: 10,
        // array of regexps that match CDN-ed components
        patterns: [
            '^([^\\.]*)\\.([^\\.]*)\\.yimg\\.com/[^/]*\\.yimg\\.com/.*$',
            '^([^\\.]*)\\.([^\\.]*)\\.yimg\\.com/[^/]*\\.yahoo\\.com/.*$',
            '^sec.yimg.com/',
            '^a248.e.akamai.net',
            '^[dehlps].yimg.com',
            '^(ads|cn|mail|maps|s1).yimg.com',
            '^[\\d\\w\\.]+.yimg.com',
            '^a.l.yimg.com',
            '^us.(js|a)2.yimg.com',
            '^yui.yahooapis.com',
            '^adz.kr.yahoo.com',
            '^img.yahoo.co.kr',
            '^img.(shopping|news|srch).yahoo.co.kr',
            '^pimg.kr.yahoo.com',
            '^kr.img.n2o.yahoo.com',
            '^s3.amazonaws.com',
            '^(www.)?google-analytics.com',
            '.cloudfront.net', //Amazon CloudFront
            '.ak.fbcdn.net', //Facebook images ebeded
            'platform.twitter.com', //Twitter widget - Always via a CDN
            'cdn.api.twitter.com', //Twitter API calls, served via Akamai
            'apis.google.com', //Google's API Hosting
            '.akamaihd.net', //Akamai - Facebook uses this for SSL assets
            '.rackcdn.com' //Generic RackSpace CloudFiles CDN
        ],
        // array of regexps that will be treated as exception.
        exceptions: [
            '^chart.yahoo.com',
            '^(a1|f3|f5|f3c|f5c).yahoofs.com', // Images for 360 and YMDB
            '^us.(a1c|f3).yahoofs.com' // Personals photos
        ],
        // array of regexps that match CDN Server HTTP headers
        servers: [
            'cloudflare-nginx' // not using ^ and $ due to invisible
        ],
        // which component types should be on CDN
        types: ['js', 'css', 'image', 'cssimage', 'flash', 'favicon']
    },

    lint: function (doc, cset, config) {
        var i, j, url, re, match, hostname,
            offender, len, lenJ, comp, patterns, headers,
            score = 100,
            offenders = [],
            exceptions = [],
            message = '',
            util = YSLOW.util,
            plural = util.plural,
            kbSize = util.kbSize,
            getHostname = util.getHostname,
            docDomain = getHostname(cset.doc_comp.url),
            comps = cset.getComponentsByType(config.types),
            userCdns = util.Preference.getPref('cdnHostnames', ''),
            hasPref = util.Preference.nativePref;

        // array of custom cdns
        if (userCdns) {
            userCdns = userCdns.split(',');
        }

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            url = comp.url;
            hostname = getHostname(url);
            headers = comp.headers;

            // ignore /favicon.ico
            if (comp.type === 'favicon' && hostname === docDomain) {
                continue;
            }

            // experimental custom header, use lowercase
            match = headers['x-cdn'] || headers['x-amz-cf-id'] || headers['x-edge-location'] || headers['powered-by-chinacache'];
            if (match) {
                continue;
            }

            // by hostname
            patterns = config.patterns;
            for (j = 0, lenJ = patterns.length; j < lenJ; j += 1) {
                re = new RegExp(patterns[j]);
                if (re.test(hostname)) {
                    match = 1;
                    break;
                }
            }
            // by custom hostnames
            if (userCdns) {
                for (j = 0, lenJ = userCdns.length; j < lenJ; j += 1) {
                    re = new RegExp(util.trim(userCdns[j]));
                    if (re.test(hostname)) {
                        match = 1;
                        break;
                    }
                }
            }

            if (!match) {
                // by Server HTTP header
                patterns = config.servers;
                for (j = 0, lenJ = patterns.length; j < lenJ; j += 1) {
                    re = new RegExp(patterns[j]);
                    if (re.test(headers.server)) {
                        match = 1;
                        break;
                    }
                }
                if (!match) {
                    // by exception
                    patterns = config.exceptions;
                    for (j = 0, lenJ = patterns.length; j < lenJ; j += 1) {
                        re = new RegExp(patterns[j]);
                        if (re.test(hostname)) {
                            exceptions.push(comp);
                            match = 1;
                            break;
                        }
                    }
                    if (!match) {
                        offenders.push(comp);
                    }
                }
            }
        }

        score -= offenders.length * config.points;

        offenders.concat(exceptions);

        if (offenders.length > 0) {
            message = plural('There %are% %num% static component%s% ' +
                'that %are% not on CDN. ', offenders.length);
        }
        if (exceptions.length > 0) {
            message += plural('There %are% %num% component%s% that %are% not ' +
                'on CDN, but %are% exceptions:', exceptions.length) + '<ul>';
            for (i = 0, len = offenders.length; i < len; i += 1) {
                message += '<li>' + util.prettyAnchor(exceptions[i].url,
                    exceptions[i].url, null, true, 120, null,
                    exceptions[i].type) + '</li>';
            }
            message += '</ul>';
        }

        if (userCdns) {
            message += '<p>Using these CDN hostnames from your preferences: ' +
                userCdns + '</p>';
        } else {
            message += '<p>You can specify CDN hostnames in your ' +
                'preferences. See <a href="javascript:document.ysview.' +
                'openLink(\'http://yslow.org/faq/#faq_cdn\')">YSlow FAQ</a> ' +
                'for details.</p>';
        }

        // list unique domains only to avoid long list of offenders
        if (offenders.length) {
            offenders = util.summaryByDomain(offenders,
                ['size', 'size_compressed'], true);
            for (i = 0, len = offenders.length; i < len; i += 1) {
                offender = offenders[i];
                offenders[i] = offender.domain + ': ' +
                    plural('%num% component%s%, ', offender.count) +
                    kbSize(offender.sum_size) + (
                        offender.sum_size_compressed > 0 ? ' (' +
                        kbSize(offender.sum_size_compressed) + ' GZip)' : ''
                    ) + (hasPref ? (
                    ' <button onclick="javascript:document.ysview.addCDN(\'' +
                    offender.domain + '\')">Add as CDN</button>') : '');
            }
        }

        return {
            score: score,
            message: message,
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yexpires',
    //name: 'Add an Expires header',
    url: 'http://developer.yahoo.com/performance/rules.html#expires',
    category: ['server'],

    config: {
        // how many points to take for each component without Expires header
        points: 11,
        // 2 days = 2 * 24 * 60 * 60 seconds, how far is far enough
        howfar: 172800,
        // component types to be inspected for expires headers
        types: ['css', 'js', 'image', 'cssimage', 'flash', 'favicon']
    },

    lint: function (doc, cset, config) {
        var ts, i, expiration, score, len,
            // far-ness in milliseconds
            far = parseInt(config.howfar, 10) * 1000,
            offenders = [],
            comps = cset.getComponentsByType(config.types);

        for (i = 0, len = comps.length; i < len; i += 1) {
            expiration = comps[i].expires;
            if (typeof expiration === 'object' &&
                    typeof expiration.getTime === 'function') {
                // looks like a Date object
                ts = new Date().getTime();
                if (expiration.getTime() > ts + far) {
                    continue;
                }
            }
            offenders.push(comps[i]);
        }

        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% static component%s%',
                offenders.length
            ) + ' without a far-future expiration date.' : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ycompress',
    //name: 'Compress components',
    url: 'http://developer.yahoo.com/performance/rules.html#gzip',
    category: ['server'],

    config: {
        // files below this size are exceptions of the gzip rule
        min_filesize: 500,
        // file types to inspect
        types: ['doc', 'iframe', 'xhr', 'js', 'css'],
        // points to take out for each non-compressed component
        points: 11
    },

    lint: function (doc, cset, config) {
        var i, len, score, comp,
            offenders = [],
            comps = cset.getComponentsByType(config.types);

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (comp.compressed || comp.size < 500) {
                continue;
            }
            offenders.push(comp);
        }

        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% plain text component%s%',
                offenders.length
            ) + ' that should be sent compressed' : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ycsstop',
    //name: 'Put CSS at the top',
    url: 'http://developer.yahoo.com/performance/rules.html#css_top',
    category: ['css'],

    config: {
        points: 10
    },

    lint: function (doc, cset, config) {
        var i, len, score, comp,
            comps = cset.getComponentsByType('css'),
            offenders = [];

        // expose all offenders
        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (comp.containerNode === 'body') {
                offenders.push(comp);
            }
        }

        score = 100;
        if (offenders.length > 0) {
            // start at 99 so each ding drops us a grade
            score -= 1 + offenders.length * parseInt(config.points, 10);
        }

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% stylesheet%s%',
                offenders.length
            ) + ' found in the body of the document' : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yjsbottom',
    //name: 'Put Javascript at the bottom',
    url: 'http://developer.yahoo.com/performance/rules.html#js_bottom',
    category: ['javascript'],
    config: {
        points: 5 // how many points for each script in the <head>
    },

    lint: function (doc, cset, config) {
        var i, len, comp, score,
            offenders = [],
            comps = cset.getComponentsByType('js');

        // offenders are components not injected (tag found on document payload)
        // except if they have either defer or async attributes
        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (comp.containerNode === 'head' &&
                    !comp.injected && (!comp.defer || !comp.async)) {
                offenders.push(comp);
            }
        }

        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ?
                YSLOW.util.plural(
                    'There %are% %num% JavaScript script%s%',
                    offenders.length
                ) + ' found in the head of the document' : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yexpressions',
    //name: 'Avoid CSS expressions',
    url: 'http://developer.yahoo.com/performance/rules.html#css_expressions',
    category: ['css'],

    config: {
        points: 2 // how many points for each expression
    },

    lint: function (doc, cset, config) {
        var i, len, expr_count, comp,
            instyles = (cset.inline && cset.inline.styles) || [],
            comps = cset.getComponentsByType('css'),
            offenders = [],
            score = 100,
            total = 0;

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (typeof comp.expr_count === 'undefined') {
                expr_count = YSLOW.util.countExpressions(comp.body);
                comp.expr_count = expr_count;
            } else {
                expr_count = comp.expr_count;
            }

            // offence
            if (expr_count > 0) {
                comp.yexpressions = YSLOW.util.plural(
                    '%num% expression%s%',
                    expr_count
                );
                total += expr_count;
                offenders.push(comp);
            }
        }

        for (i = 0, len = instyles.length; i < len; i += 1) {
            expr_count = YSLOW.util.countExpressions(instyles[i].body);
            if (expr_count > 0) {
                offenders.push('inline &lt;style&gt; tag #' + (i + 1) + ' (' +
                    YSLOW.util.plural(
                        '%num% expression%s%',
                        expr_count
                    ) + ')'
                    );
                total += expr_count;
            }
        }

        if (total > 0) {
            score = 90 - total * config.points;
        }

        return {
            score: score,
            message: total > 0 ? 'There is a total of ' +
                YSLOW.util.plural('%num% expression%s%', total) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yexternal',
    //name: 'Make JS and CSS external',
    url: 'http://developer.yahoo.com/performance/rules.html#external',
    category: ['javascript', 'css'],
    config: {},

    lint: function (doc, cset, config) {
        var message,
            inline = cset.inline,
            styles = (inline && inline.styles) || [],
            scripts = (inline && inline.scripts) || [],
            offenders = [];

        if (styles.length) {
            message = YSLOW.util.plural(
                'There is a total of %num% inline css',
                styles.length
            );
            offenders.push(message);
        }

        if (scripts.length) {
            message = YSLOW.util.plural(
                'There is a total of %num% inline script%s%',
                scripts.length
            );
            offenders.push(message);
        }

        return {
            score: 'n/a',
            message: 'Only consider this if your property is a common user home page.',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ydns',
    //name: 'Reduce DNS lookups',
    url: 'http://developer.yahoo.com/performance/rules.html#dns_lookups',
    category: ['content'],

    config: {
        // maximum allowed domains, excluding ports and IP addresses
        max_domains: 4,
        // the cost of each additional domain over the maximum
        points: 5
    },

    lint: function (doc, cset, config) {
        var i, len, domain,
            util = YSLOW.util,
            kbSize = util.kbSize,
            plural = util.plural,
            score = 100,
            domains = util.summaryByDomain(cset.components,
                ['size', 'size_compressed'], true);

        if (domains.length > config.max_domains) {
            score -= (domains.length - config.max_domains) * config.points;
        }

        // list unique domains only to avoid long list of offenders
        if (domains.length) {
            for (i = 0, len = domains.length; i < len; i += 1) {
                domain = domains[i];
                domains[i] = domain.domain + ': ' +
                    plural('%num% component%s%, ', domain.count) +
                    kbSize(domain.sum_size) + (
                        domain.sum_size_compressed > 0 ? ' (' +
                        kbSize(domain.sum_size_compressed) + ' GZip)' : ''
                    );
            }
        }

        return {
            score: score,
            message: (domains.length > config.max_domains) ? plural(
                'The components are split over more than %num% domain%s%',
                config.max_domains
            ) : '',
            components: domains
        };
    }
});

YSLOW.registerRule({
    id: 'yminify',
    //name: 'Minify JS and CSS',
    url: 'http://developer.yahoo.com/performance/rules.html#minify',
    category: ['javascript', 'css'],

    config: {
        // penalty for each unminified component
        points: 10,
        // types of components to inspect for minification
        types: ['js', 'css']
    },

    lint: function (doc, cset, config) {
        var i, len, score, minified, comp,
            inline = cset.inline,
            styles = (inline && inline.styles) || [],
            scripts = (inline && inline.scripts) || [],
            comps = cset.getComponentsByType(config.types),
            offenders = [];

        // check all peeled components
        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            // set/get minified flag
            if (typeof comp.minified === 'undefined') {
                minified = YSLOW.util.isMinified(comp.body);
                comp.minified = minified;
            } else {
                minified = comp.minified;
            }

            if (!minified) {
                offenders.push(comp);
            }
        }

        // check inline scripts/styles/whatever
        for (i = 0, len = styles.length; i < len; i += 1) {
            if (!YSLOW.util.isMinified(styles[i].body)) {
                offenders.push('inline &lt;style&gt; tag #' + (i + 1));
            }
        }
        for (i = 0, len = scripts.length; i < len; i += 1) {
            if (!YSLOW.util.isMinified(scripts[i].body)) {
                offenders.push('inline &lt;script&gt; tag #' + (i + 1));
            }
        }

        score = 100 - offenders.length * config.points;

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural('There %are% %num% component%s% that can be minified', offenders.length) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yredirects',
    //name: 'Avoid redirects',
    url: 'http://developer.yahoo.com/performance/rules.html#redirects',
    category: ['content'],

    config: {
        points: 10 // the penalty for each redirect
    },

    lint: function (doc, cset, config) {
        var i, len, comp, score,
            offenders = [],
            briefUrl = YSLOW.util.briefUrl,
            comps = cset.getComponentsByType('redirect');

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            offenders.push(briefUrl(comp.url, 80) + ' redirects to ' +
                briefUrl(comp.headers.location, 60));
        }
        score = 100 - comps.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (comps.length > 0) ? YSLOW.util.plural(
                'There %are% %num% redirect%s%',
                comps.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ydupes',
    //name: 'Remove duplicate JS and CSS',
    url: 'http://developer.yahoo.com/performance/rules.html#js_dupes',
    category: ['javascript', 'css'],

    config: {
        // penalty for each duplicate
        points: 5,
        // component types to check for duplicates
        types: ['js', 'css']
    },

    lint: function (doc, cset, config) {
        var i, url, score, len,
            hash = {},
            offenders = [],
            comps = cset.getComponentsByType(config.types);

        for (i = 0, len = comps.length; i < len; i += 1) {
            url = comps[i].url;
            if (typeof hash[url] === 'undefined') {
                hash[url] = {
                    count: 1,
                    compindex: i
                };
            } else {
                hash[url].count += 1;
            }
        }

        for (i in hash) {
            if (hash.hasOwnProperty(i) && hash[i].count > 1) {
                offenders.push(comps[hash[i].compindex]);
            }
        }

        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% duplicate component%s%',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yetags',
    //name: 'Configure ETags',
    url: 'http://developer.yahoo.com/performance/rules.html#etags',
    category: ['server'],

    config: {
        // points to take out for each misconfigured etag
        points: 11,
        // types to inspect for etags
        types: ['flash', 'js', 'css', 'cssimage', 'image', 'favicon']
    },

    lint: function (doc, cset, config) {

        var i, len, score, comp, etag,
            offenders = [],
            comps = cset.getComponentsByType(config.types);

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            etag = comp.headers && comp.headers.etag;
            if (etag && !YSLOW.util.isETagGood(etag)) {
                offenders.push(comp);
            }
        }

        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% component%s% with misconfigured ETags',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yxhr',
    //name: 'Make Ajax cacheable',
    url: 'http://developer.yahoo.com/performance/rules.html#cacheajax',
    category: ['content'],

    config: {
        // points to take out for each non-cached XHR
        points: 5,
        // at least an hour in cache.
        min_cache_time: 3600
    },

    lint: function (doc, cset, config) {
        var i, expiration, ts, score, cache_control,
            // far-ness in milliseconds
            min = parseInt(config.min_cache_time, 10) * 1000,
            offenders = [],
            comps = cset.getComponentsByType('xhr');

        for (i = 0; i < comps.length; i += 1) {
            // check for cache-control: no-cache and cache-control: no-store
            cache_control = comps[i].headers['cache-control'];
            if (cache_control) {
                if (cache_control.indexOf('no-cache') !== -1 ||
                        cache_control.indexOf('no-store') !== -1) {
                    continue;
                }
            }

            expiration = comps[i].expires;
            if (typeof expiration === 'object' &&
                    typeof expiration.getTime === 'function') {
                // looks like a Date object
                ts = new Date().getTime();
                if (expiration.getTime() > ts + min) {
                    continue;
                }
                // expires less than min_cache_time => BAD.
            }
            offenders.push(comps[i]);
        }

        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% XHR component%s% that %are% not cacheable',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yxhrmethod',
    //name: 'Use GET for AJAX Requests',
    url: 'http://developer.yahoo.com/performance/rules.html#ajax_get',
    category: ['server'],

    config: {
        // points to take out for each ajax request
        // that uses http method other than GET.
        points: 5
    },

    lint: function (doc, cset, config) {
        var i, score,
            offenders = [],
            comps = cset.getComponentsByType('xhr');

        for (i = 0; i < comps.length; i += 1) {
            if (typeof comps[i].method === 'string') {
                if (comps[i].method !== 'GET' && comps[i].method !== 'unknown') {
                    offenders.push(comps[i]);
                }
            }
        }
        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% XHR component%s% that %do% not use GET HTTP method',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ymindom',
    //name: 'Reduce the Number of DOM Elements',
    url: 'http://developer.yahoo.com/performance/rules.html#min_dom',
    category: ['content'],

    config: {
        // the range
        range: 250,
        // points to take out for each range of DOM that's more than max.
        points: 10,
        // number of DOM elements are considered too many if exceeds maxdom.
        maxdom: 900
    },

    lint: function (doc, cset, config) {
        var numdom = cset.domElementsCount,
            score = 100;

        if (numdom > config.maxdom) {
            score = 99 - Math.ceil((numdom - parseInt(config.maxdom, 10)) /
                parseInt(config.range, 10)) * parseInt(config.points, 10);
        }

        return {
            score: score,
            message: (numdom > config.maxdom) ? YSLOW.util.plural(
                'There %are% %num% DOM element%s% on the page',
                numdom
            ) : '',
            components: []
        };
    }
});

YSLOW.registerRule({
    id: 'yno404',
    //name: 'No 404s',
    url: 'http://developer.yahoo.com/performance/rules.html#no404',
    category: ['content'],

    config: {
        // points to take out for each 404 response.
        points: 5,
        // component types to be inspected for expires headers
        types: ['css', 'js', 'image', 'cssimage', 'flash', 'xhr', 'favicon']
    },

    lint: function (doc, cset, config) {
        var i, len, comp, score,
            offenders = [],
            comps = cset.getComponentsByType(config.types);

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (parseInt(comp.status, 10) === 404) {
                offenders.push(comp);
            }
        }
        score = 100 - offenders.length * parseInt(config.points, 10);
        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% request%s% that %are% 404 Not Found',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ymincookie',
    //name: 'Reduce Cookie Size',
    url: 'http://developer.yahoo.com/performance/rules.html#cookie_size',
    category: ['cookie'],

    config: {
        // points to take out if cookie size is more than config.max_cookie_size
        points: 10,
        // 1000 bytes.
        max_cookie_size: 1000
    },

    lint: function (doc, cset, config) {
        var n,
            cookies = cset.cookies,
            cookieSize = (cookies && cookies.length) || 0,
            message = '',
            score = 100;

        if (cookieSize > config.max_cookie_size) {
            n = Math.floor(cookieSize / config.max_cookie_size);
            score -= 1 + n * parseInt(config.points, 10);
            message = YSLOW.util.plural(
                'There %are% %num% byte%s% of cookies on this page',
                cookieSize
            );
        }

        return {
            score: score,
            message: message,
            components: []
        };
    }
});

YSLOW.registerRule({
    id: 'ycookiefree',
    //name: 'Use Cookie-free Domains',
    url: 'http://developer.yahoo.com/performance/rules.html#cookie_free',
    category: ['cookie'],

    config: {
        // points to take out for each component that send cookie.
        points: 5,
        // which component types should be cookie-free
        types: ['js', 'css', 'image', 'cssimage', 'flash', 'favicon']
    },

    lint: function (doc, cset, config) {
        var i, len, score, comp, cookie,
            offenders = [],
            getHostname = YSLOW.util.getHostname,
            docDomain = getHostname(cset.doc_comp.url),
            comps = cset.getComponentsByType(config.types);

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];

            // ignore /favicon.ico
            if (comp.type === 'favicon' &&
                    getHostname(comp.url) === docDomain) {
                continue;
            }

            cookie = comp.cookie;
            if (typeof cookie === 'string' && cookie.length) {
                offenders.push(comps[i]);
            }
        }
        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% component%s% that %are% not cookie-free',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'ynofilter',
    //name: 'Avoid Filters',
    url: 'http://developer.yahoo.com/performance/rules.html#no_filters',
    category: ['css'],

    config: {
        // points to take out for each AlphaImageLoader filter not using _filter hack.
        points: 5,
        // points to take out for each AlphaImageLoader filter using _filter hack.
        halfpoints: 2
    },

    lint: function (doc, cset, config) {
        var i, len, score, comp, type, count, filter_count,
            instyles = (cset.inline && cset.inline.styles) || [],
            comps = cset.getComponentsByType('css'),
            offenders = [],
            filter_total = 0,
            hack_filter_total = 0;

        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];
            if (typeof comp.filter_count === 'undefined') {
                filter_count = YSLOW.util.countAlphaImageLoaderFilter(comp.body);
                comp.filter_count = filter_count;
            } else {
                filter_count = comp.filter_count;
            }

            // offence
            count = 0;
            for (type in filter_count) {
                if (filter_count.hasOwnProperty(type)) {
                    if (type === 'hackFilter') {
                        hack_filter_total += filter_count[type];
                        count += filter_count[type];
                    } else {
                        filter_total += filter_count[type];
                        count += filter_count[type];
                    }
                }
            }
            if (count > 0) {
                comps[i].yfilters = YSLOW.util.plural('%num% filter%s%', count);
                offenders.push(comps[i]);
            }
        }

        for (i = 0, len = instyles.length; i < len; i += 1) {
            filter_count = YSLOW.util.countAlphaImageLoaderFilter(instyles[i].body);
            count = 0;
            for (type in filter_count) {
                if (filter_count.hasOwnProperty(type)) {
                    if (type === 'hackFilter') {
                        hack_filter_total += filter_count[type];
                        count += filter_count[type];
                    } else {
                        filter_total += filter_count[type];
                        count += filter_count[type];
                    }
                }
            }
            if (count > 0) {
                offenders.push('inline &lt;style&gt; tag #' + (i + 1) + ' (' +
                    YSLOW.util.plural('%num% filter%s%', count) + ')');
            }
        }

        score = 100 - (filter_total * config.points + hack_filter_total *
            config.halfpoints);

        return {
            score: score,
            message: (filter_total + hack_filter_total) > 0 ?
                'There is a total of ' + YSLOW.util.plural(
                    '%num% filter%s%',
                    filter_total + hack_filter_total
                ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yimgnoscale',
    //name: 'Don\'t Scale Images in HTML',
    url: 'http://developer.yahoo.com/performance/rules.html#no_scale',
    category: ['images'],

    config: {
        points: 5 // points to take out for each image that scaled.
    },

    lint: function (doc, cset, config) {
        var i, prop, score,
            offenders = [],
            comps = cset.getComponentsByType('image');

        for (i = 0; i < comps.length; i += 1) {
            prop = comps[i].object_prop;
            if (prop && typeof prop.width !== 'undefined' &&
                    typeof prop.height !== 'undefined' &&
                    typeof prop.actual_width !== 'undefined' &&
                    typeof prop.actual_height !== 'undefined') {
                if (prop.width < prop.actual_width ||
                        prop.height < prop.actual_height) {
                    // allow scale up
                    offenders.push(comps[i]);
                }
            }
        }
        score = 100 - offenders.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (offenders.length > 0) ? YSLOW.util.plural(
                'There %are% %num% image%s% that %are% scaled down',
                offenders.length
            ) : '',
            components: offenders
        };
    }
});

YSLOW.registerRule({
    id: 'yfavicon',
    //name: 'Make favicon Small and Cacheable',
    url: 'http://developer.yahoo.com/performance/rules.html#favicon',
    category: ['images'],

    config: {
        // points to take out for each offend.
        points: 5,
        // deduct point if size of favicon is more than this number.
        size: 2000,
        // at least this amount of seconds in cache to consider cacheable.
        min_cache_time: 3600
    },

    lint: function (doc, cset, config) {
        var ts, expiration, comp, score, cacheable,
            messages = [],
            min = parseInt(config.min_cache_time, 10) * 1000,
            comps = cset.getComponentsByType('favicon');

        if (comps.length) {
            comp = comps[0];

            // check if favicon was found
            if (parseInt(comp.status, 10) === 404) {
                messages.push('Favicon was not found');
            }

            // check size
            if (comp.size > config.size) {
                messages.push(YSLOW.util.plural(
                    'Favicon is more than %num% bytes',
                    config.size
                ));
            }
            // check cacheability
            expiration = comp.expires;

            if (typeof expiration === 'object' &&
                    typeof expiration.getTime === 'function') {
                // looks like a Date object
                ts = new Date().getTime();
                cacheable = expiration.getTime() >= ts + min;
            }
            if (!cacheable) {
                messages.push('Favicon is not cacheable');
            }
        }
        score = 100 - messages.length * parseInt(config.points, 10);

        return {
            score: score,
            message: (messages.length > 0) ? messages.join('\n') : '',
            components: []
        };
    }

});

YSLOW.registerRule({
    id: 'yemptysrc',
    // name: 'Avoid empty src or href',
    url: 'http://developer.yahoo.com/performance/rules.html#emptysrc',
    category: ['server'],
    config: {
        points: 100
    },
    lint: function (doc, cset, config) {
        var type, score, count,
            emptyUrl = cset.empty_url,
            offenders = [],
            messages = [],
            msg = '',
            points = parseInt(config.points, 10);

        score = 100;
        if (emptyUrl) {
            for (type in emptyUrl) {
                if (emptyUrl.hasOwnProperty(type)) {
                    count = emptyUrl[type];
                    score -= count * points;
                    messages.push(count + ' ' + type);
                }
            }
            msg = messages.join(', ') + YSLOW.util.plural(
                ' component%s% with empty link were found.',
                messages.length
            );
        }

        return {
            score: score,
            message: msg,
            components: offenders
        };
    }
});

/**
 * YSLOW.registerRuleset({
 *
 *     id: 'myalgo',
 *     name: 'The best algo',
 *     rules: {
 *         myrule: {
 *             ever: 2,
 *         }
 *     }
 *
 * });
 */

YSLOW.registerRuleset({ // yahoo default with default configuration
    id: 'ydefault',
    name: 'YSlow(V2)',
    rules: {
        ynumreq: {},
        //  1
        ycdn: {},
        //  2
        yemptysrc: {},
        yexpires: {},
        //  3
        ycompress: {},
        //  4
        ycsstop: {},
        //  5
        yjsbottom: {},
        //  6
        yexpressions: {},
        //  7
        yexternal: {},
        //  8
        ydns: {},
        //  9
        yminify: {},
        // 10
        yredirects: {},
        // 11
        ydupes: {},
        // 12
        yetags: {},
        // 13
        yxhr: {},
        // 14
        yxhrmethod: {},
        // 16
        ymindom: {},
        // 19
        yno404: {},
        // 22
        ymincookie: {},
        // 23
        ycookiefree: {},
        // 24
        ynofilter: {},
        // 28
        yimgnoscale: {},
        // 31
        yfavicon: {} // 32
    },
    weights: {
        ynumreq: 8,
        ycdn: 6,
        yemptysrc: 30,
        yexpires: 10,
        ycompress: 8,
        ycsstop: 4,
        yjsbottom: 4,
        yexpressions: 3,
        yexternal: 4,
        ydns: 3,
        yminify: 4,
        yredirects: 4,
        ydupes: 4,
        yetags: 2,
        yxhr: 4,
        yxhrmethod: 3,
        ymindom: 3,
        yno404: 4,
        ymincookie: 3,
        ycookiefree: 3,
        ynofilter: 4,
        yimgnoscale: 3,
        yfavicon: 2
    }

});

YSLOW.registerRuleset({

    id: 'yslow1',
    name: 'Classic(V1)',
    rules: {
        ynumreq: {},
        //  1
        ycdn: {},
        //  2
        yexpires: {},
        //  3
        ycompress: {},
        //  4
        ycsstop: {},
        //  5
        yjsbottom: {},
        //  6
        yexpressions: {},
        //  7
        yexternal: {},
        //  8
        ydns: {},
        //  9
        yminify: { // 10
            types: ['js'],
            check_inline: false
        },
        yredirects: {},
        // 11
        ydupes: { // 12
            types: ['js']
        },
        yetags: {} // 13
    },
    weights: {
        ynumreq: 8,
        ycdn: 6,
        yexpires: 10,
        ycompress: 8,
        ycsstop: 4,
        yjsbottom: 4,
        yexpressions: 3,
        yexternal: 4,
        ydns: 3,
        yminify: 4,
        yredirects: 4,
        ydupes: 4,
        yetags: 2
    }

});


YSLOW.registerRuleset({
    id: 'yblog',
    name: 'Small Site or Blog',
    rules: {
        ynumreq: {},
        //  1
        yemptysrc: {},
        ycompress: {},
        //  4
        ycsstop: {},
        //  5
        yjsbottom: {},
        //  6
        yexpressions: {},
        //  7
        ydns: {},
        //  9
        yminify: {},
        // 10
        yredirects: {},
        // 11
        ydupes: {},
        // 12
        ymindom: {},
        // 19
        yno404: {},
        // 22
        ynofilter: {},
        // 28
        yimgnoscale: {},
        // 31
        yfavicon: {} // 32
    },
    weights: {
        ynumreq: 8,
        yemptysrc: 30,
        ycompress: 8,
        ycsstop: 4,
        yjsbottom: 4,
        yexpressions: 3,
        ydns: 3,
        yminify: 4,
        yredirects: 4,
        ydupes: 4,
        ymindom: 3,
        yno404: 4,
        ynofilter: 4,
        yimgnoscale: 3,
        yfavicon: 2
    }
});
/**
 * Custom ruleset must be placed in this directory as rulseset_name.js
 *
 * Here is a very simplified snippet for registering a new rules and ruleset:
 *
 * YSLOW.registerRule({
 *     id: 'foo-rule1',
 *     name: 'Sample Test #1',
 *     info: 'How simple is that?',
 * 
 *     lint: function (doc, cset, config) {
 *         return {
 *             score: 90,
 *              message: 'close but no cigar',
 *            components: ['element1']
 *         };
 *     }
 * });
 * 
 * YSLOW.registerRuleset({
 *     id: 'foo',
 *     name: 'Foobar Ruleset',
 *     rules: {
 *         'foo-rule1': {}
 *     },
 *     weights: {
 *         'foo-rule1': 3
 *     }
 * });
 *
 */
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */

/**
 * ResultSet class
 * @constructor
 * @param {Array} results array of lint result
 * @param {Number} overall_score overall score
 * @param {YSLOW.Ruleset} ruleset_applied Ruleset used to generate the result.
 */
YSLOW.ResultSet = function (results, overall_score, ruleset_applied) {
    this.ruleset_applied = ruleset_applied;
    this.overall_score = overall_score;
    this.results = results;
};

YSLOW.ResultSet.prototype = {

    /**
     * Get results array from ResultSet.
     * @return results array
     * @type Array
     */
    getResults: function () {
        return this.results;
    },

    /**
     * Get ruleset applied from ResultSet
     * @return ruleset applied
     * @type YSLOW.Ruleset
     */
    getRulesetApplied: function () {
        return this.ruleset_applied;
    },

    /**
     * Get overall score from ResultSet
     * @return overall score
     * @type Number
     */
    getOverallScore: function () {
        return this.overall_score;
    }

};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW, window*/
/*jslint white: true, browser: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */

/**
 * YSLOW.view manages the YSlow UI.
 * @class
 * @constructor
 * @param {Object} panel This panel object can be YSLOW.firefox.Panel or FirebugPanel.
 * @param {YSLOW.context} yscontext YSlow context to associated with this view.
 */
YSLOW.view = function (panel, yscontext) {
    var toolbar, elem, dialogHtml, modaldlg, copyright;

    this.panel_doc = panel.document;
    this.buttonViews = {};
    this.curButtonId = "";
    this.panelNode = panel.panelNode;

    this.loadCSS(this.panel_doc);

    toolbar = this.panel_doc.createElement("div");
    toolbar.id = "toolbarDiv";
    toolbar.innerHTML = this.getToolbarSource();
    toolbar.style.display = "block";

    elem = this.panel_doc.createElement("div");
    elem.style.display = "block";

    // create modal dialog.
    dialogHtml = '<div class="dialog-box"><h1><div class="dialog-text">text</div></h1><div class="dialog-more-text"></div><div class="buttons"><input class="dialog-left-button" type="button" value="Ok" onclick="javascript:document.ysview.closeDialog(document)"><input class="dialog-right-button" type="button" value="Cancel" onclick="javascript:document.ysview.closeDialog(document)"></div></div><div class="dialog-mask"></div>';

    modaldlg = this.panel_doc.createElement('div');
    modaldlg.id = "dialogDiv";
    modaldlg.innerHTML = dialogHtml;
    modaldlg.style.display = "none";
    // save modaldlg in view, make look up easier.
    this.modaldlg = modaldlg;

    this.tooltip = new YSLOW.view.Tooltip(this.panel_doc, panel.panelNode);

    copyright = this.panel_doc.createElement('div');
    copyright.id = "copyrightDiv";
    copyright.innerHTML = YSLOW.doc.copyright;
    this.copyright = copyright;

    if (panel.panelNode) {
        panel.panelNode.id = "yslowDiv";
        panel.panelNode.appendChild(modaldlg);
        panel.panelNode.appendChild(toolbar);
        panel.panelNode.appendChild(elem);
        panel.panelNode.appendChild(copyright);
    }
    this.viewNode = elem;
    this.viewNode.id = "viewDiv";
    this.viewNode.className = "yui-skin-sam";

    this.yscontext = yscontext;

    YSLOW.util.addEventListener(this.panelNode, 'click', function (e) {
        var help, helplink, x, y, parent;
        var doc = FBL.getContentView(panel.document);
        var toolbar = doc.ysview.getElementByTagNameAndId(panel.panelNode, "div", "toolbarDiv");

        // In order to support YSlow running on mutli-tab,
        // we need to look up helpDiv using panelNode.
        // panel_doc.getElementById('helpDiv') will always find
        // helpDiv of YSlow running on the first browser tab.
        if (toolbar) {
            helplink = doc.ysview.getElementByTagNameAndId(toolbar, "li", "helpLink");
            if (helplink) {
                x = helplink.offsetLeft;
                y = helplink.offsetTop;
                parent = helplink.offsetParent;
                while (parent) {
                    x += parent.offsetLeft;
                    y += parent.offsetTop;
                    parent = parent.offsetParent;
                }
                if (e.clientX >= x && e.clientY >= y && e.clientX < x + helplink.offsetWidth && e.clientY < y + helplink.offsetHeight) { /* clicking on help link, do nothing */
                    return;
                }
            }
            help = doc.ysview.getElementByTagNameAndId(toolbar, "div", "helpDiv");
        }
        if (help && help.style.visibility === "visible") {
            help.style.visibility = "hidden";
        }
    });

    YSLOW.util.addEventListener(this.panelNode, 'scroll', function (e) {
        var doc = FBL.getContentView(panel.document);
        var overlay = doc.ysview.modaldlg;

        if (overlay && overlay.style.display === "block") {
            overlay.style.top = panel.panelNode.scrollTop + 'px';
            overlay.style.left = panel.panelNode.scrollLeft + 'px';
        }
    });

    YSLOW.util.addEventListener(this.panelNode, 'mouseover', function (e) {
        var rule;

        if (e.target && typeof e.target === "object") {
            if (e.target.nodeName === "LABEL" && e.target.className === "rules") {
                if (e.target.firstChild && e.target.firstChild.nodeName === "INPUT" && e.target.firstChild.type === "checkbox") {
                    rule = YSLOW.controller.getRule(e.target.firstChild.value);
                    var doc = FBL.getContentView(panel.document);
                    doc.ysview.tooltip.show('<b>' + rule.name + '</b><br><br>' + rule.info, e.target);
                }
            }
        }
    });

    YSLOW.util.addEventListener(this.panelNode, 'mouseout', function (e) {
        var doc = FBL.getContentView(panel.document);
        doc.ysview.tooltip.hide();
    });

    YSLOW.util.addEventListener(this.panel_doc.defaultView ||
        this.panel_doc.parentWindow, 'resize', function (e) {
        var doc = FBL.getContentView(panel.document);
        var overlay = doc.ysview.modaldlg;

        if (overlay && overlay.style.display === "block") {
            overlay.style.display = "none";
        }
    });

};

YSLOW.view.prototype = {

    /**
     * Update the document object store in View object.
     * @param {Document} doc New Document object to be store in View.
     */
    setDocument: function (doc) {
        this.panel_doc = doc;
    },

    /**
     * Platform independent implementation (optional)
     */
    loadCSS: function () {},

    /**
     * @private
     */
    addButtonView: function (sButtonId, sHtml) {
        var btnView = this.getButtonView(sButtonId);

        if (!btnView) {
            btnView = this.panel_doc.createElement("div");
            btnView.style.display = "none";
            this.viewNode.appendChild(btnView);
            this.buttonViews[sButtonId] = btnView;
        }

        btnView.innerHTML = sHtml;
        this.showButtonView(sButtonId);
    },

    /**
     * Clear all (changeable) views
     */
    clearAllButtonView: function () {
        var views = this.buttonViews,
            node = this.viewNode,

            remove = function (v) {
                if (views.hasOwnProperty(v)) {
                    node.removeChild(views[v]);
                    delete views[v];
                }
            };

        remove('ysPerfButton');
        remove('ysCompsButton');
        remove('ysStatsButton');
    },

    /**
     * @private
     */
    showButtonView: function (sButtonId) {
        var sId,
            btnView = this.getButtonView(sButtonId);

        if (!btnView) {
            YSLOW.util.dump("ERROR: YSLOW.view.showButtonView: Couldn't find ButtonView '" + sButtonId + "'.");
            return;
        }

        // Hide all the other button views.
        for (sId in this.buttonViews) {
            if (this.buttonViews.hasOwnProperty(sId) && sId !== sButtonId) {
                this.buttonViews[sId].style.display = "none";
            }
        }

        // special handling for copyright text in grade view
        if (sButtonId === "ysPerfButton") {
            // hide the main copyright text
            if (this.copyright) {
                this.copyright.style.display = "none";
            }
        } else if (this.curButtonId === "ysPerfButton") {
            // show the main copyright text
            if (this.copyright) {
                this.copyright.style.display = "block";
            }
        }

        btnView.style.display = "block";
        this.curButtonId = sButtonId;
    },

    /**
     * @private
     */
    getButtonView: function (sButtonId) {
        return (this.buttonViews.hasOwnProperty(sButtonId) ? this.buttonViews[sButtonId] : undefined);
    },

    /**
     * @private
     */
    setButtonView: function (sButtonId, sHtml) {
        var btnView = this.getButtonView(sButtonId);

        if (!btnView) {
            YSLOW.util.dump("ERROR: YSLOW.view.setButtonView: Couldn't find ButtonView '" + sButtonId + "'.");
            return;
        }

        btnView.innerHTML = sHtml;
        this.showButtonView(sButtonId);
    },

    /**
     * Show landing page.
     */
    setSplashView: function (hideAutoRun, showAntiIframe, hideToolsInfo /*TODO: remove once tools are working*/) {
        var sHtml,
            title = 'Grade your web pages with YSlow',
            header = 'YSlow gives you:',
            text = '<li>Grade based on the performance (you can define your own rules)</li><li>Summary of the Components in the page</li><li>Chart with statistics</li><li>Tools including Smush.It and JSLint</li>',
            more_info_text = 'Learn more about YSlow and YDN';

        if (YSLOW.doc.splash) {
            if (YSLOW.doc.splash.title) {
                title = YSLOW.doc.splash.title;
            }
            if (YSLOW.doc.splash.content) {
                if (YSLOW.doc.splash.content.header) {
                    header = YSLOW.doc.splash.content.header;
                }
                if (YSLOW.doc.splash.content.text) {
                    text = YSLOW.doc.splash.content.text;
                }
            }
            if (YSLOW.doc.splash.more_info) {
                more_info_text = YSLOW.doc.splash.more_info;
            }
        }

        /* TODO: remove once tools are working */
        if (typeof hideToolsInfo !== 'undefined') {
            YSLOW.hideToolsInfo = hideToolsInfo;
        } else {
            hideToolsInfo = YSLOW.hideToolsInfo;
        }
        if (hideToolsInfo) {
            // nasty :-P
            text = text.replace(/<li>Tools[^<]+<\/li>/, '');
        }
        
        sHtml = '<div id="splashDiv">' + '<div id="splashDivCenter">' + '<b id="splashImg" width="250" height="150" alt="splash image" ></b>' + '<div id="left"><h2>' + title + '</h2>' + '<div id="content" class="padding50"><h3>' + header + '</h3><ul id="splashBullets">' + text + '</ul>';
        
        if (typeof hideAutoRun !== 'undefined') {
            YSLOW.hideAutoRun = hideAutoRun;
        } else {
            hideAutoRun = YSLOW.hideAutoRun;
        }
        if (!hideAutoRun) {
            sHtml += '<label><input type="checkbox" name="autorun" onclick="javascript:document.ysview.setAutorun(this.checked)" ';
            if (YSLOW.util.Preference.getPref("extensions.yslow.autorun", false)) {
                sHtml += 'checked';
            }
            sHtml += '> Autorun YSlow each time a web page is loaded</label>';
        }
        
        if (typeof showAntiIframe !== 'undefined') {
            YSLOW.showAntiIframe = showAntiIframe;
        } else {
            showAntiIframe = YSLOW.showAntiIframe;
        }
        if (showAntiIframe) {
            sHtml += '<label><input type="checkbox" onclick="javascript:document.ysview.setAntiIframe(this.checked)"> Check here if the current page prevents itself from being embedded/iframed. A simpler post onload detection will be used instead.</label>';
        }
        
        sHtml += '<div id="runtestDiv"><button id="runtest-btn" onclick="javascript:document.ysview.runTest()">Run Test</button></div></div><div class="footer"><div class="moreinfo">' + '<a href="javascript:document.ysview.openLink(\'https://yslow.org/\');"><b>&#187;</b>' + more_info_text + '</a></div></div></div></div></div>';

        this.addButtonView('panel_about', sHtml);
    },

    /**
     * Show progress bar.
     */
    genProgressView: function () {
        var sBody = '<div id="progressDiv"><div id="peel"><p>Finding components in the page:</p>' + '<div id="peelprogress"><div id="progbar"></div></div><div id="progtext"></div></div>' + '<div id="fetch"><p>Getting component information:</p>' + '<div id="fetchprogress"><div id="progbar2"></div></div><div id="progtext2">start...</div></div></div>';

        this.setButtonView('panel_about', sBody);
    },

    /**
     * Update progress bar with passed info.
     * @param {String} progress_type Type of progress info: either 'peel' or 'fetch'.
     * @param {Object} progress_info
     * <ul>For peel:
     * <li><code>current_step</code> - {Number} current phase of peeling</li>
     * <li><code>total_step</code> - {Number} total number peeling phases</li>
     * <li><code>message</code> - {String} Progress message</li>
     * </ul>
     * <ul>For fetch:
     * <li><code>current</code> - {Number} Number of components already downloaded </li>
     * <li><code>total</code> - {Number} Total number of componetns to be downloaded </li>
     * <li><code>last_component_url</code> - {String} URL of the last downloaded component.</li>
     * </ul>
     */
    updateProgressView: function (progress_type, progress_info) {
        var outerbar, progbar, progtext, percent, view, maxwidth, width, left,
            message = '';

        if (this.curButtonId === 'panel_about') {
            view = this.getButtonView(this.curButtonId);

            if (progress_type === 'peel') {
                outerbar = this.getElementByTagNameAndId(view, 'div', 'peelprogress');
                progbar = this.getElementByTagNameAndId(view, 'div', 'progbar');
                progtext = this.getElementByTagNameAndId(view, 'div', 'progtext');
                message = progress_info.message;
                percent = (progress_info.current_step * 100) / progress_info.total_step;
            } else if (progress_type === 'fetch') {
                outerbar = this.getElementByTagNameAndId(view, 'div', 'fetchprogress');
                progbar = this.getElementByTagNameAndId(view, 'div', 'progbar2');
                progtext = this.getElementByTagNameAndId(view, 'div', 'progtext2');
                message = progress_info.last_component_url;
                percent = (progress_info.current * 100) / progress_info.total;
            } else if (progress_type === 'message') {
                progtext = this.getElementByTagNameAndId(view, 'div', 'progtext2');
                if (progtext) {
                    progtext.innerHTML = progress_info;
                }

                return;
            } else {
                return;
            }
        }

        if (outerbar && progbar && progtext) {
            maxwidth = outerbar.clientWidth;

            if (percent < 0) {
                percent = 0;
            }
            if (percent > 100) {
                percent = 100;
            }

            percent = 100 - percent;
            width = (maxwidth * percent) / 100;
            if (width > maxwidth) {
                width = maxwidth;
            }
            left = maxwidth - parseInt(width, 10);
            progbar.style.width = parseInt(width, 10) + "px";
            progbar.style.left = parseInt(left, 10) + "px";

            progtext.innerHTML = message;
        }
    },

    /**
     * @private
     */
    updateStatusBar: function (doc) {
        var size, grade, result, info, url,
            yslow = YSLOW,
            util = yslow.util,
            view = yslow.view,
            pref = util.Preference,
            yscontext = this.yscontext;

        if (!yscontext.PAGE.statusbar) {
            // only set the bar once
            yscontext.PAGE.statusbar = true;

            // If some of the info isn't available, we have to run some code.
            if (!yscontext.PAGE.overallScore) {
                // run lint
                yslow.controller.lint(doc, yscontext);
            }
            if (!yscontext.PAGE.totalSize) {
                // collect stats
                yscontext.collectStats();
            }

            size = util.kbSize(yscontext.PAGE.totalSize);
            grade = util.prettyScore(yscontext.PAGE.overallScore);

            view.setStatusBar(grade, 'yslow_status_grade');
            view.setStatusBar(size, 'yslow_status_size');

            // Send a beacon.
            if (pref.getPref('optinBeacon', false)) {
                info = pref.getPref('beaconInfo', 'basic'),
                url = pref.getPref('beaconUrl',
                    'http://rtblab.pclick.yahoo.com/images/ysb.gif');
                result = util.getResults(yscontext, info);
                util.sendBeacon(result, info, url);
            }
        }
    },

    /**
     * @private
     */
    getRulesetListSource: function (rulesets) {
        var id, custom,
            sHtml = '',
            defaultRulesetId = YSLOW.controller.getDefaultRulesetId();

        for (id in rulesets) {
            if (rulesets[id]) {
                sHtml += '<option value="' + rulesets[id].id + '" ';
                if (!custom && rulesets[id].hasOwnProperty('custom') && rulesets[id].custom) {
                    custom = true;
                    sHtml += 'class="firstInGroup" ';
                }

                if (defaultRulesetId !== undefined && id === defaultRulesetId) {
                    sHtml += 'selected';
                }
                sHtml += '>' + rulesets[id].name + '</option>';
            }
        }
        return sHtml;
    },

    /**
     * Refresh the Ruleset Dropdown list.  This is usually called after a ruleset is created or deleted.
     */
    updateRulesetList: function () {
        var i, div, new_select,
            selects = this.panel_doc.getElementsByTagName('select'),
            rulesets = YSLOW.controller.getRegisteredRuleset(),
            sText = this.getRulesetListSource(rulesets),

            onchangeFunc = function (event) {
                var doc = FBL.getContentView(this.ownerDocument);
                doc.ysview.onChangeRuleset(event);
            };

        for (i = 0; i < selects.length; i += 1) {
            if (selects[i].id === "toolbar-rulesetList") {
                div = selects[i].parentNode;
                if (div && div.id === "toolbar-ruleset") {
                    new_select = this.panel_doc.createElement('select');
                    if (new_select) {
                        new_select.id = 'toolbar-rulesetList';
                        new_select.name = 'rulesets';
                        new_select.onchange = onchangeFunc;
                        new_select.innerHTML = sText;
                    }

                    div.replaceChild(new_select, selects[i]);
                }
            }
        }
    },

    /**
     * @private
     */
    getToolbarSource: function () {
        var view, rulesets,
            sHtml = '<div id="menu">',
            titles = {
                home: 'Home',
                grade: 'Grade',
                components: 'Components',
                stats: 'Statistics',
                tools: 'Tools'
            };

        if (YSLOW.doc && YSLOW.doc.view_names) {
            for (view in titles) {
                if (titles.hasOwnProperty(view) &&
                        YSLOW.doc.view_names[view]) {
                    titles[view] = YSLOW.doc.view_names[view];
                }
            }
        }

        rulesets = YSLOW.controller.getRegisteredRuleset();

        sHtml = '<div id="toolbar-ruleset" class="floatRight">Rulesets <select id="toolbar-rulesetList" name="rulesets" onchange="javascript:document.ysview.onChangeRuleset(event)">' + this.getRulesetListSource(rulesets) + '</select>';

        sHtml += '<button onclick="javascript:document.ysview.showRuleSettings()">Edit</button><ul id="tbActions"><li id="printLink" class="first"><a href="javascript:document.ysview.openPrintableDialog(document)"><b class="icon">&asymp;</b><em>Printable View</em></a></li><li id="helpLink"><a href="javascript:document.ysview.showHideHelp()"><b class="icon">?</b><em>Help &darr;</em></a></li></ul></div>';

        // help menu
        sHtml += '<div id="helpDiv" class="help" style="visibility: hidden">' + '<div><a href="javascript:document.ysview.openLink(\'http://yslow.org/user-guide/\')">YSlow Help</a></div>' + '<div><a href="javascript:document.ysview.openLink(\'http://yslow.org/faq/\')">YSlow FAQ</a></div>' + '<div class="new-section"><a href="javascript:document.ysview.openLink(\'http://yslow.org/blog/\')">YSlow Blog</a></div>' + '<div><a href="javascript:document.ysview.openLink(\'http://tech.groups.yahoo.com/group/exceptional-performance/\')">YSlow Community</a></div>' + '<div class="new-section"><a href="javascript:document.ysview.openLink(\'https://github.com/marcelduran/yslow/issues\')">YSlow Issues</a></div>' + '<div class="new-section"><div><a class="social yslow" href="javascript:document.ysview.openLink(\'http://yslow.org/\')">YSlow Home</a></div><div><a class="social facebook" href="javascript:document.ysview.openLink(\'http://www.facebook.com/getyslow\')">Like YSlow</a></div><div><a class="social twitter" href="javascript:document.ysview.openLink(\'http://twitter.com/yslow\')">Follow YSlow</a></div></div><div class="new-section" id="help-version">Version ' + YSLOW.version + '</div></div>';

        // toolbar nav menu
        sHtml += '<div id="nav-menu"><ul class="yui-nav" id="toolbarLinks">' +
            '<li class="first selected off" id="ysHomeButton"><a href="javascript:document.ysview.setSplashView()" onclick="javascript:document.ysview.onclickToolbarMenu(event)"><em>' + titles.home + '</em><span class="pipe"/></a></li>' +
            '<li id="ysPerfButton"><a href="javascript:document.ysview.showPerformance()" onclick="javascript:document.ysview.onclickToolbarMenu(event)"><em>' + titles.grade + '</em><span class="pipe"/></a></li>' +
            '<li id="ysCompsButton"><a href="javascript:document.ysview.showComponents()" onclick="javascript:document.ysview.onclickToolbarMenu(event)"><em>' + titles.components + '</em><span class="pipe"/></a></li>' +
            '<li id="ysStatsButton"><a href="javascript:document.ysview.showStats()" onclick="javascript:document.ysview.onclickToolbarMenu(event)"><em>' + titles.stats + '</em><span class="pipe"/></a></li>' +
            '<li id="ysToolButton"><a href="javascript:document.ysview.showTools()" onclick="javascript:document.ysview.onclickToolbarMenu(event)"><em>' + titles.tools + '</em></a></li></ul></div>';

        sHtml += '</div>';

        return sHtml;
    },

    /**
     * Show the passed view.  If nothing is passed, default view "Grade" will be shown.
     * Possible sView values are: "ysCompsButton", "ysStatsButton", "ysToolButton", "ysRuleEditButton" and "ysPerfButton".
     * If the page has not been peeled before this function is called, peeler will be run first and sView will not be displayed until
     * peeler is done.
     * @param {String} sView The view to be displayed.
     */
    show: function (sView) {
        var format = 'html',
            stext = "";

        sView = sView || this.yscontext.defaultview;

        if (this.yscontext.component_set === null) {
            // need to run peeler first.
            YSLOW.controller.run(window.top.content, this.yscontext, false);
            this.yscontext.defaultview = sView;
        } else {
            if (this.getButtonView(sView)) {
                // This view already exists, just toggle to it.
                this.showButtonView(sView);
            }
            else if ("ysCompsButton" === sView) {
                stext += this.yscontext.genComponents(format);
                this.addButtonView("ysCompsButton", stext);
            }
            else if ("ysStatsButton" === sView) {
                stext += this.yscontext.genStats(format);
                this.addButtonView("ysStatsButton", stext);
                YSLOW.renderer.plotComponents(this.getButtonView("ysStatsButton"), this.yscontext);
            }
            else if ("ysToolButton" === sView) {
                stext += this.yscontext.genToolsView(format);
                this.addButtonView("ysToolButton", stext);
            }
            else {
                // Default is Performance.
                stext += this.yscontext.genPerformance(format);
                this.addButtonView("ysPerfButton", stext);
            }

            this.panelNode.scrollTop = 0;
            this.panelNode.scrollLeft = 0;

            this.updateStatusBar(this.yscontext.document);

            // update toolbar selected tab.
            this.updateToolbarSelection();
        }
    },

    /**
     * @private
     */
    updateToolbarSelection: function () {
        var elem, ul_elem, child;

        switch (this.curButtonId) {
        case "ysCompsButton":
        case "ysPerfButton":
        case "ysStatsButton":
        case "ysToolButton":
            elem = this.getElementByTagNameAndId(this.panelNode, 'li', this.curButtonId);
            if (elem) {
                if (elem.className.indexOf("selected") !== -1) {
                    // no need to do anything.
                    return;
                } else {
                    elem.className += " selected";
                    if (elem.previousSibling) {
                        elem.previousSibling.className += " off";
                    }
                }
            }
            break;
        default:
            break;
        }

        ul_elem = this.getElementByTagNameAndId(this.panelNode, 'ul', 'toolbarLinks');
        child = ul_elem.firstChild;
        while (child) {
            if (child.id !== this.curButtonId && child.className.indexOf("selected") !== -1) {
                this.unselect(child);
                if (child.previousSibling) {
                    YSLOW.view.removeClassName(child.previousSibling, 'off');
                }
            }
            child = child.nextSibling;
        }
    },

    /**
     * Show Grade screen. Use YSLOW.view.show(). Called from UI.
     */
    showPerformance: function () {
        this.show('ysPerfButton');
    },

    /**
     * Show Stats screen. Use YSLOW.view.show(). Called from UI.
     */
    showStats: function () {
        this.show('ysStatsButton');
    },

    /**
     * Show Components screen. Use YSLOW.view.show(). Called from UI.
     */
    showComponents: function () {
        this.show('ysCompsButton');
    },

    /**
     * Show Tools screen. Use YSLOW.view.show(). Called from UI.
     */
    showTools: function () {
        this.show('ysToolButton');
    },

    /**
     * Show Rule Settings screen. Use YSLOW.view.show(). Called from UI.
     */
    showRuleSettings: function () {
        var stext = this.yscontext.genRulesetEditView('html');

        this.addButtonView("ysRuleEditButton", stext);

        this.panelNode.scrollTop = 0;
        this.panelNode.scrollLeft = 0;

        // update toolbar selected tab.
        this.updateToolbarSelection();
    },

    /**
     * Run YSlow. Called from UI.
     */
    runTest: function () {
        YSLOW.controller.run(window.top.content, this.yscontext, false);
    },

    /**
     * Set autorun preference. Called from UI.
     * @param {boolean} set Pass true to turn autorun on, false otherwise.
     */
    setAutorun: function (set) {
        YSLOW.util.Preference.setPref("extensions.yslow.autorun", set);
    },

    /**
     * Set antiiframe preference. Called from UI.
     * @param {boolean} set Pass true to use simple afterOnload verification, false otherwise.
     */
    setAntiIframe: function (set) {
        YSLOW.antiIframe = set;
    },

    /**
     * Add a custom CDN to custom CDN preference list
     * @param {string} the CDN to be added
     */
    addCDN: function (cdn) {
        var i, id,
            that = this,
            doc = document,
            ctx = that.yscontext,
            pref = YSLOW.util.Preference,
            cdns = pref.getPref('cdnHostnames', ''),
            panel = that.panel_doc,
            el = panel.getElementById('tab-label-list'),
            lis = el.getElementsByTagName('li'),
            len = lis.length;
        
        if (cdns) {
            cdns = cdns.replace(/\s+/g, '').split(',');
            cdns.push(cdn);
            cdns = cdns.join();
        } else {
            cdns = cdn;
        }
        pref.setPref('extensions.yslow.cdnHostnames', cdns);

        // get selected tab
        for (i = 0; i < len; i+= 1) {
            el = lis[i];
            if (el.className.indexOf('selected') > -1) {
                id = el.id;
                break;
            }
        }
        // re-run analysis
        YSLOW.controller.lint(ctx.document, ctx);
        that.addButtonView('ysPerfButton', ctx.genPerformance('html'));
        // update score in status bar.
        YSLOW.view.restoreStatusBar(ctx);
        that.updateToolbarSelection();
        // move tab
        el = panel.getElementById(id);
        that.onclickTabLabel({currentTarget: el}, true);
    },

    /**
     * Handle Ruleset drop down list selection change. Update default ruleset and display
     * dialog to ask users if they want to run new ruleset at once.
     * @param {DOMEvent} event onchange event of Ruleset drop down list.
     */
    onChangeRuleset: function (event) {
        var doc, line1, left_button_label, left_button_func,
            select = YSLOW.util.getCurrentTarget(event),
            option = select.options[select.selectedIndex];

        YSLOW.controller.setDefaultRuleset(option.value);

        // ask if want to rerun test with the selected ruleset.
        doc = select.ownerDocument;
        line1 = 'Do you want to run the selected ruleset now?';
        left_button_label = 'Run Test';
        left_button_func = function (e) {
            var stext;

            doc.ysview.closeDialog(doc);
            if (doc.yslowContext.component_set === null) {
                YSLOW.controller.run(doc.yslowContext.document.defaultView ||
                doc.yslowContext.document.parentWindow, doc.yslowContext, false);
            } else {
                // page peeled, just run lint.
                YSLOW.controller.lint(doc.yslowContext.document, doc.yslowContext);
            }

            stext = doc.yslowContext.genPerformance('html');
            doc.ysview.addButtonView("ysPerfButton", stext);
            doc.ysview.panelNode.scrollTop = 0;
            doc.ysview.panelNode.scrollLeft = 0;
            // update score in status bar.
            YSLOW.view.restoreStatusBar(doc.yslowContext);
            doc.ysview.updateToolbarSelection();
        };
        this.openDialog(doc, 389, 150, line1, undefined, left_button_label, left_button_func);
    },

    /**
     * @private
     * Implemented for handling onclick event of TabLabel in TabView.
     * Hide current tab content and make content associated with the newly selected tab visible.
     */
    onclickTabLabel: function (event, move_tab) {
        var child, hide_tab_id, show_tab_id, hide, show, show_tab, id_substring,
            li_elem = YSLOW.util.getCurrentTarget(event),
            ul_elem = li_elem.parentNode,
            div_elem = ul_elem.nextSibling; // yui-content div

        if (li_elem.className.indexOf('selected') !== -1 || li_elem.id.indexOf('label') === -1) {
            return false;
        }
        if (ul_elem) {
            child = ul_elem.firstChild;

            while (child) {
                if (this.unselect(child)) {
                    hide_tab_id = child.id.substring(5);
                    break;
                }
                child = child.nextSibling;
            }

            // select new tab selected.
            li_elem.className += ' selected';
            show_tab_id = li_elem.id.substring(5);

            // Go through all the tabs in yui-content to hide the old tab and show the new tab.
            child = div_elem.firstChild;
            while (child) {
                id_substring = child.id.substring(3);
                if (!hide && hide_tab_id && id_substring === hide_tab_id) {
                    if (child.className.indexOf("yui-hidden") === -1) {
                        //set yui-hidden
                        child.className += " yui-hidden";
                    }
                    hide = true;
                }
                if (!show && show_tab_id && id_substring === show_tab_id) {
                    YSLOW.view.removeClassName(child, "yui-hidden");
                    show = true;
                    show_tab = child;
                }
                if ((hide || !hide_tab_id) && (show || !show_tab_id)) {
                    break;
                }
                child = child.nextSibling;
            }

            if (move_tab === true && show === true && show_tab) {
                this.positionResultTab(show_tab, div_elem, li_elem);
            }
        }
        return false;
    },

    positionResultTab: function (tab, container, label) {
        var y, parent, delta,
            padding = 5,
            doc = this.panel_doc,
            win = doc.defaultView || doc.parentWindow,
            pageHeight = win.offsetHeight ? win.offsetHeight : win.innerHeight,
            height = label.offsetTop + tab.offsetHeight;

        container.style.height = height + 'px';
        tab.style.position = "absolute";
        tab.style.left = label.offsetLeft + label.offsetWidth + "px";
        tab.style.top = label.offsetTop + "px";

        /* now make sure tab is visible */
        y = tab.offsetTop;
        parent = tab.offsetParent;
        while (parent !== null) {
            y += parent.offsetTop;
            parent = parent.offsetParent;
        }

        if (y < this.panelNode.scrollTop || y + tab.offsetHeight > this.panelNode.scrollTop + pageHeight) {

            if (y < this.panelNode.scrollTop) {
                // scroll up
                this.panelNode.scrollTop = y - padding;
            } else {
                // scroll down
                delta = y + tab.offsetHeight - this.panelNode.scrollTop - pageHeight + padding;
                if (delta > y - this.panelNode.scrollTop) {
                    delta = y - this.panelNode.scrollTop;
                }
                this.panelNode.scrollTop += delta;
            }
        }
    },

    /**
     * Event handling for onclick event on result tab (Grade screen). Called from UI.
     * @param {DOMEevent} event onclick event
     */
    onclickResult: function (event) {
        YSLOW.util.preventDefault(event);

        return this.onclickTabLabel(event, true);
    },

    /**
     * @private
     * Helper function to unselect element.
     */
    unselect: function (elem) {
        return YSLOW.view.removeClassName(elem, "selected");
    },

    /**
     * @private
     * Helper function to filter result based on its category. (Grade Screen)
     */
    filterResult: function (doc, category) {
        var ul_elem, showAll, child, firstTab, tab, firstChild, div_elem,
            view = this.getButtonView('ysPerfButton');

        if (category === "all") {
            showAll = true;
        }

        /* go through tab-label to re-adjust hidden state */
        if (view) {
            ul_elem = this.getElementByTagNameAndId(view, "ul", "tab-label-list");
        }
        if (ul_elem) {
            child = ul_elem.firstChild;
            div_elem = ul_elem.nextSibling; // yui-content div
            tab = div_elem.firstChild;

            while (child) {
                YSLOW.view.removeClassName(child, 'first');
                if (showAll || child.className.indexOf(category) !== -1) {
                    child.style.display = "block";
                    if (firstTab === undefined) {
                        firstTab = tab;
                        firstChild = child;
                        YSLOW.view.removeClassName(tab, "yui-hidden");
                        child.className += ' first';
                        if (child.className.indexOf("selected") === -1) { /* set selected class */
                            child.className += " selected";
                        }
                        child = child.nextSibling;
                        tab = tab.nextSibling;
                        continue;
                    }
                } else {
                    child.style.display = "none";
                }

                /* hide non-first tab */
                if (tab.className.indexOf("yui-hidden") === -1) {
                    tab.className += " yui-hidden";
                }

                /* remove selected from class */
                this.unselect(child);

                child = child.nextSibling;
                tab = tab.nextSibling;
            }

            if (firstTab) { /* tab back to top position */
                this.positionResultTab(firstTab, div_elem, firstChild);
            }
        }
    },

    /**
     * Event handler of onclick event of category filter (Grade screen).  Called from UI.
     * @param {DOMEvent} event onclick event
     */
    updateFilterSelection: function (event) {
        var li,
            elem = YSLOW.util.getCurrentTarget(event);

        YSLOW.util.preventDefault(event);

        if (elem.className.indexOf("selected") !== -1) {
            return; /* click on something already selected */
        }
        elem.className += " selected";

        li = elem.parentNode.firstChild;
        while (li) {
            if (li !== elem && this.unselect(li)) {
                break;
            }
            li = li.nextSibling;
        }
        this.filterResult(elem.ownerDocument, elem.id);
    },

    /**
     * Event handler of toolbar menu.
     * @param {DOMEvent} event onclick event
     */
    onclickToolbarMenu: function (event) {
        var child,
            a_elem = YSLOW.util.getCurrentTarget(event),
            li_elem = a_elem.parentNode,
            ul_elem = li_elem.parentNode;

        if (li_elem.className.indexOf("selected") !== -1) { /* selecting an already selected target, do nothing. */
            return;
        }
        li_elem.className += " selected";

        if (li_elem.previousSibling) {
            li_elem.previousSibling.className += " off";
        }

        if (ul_elem) {
            child = ul_elem.firstChild;
            while (child) {
                if (child !== li_elem && this.unselect(child)) {
                    if (child.previousSibling) {
                        YSLOW.view.removeClassName(child.previousSibling, 'off');
                    }
                    break;
                }
                child = child.nextSibling;
            }
        }
    },

    /**
     * Expand components with the passed type. (Components Screen)
     * @param {Document} doc Document object of the YSlow Chrome window.
     * @param {String} type Component type.
     */
    expandCollapseComponentType: function (doc, type) {
        var table,
            renderer = YSLOW.controller.getRenderer('html'),
            view = this.getButtonView('ysCompsButton');

        if (view) {
            table = this.getElementByTagNameAndId(view, 'table', 'components-table');
            renderer.expandCollapseComponentType(doc, table, type);
        }
    },

    /**
     * Expand all components. (Components Screen)
     * @param {Document} doc Document object of the YSlow Chrome window.
     */
    expandAll: function (doc) {
        var table,
            renderer = YSLOW.controller.getRenderer('html'),
            view = this.getButtonView('ysCompsButton');

        if (view) {
            table = this.getElementByTagNameAndId(view, 'table', 'components-table');
            renderer.expandAllComponentType(doc, table);
        }
    },

    /**
     * Regenerate the components table. (Components Screen)
     * @param {Document} doc Document object of the YSlow Chrome window.
     * @param {String} column_name The column to sort by.
     * @param {boolean} sortDesc true if to Sort descending order, false otherwise.
     */
    regenComponentsTable: function (doc, column_name, sortDesc) {
        var table,
            renderer = YSLOW.controller.getRenderer('html'),
            view = this.getButtonView('ysCompsButton');

        if (view) {
            table = this.getElementByTagNameAndId(view, 'table', 'components-table');
            renderer.regenComponentsTable(doc, table, column_name, sortDesc, this.yscontext.component_set);
        }
    },

    /**
     * Show Component header row. (Component Screen)
     * @param {String} headersDivId id of the HTML TR element containing the component header.
     */
    showComponentHeaders: function (headersDivId) {
        var elem, td,
            view = this.getButtonView('ysCompsButton');

        if (view) {
            elem = this.getElementByTagNameAndId(view, "tr", headersDivId);
            if (elem) {
                td = elem.firstChild;
                if (elem.style.display === "none") {
                    elem.style.display = "table-row";
                } else {
                    elem.style.display = "none";
                }
            }
        }
    },

    /**
     * Open link in new tab.
     * @param {String} url URL of the page to be opened.
     */
    openLink: function (url) {
        YSLOW.util.openLink(url);
    },

    /**
     * Open link in a popup window
     * @param {String} url URL of the page to be opened.
     * @param {String} name (optional) the window name.
     * @param {Number} width (optional) the popup window width. 
     * @param {Number} height (optional) the popup window height. 
     */
    openPopup: function (url, name, width, height, features) {
        window.open(url, name || '_blank', 'width=' + (width || 626) +
            ',height=' + (height || 436) + ',' + (features ||
            'toolbar=0,status=1,location=1,resizable=1'));
    },

    /**
     * Launch tool.
     * @param {String} tool_id
     * @param {Object} param to be passed to tool's run method.
     */
    runTool: function (tool_id, param) {
        YSLOW.controller.runTool(tool_id, this.yscontext, param);
    },

    /**
     * Onclick event handler of Ruleset tab in Rule Settings screen.
     * @param {DOMEvent} event onclick event
     */
    onclickRuleset: function (event) {
        var ruleset_id, end, view, form,
            li_elem = YSLOW.util.getCurrentTarget(event),
            index = li_elem.className.indexOf('ruleset-');

        YSLOW.util.preventDefault(event);
        if (index !== -1) {
            end = li_elem.className.indexOf(' ', index + 8);
            if (end !== -1) {
                ruleset_id = li_elem.className.substring(index + 8, end);
            } else {
                ruleset_id = li_elem.className.substring(index + 8);
            }
            view = this.getButtonView('ysRuleEditButton');
            if (view) {
                form = this.getElementByTagNameAndId(view, 'form', 'edit-form');
                YSLOW.renderer.initRulesetEditForm(li_elem.ownerDocument, form, YSLOW.controller.getRuleset(ruleset_id));
            }
        }

        return this.onclickTabLabel(event, false);
    },

    /**
     * Display Save As Dialog
     * @param {Document} doc Document object of YSlow Chrome window.
     * @param {String} form_id id of the HTML form element that contains the ruleset settings to be submit (or saved).
     */
    openSaveAsDialog: function (doc, form_id) {
        var line1 = '<label>Save ruleset as: <input type="text" id="saveas-name" class="text-input" name="saveas-name" length="100" maxlength="100"></label>',
            left_button_label = 'Save',

            left_button_func = function (e) {
                var textbox, line, view, form, input,
                    doc = YSLOW.util.getCurrentTarget(e).ownerDocument;

                if (doc.ysview.modaldlg) {
                    textbox = doc.ysview.getElementByTagNameAndId(doc.ysview.modaldlg, 'input', 'saveas-name');
                }
                if (textbox) {
                    if (YSLOW.controller.checkRulesetName(textbox.value) === true) {
                        line = line1 + '<div class="error">' + textbox.value + ' ruleset already exists.</div>';
                        doc.ysview.closeDialog(doc);
                        doc.ysview.openDialog(doc, 389, 150, line, '', left_button_label, left_button_func);
                    } else {
                        view = doc.ysview.getButtonView('ysRuleEditButton');
                        if (view) {
                            form = doc.ysview.getElementByTagNameAndId(view, 'form', form_id);
                            input = doc.createElement('input');
                            input.type = 'hidden';
                            input.name = 'saveas-name';
                            input.value = textbox.value;
                            form.appendChild(input);
                            form.submit();
                        }
                        doc.ysview.closeDialog(doc);
                    }
                }

            };

        this.openDialog(doc, 389, 150, line1, undefined, left_button_label, left_button_func);
    },

    /**
     * Display Printable View Dialog
     * @param {Document} doc Document object of YSlow Chrome window.
     */
    openPrintableDialog: function (doc) {
        var line = 'Please run YSlow first before using Printable View.',
            line1 = 'Check which information you want to view or print<br>',
            line2 = '<div id="printOptions">' + '<label><input type="checkbox" name="print-type" value="grade" checked>Grade</label>' + '<label><input type="checkbox" name="print-type" value="components" checked>Components</label>' + '<label><input type="checkbox" name="print-type" value="stats" checked>Statistics</label></div>',
            left_button_label = 'Ok',

            left_button_func = function (e) {
                var i,
                    doc = YSLOW.util.getCurrentTarget(e).ownerDocument,
                    doc = FBL.getContentView(doc);

                    aInputs = doc.getElementsByName('print-type'),
                    print_type = {};

                for (i = 0; i < aInputs.length; i += 1) {
                    if (aInputs[i].checked) {
                        print_type[aInputs[i].value] = 1;
                    }
                }
                doc.ysview.closeDialog(doc);
                doc.ysview.runTool('printableview', {
                    'options': print_type,
                    'yscontext': doc.yslowContext
                });
            };

        if (doc.yslowContext.component_set === null) {
            this.openDialog(doc, 389, 150, line, '', 'Ok');
            return;
        }

        this.openDialog(doc, 389, 150, line1, line2, left_button_label, left_button_func);
    },

    /**
     * @private
     * helper function to get element with id and tagname in node.
     */
    getElementByTagNameAndId: function (node, tagname, id) {
        var i, arrElements;

        if (node) {
            arrElements = node.getElementsByTagName(tagname);
            if (arrElements.length > 0) {
                for (i = 0; i < arrElements.length; i += 1) {
                    if (arrElements[i].id === id) {
                        return arrElements[i];
                    }
                }
            }
        }

        return null;
    },

    /**
     * Helper function for displaying dialog.
     * @param {Document} doc Document object of YSlow Chrome window
     * @param {Number} width desired width of the dialog
     * @param {Number} height desired height of the dialog
     * @param {String} text1 first line of text
     * @param {String} text2 second line fo text
     * @param {String} left_button_label left button label
     * @param {Function} left_button_func onclick function of left button
     */
    openDialog: function (doc, width, height, text1, text2, left_button_label, left_button_func) {
        var i, j, dialog, text, more_text, button, inputs, win, pageWidth, pageHeight, left, top,
            overlay = this.modaldlg,
            elems = overlay.getElementsByTagName('div');

        for (i = 0; i < elems.length; i += 1) {
            if (elems[i].className && elems[i].className.length > 0) {
                if (elems[i].className === "dialog-box") {
                    dialog = elems[i];
                } else if (elems[i].className === "dialog-text") {
                    text = elems[i];
                } else if (elems[i].className === "dialog-more-text") {
                    more_text = elems[i];
                }
            }
        }

        if (overlay && dialog && text && more_text) {
            text.innerHTML = (text1 ? text1 : '');
            more_text.innerHTML = (text2 ? text2 : '');

            inputs = overlay.getElementsByTagName('input');
            for (j = 0; j < inputs.length; j += 1) {
                if (inputs[j].className === "dialog-left-button") {
                    button = inputs[j];
                }
            }
            if (button) {
                button.value = left_button_label;
                button.onclick = left_button_func || function (e) {
                    doc = FBL.getContentView(doc);
                    doc.ysview.closeDialog(doc);
                };
            }

            // position dialog to center of panel.
            win = doc.defaultView || doc.parentWindow;
            pageWidth = win.innerWidth;
            pageHeight = win.innerHeight;

            left = Math.floor((pageWidth - width) / 2);
            top = Math.floor((pageHeight - height) / 2);
            dialog.style.left = ((left && left > 0) ? left : 225) + 'px';
            dialog.style.top = ((top && top > 0) ? top : 80) + 'px';

            overlay.style.left = this.panelNode.scrollLeft + 'px';
            overlay.style.top = this.panelNode.scrollTop + 'px';
            overlay.style.display = 'block';

            // put focus on the first input.
            if (inputs.length > 0) {
                inputs[0].focus();
            }
        }

    },

    /**
     * Close the dialog.
     * @param {Document} doc Document object of YSlow Chrome window
     */
    closeDialog: function (doc) {
        var dialog = this.modaldlg;

        dialog.style.display = "none";
    },

    /**
     * Save the modified changes in the selected ruleset in Rule settings screen.
     * @param {Document} doc Document object of YSlow Chrome window
     * @param {String} form_id ID of Form element
     */
    saveRuleset: function (doc, form_id) {
        var form,
            renderer = YSLOW.controller.getRenderer('html'),
            view = this.getButtonView('ysRuleEditButton');

        if (view) {
            form = this.getElementByTagNameAndId(view, 'form', form_id);
            renderer.saveRuleset(doc, form);
        }
    },

    /**
     * Delete the selected ruleset in Rule Settings screen.
     * @param {Document} doc Document object of YSlow Chrome window
     * @param {String} form_id ID of Form element
     */
    deleteRuleset: function (doc, form_id) {
        var form,
            renderer = YSLOW.controller.getRenderer('html'),
            view = this.getButtonView('ysRuleEditButton');

        if (view) {
            form = this.getElementByTagNameAndId(view, 'form', form_id);
            renderer.deleteRuleset(doc, form);
        }
    },

    /**
     * Share the selected ruleset in Rule Settings screen.  Create a .XPI file on Desktop.
     * @param {Document} doc Document object of YSlow Chrome window
     * @param {String} form_id ID of Form element
     */
    shareRuleset: function (doc, form_id) {
        var form, ruleset_id, ruleset, result, line1,
            renderer = YSLOW.controller.getRenderer('html'),
            view = this.getButtonView('ysRuleEditButton');

        if (view) {
            form = this.getElementByTagNameAndId(view, 'form', form_id);
            ruleset_id = renderer.getEditFormRulesetId(form);
            ruleset = YSLOW.controller.getRuleset(ruleset_id);

            if (ruleset) {
                result = YSLOW.Exporter.exportRuleset(ruleset);

                if (result) {
                    line1 = '<label>' + result.message + '</label>';
                    this.openDialog(doc, 389, 150, line1, '', "Ok");
                }
            }
        }
    },

    /**
     * Reset the form selection for creating a new ruleset.
     * @param {HTMLElement} button New Set button
     * @param {String} form_id ID of Form element
     */
    createRuleset: function (button, form_id) {
        var view, form,
            li_elem = button.parentNode,
            ul_elem = li_elem.parentNode,
            child = ul_elem.firstChild;

        // unselect ruleset
        while (child) {
            this.unselect(child);
            child = child.nextSibling;
        }

        view = this.getButtonView('ysRuleEditButton');
        if (view) {
            form = this.getElementByTagNameAndId(view, 'form', form_id);
            YSLOW.renderer.initRulesetEditForm(this.panel_doc, form);
        }
    },

    /**
     * Show/Hide the help menu.
     */
    showHideHelp: function () {
        var help,
            toolbar = this.getElementByTagNameAndId(this.panelNode, "div", "toolbarDiv");

        // In order to support YSlow running on mutli-tab,
        // we need to look up helpDiv using panelNode.
        // panel_doc.getElementById('helpDiv') will always find
        // helpDiv of YSlow running on the first browser tab.
        if (toolbar) {
            help = this.getElementByTagNameAndId(toolbar, "div", "helpDiv");
        }
        if (help) {
            if (help.style.visibility === "visible") {
                help.style.visibility = "hidden";
            } else {
                help.style.visibility = "visible";
            }
        }
    },

    /**
     * Run smushIt.
     * @param {Document} doc Document object of YSlow Chrome window
     * @param {String} url URL of the image to be smushed.
     */
    smushIt: function (doc, url) {
        YSLOW.util.smushIt(url,
            function (resp) {
                var line1, line2, smushurl, dest_url,
                    txt = '';

                if (resp.error) {
                    txt += '<br><div>' + resp.error + '</div>';
                } else {
                    smushurl = YSLOW.util.getSmushUrl();
                    dest_url = YSLOW.util.makeAbsoluteUrl(resp.dest, smushurl);
                    txt += '<div>Original size: ' + resp.src_size + ' bytes</div>' + '<div>Result size: ' + resp.dest_size + ' bytes</div>' + '<div>% Savings: ' + resp.percent + '%</div>' + '<div><a href="javascript:document.ysview.openLink(\'' + dest_url + '\')">Click here to view or save the result image.</a></div>';
                }

                line1 = '<div class="smushItResult"><div>Image: ' + YSLOW.util.briefUrl(url, 250) + '</div></div>';
                line2 = txt;
                doc.ysview.openDialog(doc, 389, 150, line1, line2, "Ok");
            }
        );
    },

    checkAllRules: function (doc, form_id, check) {
        var i, view, form, aElements;

        if (typeof check !== "boolean") {
            return;
        }
        view = this.getButtonView('ysRuleEditButton');
        if (view) {
            form = this.getElementByTagNameAndId(view, 'form', form_id);
            aElements = form.elements;
            for (i = 0; i < aElements.length; i += 1) {
                if (aElements[i].type === "checkbox") {
                    aElements[i].checked = check;
                }
            }
        }
    },

    // exposed for access from content scope (Firebug UI, panel.html)
    // See: https://blog.mozilla.org/addons/2012/08/20/exposing-objects-to-content-safely/
    __exposedProps__: {
        "openLink": "rw",
        "showComponentHeaders": "rw",
        "smushIt": "rw",
        "saveRuleset": "rw",
        "regenComponentsTable": "rw",
        "expandCollapseComponentType": "rw",
        "expandAll": "rw",
        "updateFilterSelection": "rw",
        "openPopup": "rw",
        "runTool": "rw",
        "onclickRuleset": "rw",
        "createRuleset": "rw",
        "addCDN": "rw",
        "closeDialog": "rw",
        "setAutorun": "rw",
        "setAntiIframe": "rw",
        "runTest": "rw",
        "onChangeRuleset": "rw",
        "showRuleSettings": "rw",
        "openPrintableDialog": "rw",
        "showHideHelp": "rw",
        "setSplashView": "rw",
        "onclickToolbarMenu": "rw",
        "showPerformance": "rw",
        "showComponents": "rw",
        "showStats": "rw",
        "showTools": "rw",
        "onclickResult": "rw",
    },
};

YSLOW.view.Tooltip = function (panel_doc, parentNode) {
    this.tooltip = panel_doc.createElement('div');
    if (this.tooltip) {
        this.tooltip.id = "tooltipDiv";
        this.tooltip.innerHTML = '';
        this.tooltip.style.display = "none";
        if (parentNode) {
            parentNode.appendChild(this.tooltip);
        }
    }
    this.timer = null;
};

YSLOW.view.Tooltip.prototype = {

    show: function (text, target) {
        var tooltip = this;

        this.text = text;
        this.target = target;
        this.tooltipData = {
            'text': text,
            'target': target
        };
        this.timer = YSLOW.util.setTimer(function () {
            tooltip.showX();
        }, 500);
    },

    showX: function () {
        if (this.tooltipData) {
            this.showTooltip(this.tooltipData.text, this.tooltipData.target);
        }
        this.timer = null;
    },

    showTooltip: function (text, target) {
        var tooltipWidth, tooltipHeight, parent, midpt_x, midpt_y, sClass, new_x,
            padding = 10,
            x = 0,
            y = 0,
            doc = target.ownerDocument,
            win = doc.defaultView || doc.parentWindow,
            pageWidth = win.offsetWidth ? win.offsetWidth : win.innerWidth,
            pageHeight = win.offsetHeight ? win.offsetHeight : win.innerHeight;

        this.tooltip.innerHTML = text;
        this.tooltip.style.display = "block";

        tooltipWidth = this.tooltip.offsetWidth;
        tooltipHeight = this.tooltip.offsetHeight;

        if (tooltipWidth > pageWidth || tooltipHeight > pageHeight) {
            // forget it, the viewport is too small, don't bother.
            this.tooltip.style.display = "none";
            return;
        }

        parent = target.offsetParent;
        while (parent !== null) {
            x += parent.offsetLeft;
            y += parent.offsetTop;
            parent = parent.offsetParent;
        }
        x += target.offsetLeft;
        y += target.offsetTop;

        if (x < doc.ysview.panelNode.scrollLeft || y < doc.ysview.panelNode.scrollTop || (y + target.offsetHeight > doc.ysview.panelNode.scrollTop + pageHeight)) {
            // target is not fully visible.
            this.tooltip.style.display = "none";
            return;
        }

        midpt_x = x + target.offsetWidth / 2;
        midpt_y = y + target.offsetHeight / 2;

        //decide if tooltip will fit to the right
        if (x + target.offsetWidth + padding + tooltipWidth < pageWidth) {
            // fit to the right?
            x += target.offsetWidth + padding;
            // check vertical alignment
            if ((y >= doc.ysview.panelNode.scrollTop) && (y - padding + tooltipHeight + padding <= doc.ysview.panelNode.scrollTop + pageHeight)) {
                y = y - padding;
                sClass = 'right top';
            } else {
                // align bottom
                y += target.offsetHeight - tooltipHeight;
                sClass = 'right bottom';
            }
        } else {
            if (y - tooltipHeight - padding >= doc.ysview.panelNode.scrollTop) {
                // put it to the top.
                y -= tooltipHeight + padding;
                sClass = 'top';
            } else {
                // put it to the bottom.
                y += target.offsetHeight + padding;
                sClass = 'bottom';
            }
            new_x = Math.floor(midpt_x - tooltipWidth / 2);
            if ((new_x >= doc.ysview.panelNode.scrollLeft) && (new_x + tooltipWidth <= doc.ysview.panelNode.scrollLeft + pageWidth)) {
                x = new_x;
            } else if (new_x < doc.ysview.panelNode.scrollLeft) {
                x = doc.ysview.panelNode.scrollLeft;
            } else {
                x = doc.ysview.panelNode.scrollLeft + pageWidth - padding - tooltipWidth;
            }
        }

        if (sClass) {
            this.tooltip.className = sClass;
        }
        this.tooltip.style.left = x + 'px';
        this.tooltip.style.top = y + 'px';
    },

    hide: function () {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.tooltip.style.display = "none";
    }

};

/**
 * Set YSlow status bar text.
 * @param {String} text text to put on status bar
 * @param {String} sId id of the status bar element to put the text.
 */
YSLOW.view.setStatusBar = function (text, sId) {
    var el = document.getElementById(sId || 'yslow_status_grade');

    if (el) {
        el.value = text;
    }
};

/**
 * Clear YSlow status bar text.
 */
YSLOW.view.clearStatusBar = function () {
    this.setStatusBar("", "yslow_status_time");
    this.setStatusBar("YSlow", "yslow_status_grade");
    this.setStatusBar("", "yslow_status_size");
};

/**
 * Restore YSlow status bar text
 * @param {YSLOW.context} yscontext YSlow context that contains page result and statistics.
 */
YSLOW.view.restoreStatusBar = function (yscontext) {
    var grade, size, t_done;

    if (yscontext) {
        if (yscontext.PAGE.overallScore) {
            grade = YSLOW.util.prettyScore(yscontext.PAGE.overallScore);
            this.setStatusBar(grade, "yslow_status_grade");
        }
        if (yscontext.PAGE.totalSize) {
            size = YSLOW.util.kbSize(yscontext.PAGE.totalSize);
            this.setStatusBar(size, "yslow_status_size");
        }
        if (yscontext.PAGE.t_done) {
            t_done = yscontext.PAGE.t_done / 1000 + "s";
            this.setStatusBar(t_done, "yslow_status_time");
        }
    }
};

/**
 * Toggle YSlow in status bar.
 * @param {Boolean} bhide show or hide YSlow in status bar.
 */
YSLOW.view.toggleStatusBar = function (bHide) {
    document.getElementById('yslow-status-bar').hidden = bHide;
};

/**
 * Remove name from element's className.
 * @param {HTMLElement} element
 * @param {String} name name to be removed from className.
 * @return true if name is found in element's classname
 */
YSLOW.view.removeClassName = function (element, name) {
    var i, names;

    if (element && element.className && element.className.length > 0 && name && name.length > 0) {
        names = element.className.split(" ");
        for (i = 0; i < names.length; i += 1) {
            if (names[i] === name) {
                names.splice(i, 1);
                element.className = names.join(" ");
                return true;
            }
        }
    }

    return false;
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true */

/**
 * YSlow context object that holds components set, result set and statistics of current page.
 *
 * @constructor
 * @param {Document} doc Document object of current page.
 */
YSLOW.context = function (doc) {
    this.document = doc;
    this.component_set = null;
    this.result_set = null;
    this.onloadTimestamp = null;

    // reset renderer variables
    if (YSLOW.renderer) {
        YSLOW.renderer.reset();
    }

    this.PAGE = {
        totalSize: 0,
        totalRequests: 0,
        totalObjCount: {},
        totalObjSize: {},

        totalSizePrimed: 0,
        totalRequestsPrimed: 0,
        totalObjCountPrimed: {},
        totalObjSizePrimed: {},

        canvas_data: {},

        statusbar: false,
        overallScore: 0,

        t_done: undefined,
        loaded: false
    };

};

YSLOW.context.prototype = {

    defaultview: "ysPerfButton",

    /**
     * @private
     * Compute statistics of current page.
     * @param {Boolean} bCacheFull set to true if based on primed cache, false for empty cache.
     * @return stats object
     * @type Object
     */
    computeStats: function (bCacheFull) {
        var comps, comp, compType, i, len, size, totalSize, aTypes,
            canvas_data, sType,
            hCount = {},
            hSize = {}, // hashes where the key is the object type
            nHttpRequests = 0;

        if (!this.component_set) {
            /* need to run peeler first */
            return;
        }

        comps = this.component_set.components;
        if (!comps) {
            return;
        }

        // SUMMARY - Find the number and total size for the categories.
        // Iterate over all the components and add things up.
        for (i = 0, len = comps.length; i < len; i += 1) {
            comp = comps[i];

            if (!bCacheFull || !comp.hasFarFutureExpiresOrMaxAge()) {
                // If the object has a far future Expires date it won't add any HTTP requests nor size to the page.
                // It adds to the HTTP requests (at least a condition GET request).
                nHttpRequests += 1;
                compType = comp.type;
                hCount[compType] = (typeof hCount[compType] === 'undefined' ? 1 : hCount[compType] + 1);
                size = 0;
                if (!bCacheFull || !comp.hasOldModifiedDate()) {
                    // If we're doing EMPTY cache stats OR this component is newly modified (so is probably changing).
                    if (comp.compressed === 'gzip' || comp.compressed === 'deflate') {
                        if (comp.size_compressed) {
                            size = parseInt(comp.size_compressed, 10);
                        }
                    } else {
                        size = comp.size;
                    }
                }
                hSize[compType] = (typeof hSize[compType] === 'undefined' ? size : hSize[compType] + size);
            }
        }

        totalSize = 0;
        aTypes = YSLOW.peeler.types;
        canvas_data = {};
        for (i = 0; i < aTypes.length; i += 1) {
            sType = aTypes[i];
            if (typeof hCount[sType] !== "undefined") {
                // canvas
                if (hSize[sType] > 0) {
                    canvas_data[sType] = hSize[sType];
                }
                totalSize += hSize[sType];
            }
        }

        return {
            'total_size': totalSize,
            'num_requests': nHttpRequests,
            'count_obj': hCount,
            'size_obj': hSize,
            'canvas_data': canvas_data
        };
    },

    /**
     * Collect Statistics of the current page.
     */
    collectStats: function () {
        var stats = this.computeStats();
        if (stats !== undefined) {
            this.PAGE.totalSize = stats.total_size;
            this.PAGE.totalRequests = stats.num_requests;
            this.PAGE.totalObjCount = stats.count_obj;
            this.PAGE.totalObjSize = stats.size_obj;
            this.PAGE.canvas_data.empty = stats.canvas_data;
        }

        stats = this.computeStats(true);
        if (stats) {
            this.PAGE.totalSizePrimed = stats.total_size;
            this.PAGE.totalRequestsPrimed = stats.num_requests;
            this.PAGE.totalObjCountPrimed = stats.count_obj;
            this.PAGE.totalObjSizePrimed = stats.size_obj;
            this.PAGE.canvas_data.primed = stats.canvas_data;
        }
    },

    /**
     * Call registered renderer to generate Grade view with the passed output format.
     *
     * @param {String} output_format output format, e.g. 'html', 'xml'
     * @return Grade in the passed output format.
     */
    genPerformance: function (output_format, doc) {
        if (this.result_set === null) {
            if (!doc) {
                doc = this.document;
            }
            YSLOW.controller.lint(doc, this);
        }
        return YSLOW.controller.render(output_format, 'reportcard', {
            'result_set': this.result_set
        });
    },

    /**
     * Call registered renderer to generate Stats view with the passed output format.
     *
     * @param {String} output_format output format, e.g. 'html', 'xml'
     * @return Stats in the passed output format.
     */
    genStats: function (output_format) {
        var stats = {};
        if (!this.PAGE.totalSize) {
            // collect stats
            this.collectStats();
        }
        stats.PAGE = this.PAGE;
        return YSLOW.controller.render(output_format, 'stats', {
            'stats': stats
        });
    },

    /**
     * Call registered renderer to generate Components view with the passed output format.
     *
     * @param {String} output_format output format, e.g. 'html', 'xml'
     * @return Components in the passed output format.
     */
    genComponents: function (output_format) {
        if (!this.PAGE.totalSize) {
            // collect stats
            this.collectStats();
        }
        return YSLOW.controller.render(output_format, 'components', {
            'comps': this.component_set.components,
            'total_size': this.PAGE.totalSize
        });
    },

    /**
     * Call registered renderer to generate Tools view with the passed output format.
     *
     * @param {String} output_format output format, e.g. 'html'
     * @return Tools in the passed output format.
     */
    genToolsView: function (output_format) {
        var tools = YSLOW.Tools.getAllTools();
        return YSLOW.controller.render(output_format, 'tools', {
            'tools': tools
        });
    },

    /**
     * Call registered renderer to generate Ruleset Settings view with the passed output format.
     *
     * @param {String} output_format output format, e.g. 'html'
     * @return Ruleset Settings in the passed output format.
     */
    genRulesetEditView: function (output_format) {
        return YSLOW.controller.render(output_format, 'rulesetEdit', {
            'rulesets': YSLOW.controller.getRegisteredRuleset()
        });
    }

};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint unparam: true, continue: true, sloppy: true, type: true, maxerr: 50, indent: 4 */

/**
 * Renderer class
 *
 * @class
 */
YSLOW.renderer = {

    sortBy: 'type',

    sortDesc: false,

    bPrintable: false,

    colors: {
        doc: '#8963df',
        redirect: '#FC8C8C',
        iframe: '#FFDFDF',
        xhr: '#89631f',
        flash: '#8D4F5B',
        js: '#9fd0e8',
        css: '#aba5eb',
        cssimage: '#677ab8',
        image: '#d375cd',
        favicon: '#a26c00',
        unknown: '#888888'
    },

    reset: function () {
        this.sortBy = 'type';
        this.sortDesc = false;
    },

    genStats: function (stats, bCacheFull) {
        var hCount, hSize, nHttpRequests, aTypes, cache_type, i, sType, sText,
            tableHtml = '',
            totalSize = 0;

        if (!stats.PAGE) {
            return '';
        }

        if (bCacheFull) {
            hCount = stats.PAGE.totalObjCountPrimed;
            hSize = stats.PAGE.totalObjSizePrimed;
            nHttpRequests = stats.PAGE.totalRequestsPrimed;
            totalSize = stats.PAGE.totalSizePrimed;
        } else {
            hCount = stats.PAGE.totalObjCount;
            hSize = stats.PAGE.totalObjSize;
            nHttpRequests = stats.PAGE.totalRequests;
            totalSize = stats.PAGE.totalSize;
        }

        // Iterate over the component types and format the SUMMARY results.

        // One row for each component type.
        aTypes = YSLOW.peeler.types;
        cache_type = (bCacheFull) ? 'primed' : 'empty';
        for (i = 0; i < aTypes.length; i += 1) {
            sType = aTypes[i];
            if (typeof hCount[sType] !== 'undefined') {
                tableHtml += '<tr><td class="legend">' +
                    '<div class="stats-legend" style="background: ' +
                    this.colors[sType] +
                    '">&nbsp;</div></td><td class="count">' +
                    hCount[sType] +
                    '</td><td class="type">' +
                    YSLOW.util.prettyType(sType) +
                    '</td><td class="size">' +
                    YSLOW.util.kbSize(hSize[sType]) +
                    '</td></tr>';
            }
        }

        sText = '<div id="stats-detail">' +
            '<div class="summary-row">HTTP Requests - ' +
            nHttpRequests +
            '</div><div class="summary-row-2">Total Weight - ' +
            YSLOW.util.kbSize(totalSize) +
            '</div><table id="stats-table">' +
            tableHtml +
            '</table></div>';

        return sText;
    },

    plotComponents: function (stats_view, yscontext) {
        if (typeof stats_view !== "object") {
            return;
        }
        this.plotOne(stats_view, yscontext.PAGE.canvas_data.empty, yscontext.PAGE.totalSize, 'comp-canvas-empty');
        this.plotOne(stats_view, yscontext.PAGE.canvas_data.primed, yscontext.PAGE.totalSizePrimed, 'comp-canvas-primed');
    },

    plotOne: function (stats_view, data, total, canvas_id) {
        var canvas, i, ctx, canvas_size, radius, center, sofar, piece, thisvalue,
            aElements = stats_view.getElementsByTagName('canvas');

        for (i = 0; i < aElements.length; i += 1) {
            if (aElements[i].id === canvas_id) {
                canvas = aElements[i];
            }
        }
        if (!canvas) {
            return;
        }

        ctx = canvas.getContext('2d');
        canvas_size = [canvas.width, canvas.height];
        radius = Math.min(canvas_size[0], canvas_size[1]) / 2;
        center = [canvas_size[0] / 2, canvas_size[1] / 2];


        sofar = 0; // keep track of progress
        // loop the data[]
        for (piece in data) {
            if (data.hasOwnProperty(piece) && data[piece]) {
                thisvalue = data[piece] / total;

                ctx.beginPath();
                // center of the pie
                ctx.moveTo(center[0], center[1]);
                // draw next arc
                ctx.arc(
                    center[0],
                    center[1],
                    radius,
                    // -0.5 sets set the start to be top
                    Math.PI * (-0.5 + 2 * sofar),
                    Math.PI * (-0.5 + 2 * (sofar + thisvalue)),
                    false
                );
                ctx.lineTo(center[0], center[1]); // line back to the center
                ctx.closePath();
                ctx.fillStyle = this.colors[piece]; // color
                ctx.fill();

                sofar += thisvalue; // increment progress tracker
            }
        }
    },

    getComponentHeadersTable: function (comp) {
        var field,
            sText = '<table><tr class="respHeaders"><td colspan=2>Response Headers</td></tr>';

        for (field in comp.headers) {
            if (comp.headers.hasOwnProperty(field) && comp.headers[field]) {
                sText += '<tr><td class="param-name">' +
                    YSLOW.util.escapeHtml(YSLOW.util.formatHeaderName(field)) +
                    '</td><td class="param-value">' +
                    YSLOW.util.escapeHtml(comp.headers[field]) +
                    '</td></tr>';
            }
        }

        if (comp.req_headers) {
            sText += '<tr class="reqHeaders"><td colspan=2>Request Headers</td></tr>';
            for (field in comp.req_headers) {
                if (comp.req_headers.hasOwnProperty(field) &&
                        comp.req_headers[field]) {
                    sText += '<tr><td class="param-name">' +
                        YSLOW.util.escapeHtml(YSLOW.util.formatHeaderName(field)) +
                        '</td><td class="param-value"><p>' +
                        YSLOW.util.escapeHtml(comp.req_headers[field]) +
                        '</p></td></tr>';
                }
            }
        }

        sText += '</table>';
        return sText;
    },

    /**
     * Generate HTML table row code for a component.
     * @param fields table columns
     * @param comp Component
     * @param row_class 'odd' or 'even'
     * @param hidden
     * @return html code
     */
    genComponentRow: function (fields, comp, row_class, hidden) {
        var headersDivId, sHtml, i, sClass, value, sent, recv;

        if (typeof row_class !== "string") {
            row_class = '';
        }
        if (comp.status >= 400 && comp.status < 500) {
            row_class += ' compError';
        }
        if (comp.after_onload === true) {
            row_class += ' afteronload';
        }

        headersDivId = 'compHeaders' + comp.id;

        sHtml = '<tr class="' + row_class + ' type-' + comp.type + '"' + (hidden ? ' style="display:none"' : '') + '>';
        for (i in fields) {
            if (fields.hasOwnProperty(i)) {
                sClass = i;
                value = '';

                if (i === "type") {
                    value += comp[i];
                    if (comp.is_beacon) {
                        value += ' &#8224;';
                    }
                    if (comp.after_onload) {
                        value += ' *';
                    }
                } else if (i === "size") {
                    value += YSLOW.util.kbSize(comp.size);
                } else if (i === "url") {
                    if (comp.status >= 400 && comp.status < 500) {
                        sHtml += '<td class="' + sClass + '">' + comp[i] + ' (status: ' + comp.status + ')</td>';
                        // skip the rest of the fields if this component has error.
                        continue;
                    } else {
                        value += YSLOW.util.prettyAnchor(comp[i], comp[i], undefined, !YSLOW.renderer.bPrintable, 100, 1, comp.type);
                    }
                } else if (i === "gzip" && (comp.compressed === "gzip" || comp.compressed === "deflate")) {
                    value += (comp.size_compressed !== undefined ? YSLOW.util.kbSize(comp.size_compressed) : 'uncertain');
                } else if (i === "set-cookie") {
                    sent = comp.getSetCookieSize();
                    value += sent > 0 ? sent : '';
                } else if (i === "cookie") {
                    recv = comp.getReceivedCookieSize();
                    value += recv > 0 ? recv : '';
                } else if (i === "etag") {
                    value += comp.getEtag();
                } else if (i === "expires") {
                    value += YSLOW.util.prettyExpiresDate(comp.expires);
                } else if (i === "headers") {
                    if (YSLOW.renderer.bPrintable) {
                        continue;
                    }
                    if (comp.raw_headers && comp.raw_headers.length > 0) {
                        value += '<a href="javascript:document.ysview.showComponentHeaders(\'' + headersDivId + '\')"><b class="mag"></b></a>';
                    }
                } else if (i === "action") {
                    if (YSLOW.renderer.bPrintable) {
                        continue;
                    }
                    if (comp.type === 'cssimage' || comp.type === 'image') {
                        // for security reason, don't display smush.it unless it's image mime type.
                        if (comp.response_type === undefined || comp.response_type === "image") {
                            value += '<a href="javascript:document.ysview.smushIt(document, \'' + comp.url + '\')">smush.it</a>';
                        }
                    }
                } else if (comp[i] !== undefined) {
                    value += comp[i];
                }
                sHtml += '<td class="' + sClass + '">' + value + '</td>';
            }
        }
        sHtml += '</tr>';

        if (comp.raw_headers && comp.raw_headers.length > 0) {
            sHtml += '<tr id="' + headersDivId + '" class="headers" style="display:none;"><td colspan="12">' + this.getComponentHeadersTable(comp) + '</td></tr>';
        }
        return sHtml;
    },

    componentSortCallback: function (comp1, comp2) {
        var i, types, max,
            a = '',
            b = '',
            sortBy = YSLOW.renderer.sortBy,
            desc = YSLOW.renderer.sortDesc;

        switch (sortBy) {
        case 'type':
            a = comp1.type;
            b = comp2.type;
            break;
        case 'size':
            a = comp1.size ? Number(comp1.size) : 0;
            b = comp2.size ? Number(comp2.size) : 0;
            break;
        case 'gzip':
            a = comp1.size_compressed ? Number(comp1.size_compressed) : 0;
            b = comp2.size_compressed ? Number(comp2.size_compressed) : 0;
            break;
        case 'set-cookie':
            a = comp1.getSetCookieSize();
            b = comp2.getSetCookieSize();
            break;
        case 'cookie':
            a = comp1.getReceivedCookieSize();
            b = comp2.getReceivedCookieSize();
            break;
        case 'headers':
            // header exist?
            break;
        case 'url':
            a = comp1.url;
            b = comp2.url;
            break;
        case 'respTime':
            a = comp1.respTime ? Number(comp1.respTime) : 0;
            b = comp2.respTime ? Number(comp2.respTime) : 0;
            break;
        case 'etag':
            a = comp1.getEtag();
            b = comp2.getEtag();
            break;
        case 'action':
            if (comp1.type === 'cssimage' || comp1.type === 'image') {
                a = 'smush.it';
            }
            if (comp2.type === 'cssimage' || comp2.type === 'image') {
                b = 'smush.it';
            }
            break;
        case 'expires':
            // special case - date type
            a = comp1.expires || 0;
            b = comp2.expires || 0;
            break;
        }

        if (a === b) {
            // secondary sorting by ID to stablize the sorting algorithm.
            if (comp1.id > comp2.id) {
                return (desc) ? -1 : 1;
            }
            if (comp1.id < comp2.id) {
                return (desc) ? 1 : -1;
            }
        }

        // special case for sorting by type.
        if (sortBy === 'type') {
            types = YSLOW.peeler.types;
            for (i = 0, max = types.length; i < max; i += 1) {
                if (comp1.type === types[i]) {
                    return (desc) ? 1 : -1;
                }
                if (comp2.type === types[i]) {
                    return (desc) ? -1 : 1;
                }
            }
        }

        // normal comparison
        if (a > b) {
            return (desc) ? -1 : 1;
        }
        if (a < b) {
            return (desc) ? 1 : -1;
        }

        return 0;

    },

    /**
     * Sort components, return a new array, the passed array is unchanged.
     * @param array of components to be sorted
     * @param field to sort by.
     * @return a new array of the sorted components.
     */
    sortComponents: function (comps, sortBy, desc) {
        var arr_comps = comps;

        this.sortBy = sortBy;
        this.sortDesc = desc;
        arr_comps.sort(this.componentSortCallback);

        return arr_comps;
    },

    genRulesCheckbox: function (ruleset) {
        var sText, id, rule, column_id,
            weightsText = '',
            numRules = 0,
            rules = YSLOW.controller.getRegisteredRules(),
            j = 0,
            col1Text = '<div class="column1">',
            col2Text = '<div class="column2">',
            col3Text = '<div class="column3">';

        for (id in rules) {
            if (rules.hasOwnProperty(id) && rules[id]) {
                rule = rules[id];

                sText = '<label class="rules"><input id="rulesetEditRule' +
                    id +
                    '" name="rules" value="' +
                    id +
                    '" type="checkbox"' +
                    (ruleset.rules[id] ? ' checked' : '') +
                    '>' +
                    rule.name +
                    '</label><br>';

                if (ruleset.rules[id] !== undefined) {
                    numRules += 1;
                }

                if (ruleset.weights !== undefined && ruleset.weights[id] !== undefined) {
                    weightsText += '<input type="hidden" name="weight-' +
                        id +
                        '" value="' +
                        ruleset.weights[rule.id] +
                        '">';
                }

                column_id = (j % 3);
                switch (column_id) {
                case 0:
                    col1Text += sText;
                    break;
                case 1:
                    col2Text += sText;
                    break;
                case 2:
                    col3Text += sText;
                    break;
                }
                j += 1;
            }
        }

        col1Text += '</div>';
        col2Text += '</div>';
        col3Text += '</div>';

        return '<h4><span id="rulesetEditFormTitle">' + ruleset.name + '</span> Ruleset <span id="rulesetEditFormNumRules" class="font10">(includes ' + parseInt(numRules, 10) + ' of ' + parseInt(j, 10) + ' rules)</span></h4>' + '<div class="rulesColumns"><table><tr><td>' + col1Text + '</td><td>' + col2Text + '</td><td>' + col3Text + '</td></tr></table><div id="rulesetEditWeightsDiv" class="weightsDiv">' + weightsText + '</div></div>';
    },

    genRulesetEditForm: function (ruleset) {
        var contentHtml = '';

        contentHtml += '<div id="rulesetEditFormDiv">' + '<form id="edit-form" action="javascript:document.ysview.saveRuleset(document, \'edit-form\')">' + '<div class="floatRight"><a href="javascript:document.ysview.checkAllRules(document, \'edit-form\', true)">Check All</a>|<a href="javascript:document.ysview.checkAllRules(document, \'edit-form\', false)">Uncheck All</a></div>' + YSLOW.renderer.genRulesCheckbox(ruleset) + '<div class="buttons"><input type="button" value="Save ruleset as ..." onclick="javascript:document.ysview.openSaveAsDialog(document, \'edit-form\')">' + '<span id="rulesetEditCustomButtons" style="visibility: ' + (ruleset.custom === true ? 'visible' : 'hidden') + '">' + '<input type="button" value="Save" onclick="this.form.submit()">' + '<!--<input type="button" value="Share" onclick="javascript:document.ysview.shareRuleset(document, \'edit-form\')">-->' + '<input class="btn_delete" type="button" value="Delete" onclick="javascript:document.ysview.deleteRuleset(document, \'edit-form\')">' + '</span></div>' + '<div id="rulesetEditRulesetId"><input type="hidden" name="ruleset-id" value="' + ruleset.id + '"></div>' + '<div id="rulesetEditRulesetName"><input type="hidden" name="ruleset-name" value="' + ruleset.name + '"></div>' + '</form></div>';

        return contentHtml;
    },

    initRulesetEditForm: function (doc, form, ruleset) {
        var divs, i, j, id, buttons, rulesetId, rulesetName, title, weightsDiv,
            rules, numRulesSpan, spans, checkbox,
            aElements = form.elements,
            weightsText = '',
            checkboxes = [],
            numRules = 0,
            totalRules = 0;

        // uncheck all rules
        for (i = 0; i < aElements.length; i += 1) {
            if (aElements[i].name === "rules") {
                aElements[i].checked = false;
                checkboxes[aElements[i].id] = aElements[i];
                totalRules += 1;
            } else if (aElements[i].name === "saveas-name") {
                // clear saveas-name
                form.removeChild(aElements[i]);
            }
        }

        divs = form.getElementsByTagName('div');
        for (i = 0; i < divs.length; i += 1) {
            if (divs[i].id === "rulesetEditWeightsDiv") {
                weightsDiv = divs[i];
            } else if (divs[i].id === "rulesetEditRulesetId") {
                rulesetId = divs[i];
            } else if (divs[i].id === "rulesetEditRulesetName") {
                rulesetName = divs[i];
            }
        }

        spans = form.parentNode.getElementsByTagName('span');
        for (j = 0; j < spans.length; j += 1) {
            if (spans[j].id === "rulesetEditFormTitle") {
                title = spans[j];
            } else if (spans[j].id === "rulesetEditCustomButtons") {
                // show save, delete and share for custom rules
                buttons = spans[j];
                if (ruleset !== undefined && ruleset.custom === true) {
                    // show the buttons
                    buttons.style.visibility = 'visible';
                } else {
                    // hide the buttons
                    buttons.style.visibility = 'hidden';
                }
            } else if (spans[j].id === "rulesetEditFormNumRules") {
                numRulesSpan = spans[j];
            }
        }

        if (ruleset) {
            rules = ruleset.rules;
            for (id in rules) {
                if (rules.hasOwnProperty(id) && rules[id]) {
                    // check the checkbox.
                    checkbox = checkboxes['rulesetEditRule' + id];
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                    if (ruleset.weights !== undefined && ruleset.weights[id] !== undefined) {
                        weightsText += '<input type="hidden" name="weight-' + id + '" value="' + ruleset.weights[id] + '">';
                    }
                    numRules += 1;
                }
            }
            numRulesSpan.innerHTML = '(includes ' + parseInt(numRules, 10) + ' of ' + parseInt(totalRules, 10) + ' rules)';
            rulesetId.innerHTML = '<input type="hidden" name="ruleset-id" value="' + ruleset.id + '">';
            rulesetName.innerHTML = '<input type="hidden" name="ruleset-name" value="' + ruleset.name + '">';
            title.innerHTML = ruleset.name;
        } else {
            rulesetId.innerHTML = '';
            rulesetName.innerHTML = '';
            title.innerHTML = 'New';
            numRulesSpan.innerHTML = '';
        }
        weightsDiv.innerHTML = weightsText;
    }
};

YSLOW.registerRenderer({
    /**
     * @member YSLOW.HTMLRenderer
     * @final
     */
    id: 'html',
    /**
     * @member YSLOW.HTMLRenderer
     * @final
     */
    supports: {
        components: 1,
        reportcard: 1,
        stats: 1,
        tools: 1,
        rulesetEdit: 1
    },

    /**
     * @private
     */
    genComponentsTable: function (comps, sortBy, sortDesc) {
        var f, j, type, comp,
            headers = {
                'type': 'TYPE',
                'size': 'SIZE<br> (KB)',
                'gzip': 'GZIP<br> (KB)',
                'set-cookie': 'COOKIE&nbsp;RECEIVED<br>(bytes)',
                'cookie': 'COOKIE&nbsp;SENT<br>(bytes)',
                'headers': 'HEADERS',
                'url': 'URL',
                'expires': 'EXPIRES<br>(Y/M/D)',
                'respTime': 'RESPONSE<br> TIME&nbsp;(ms)',
                'etag': 'ETAG',
                'action': 'ACTION'
            },
            collapsed = false,
            tableHtml = '',
            rowHtml = '',
            numComponentsByType = 0,
            sizeByType = 0;

        if (sortBy !== undefined && headers[sortBy] === undefined) {
            return ''; // Invalid column name, don't do anything.
        }

        if (YSLOW.renderer.bPrintable) {
            sortBy = YSLOW.renderer.sortBy;
            sortDesc = YSLOW.renderer.sortDesc;
        } else if (sortBy === undefined || sortBy === "type") {
            sortBy = "type";
            collapsed = true;
        }

        comps = YSLOW.renderer.sortComponents(comps, sortBy, sortDesc);


        // table headers
        tableHtml += '<table id="components-table"><tr>';
        for (f in headers) {
            if (headers.hasOwnProperty(f) && headers[f]) {
                if (YSLOW.renderer.bPrintable &&
                        (f === "action" || f === "components" ||
                        f === "headers")) {
                    continue;
                }
                tableHtml += '<th';
                if (sortBy === f) {
                    tableHtml += ' class=" sortBy"';
                }
                tableHtml += '>';
                if (YSLOW.renderer.bPrintable) {
                    tableHtml += headers[f];
                } else {
                    tableHtml += '<div class="';
                    if (sortBy === f) {
                        tableHtml += (sortDesc ? ' sortDesc' : ' sortAsc');
                    }
                    tableHtml += '"><a href="javascript:document.ysview.regenComponentsTable(document, \'' + f + '\'' + (sortBy === f ? (sortDesc ? ', false' : ', true') : '') + ')">' + (sortBy === f ? (sortDesc ? '&darr;' : '&uarr;') : '') + ' ' + headers[f] + '</a></div>';

                }
            }
        }
        tableHtml += '</tr>';

        // component data
        for (j = 0; j < comps.length; j += 1) {
            comp = comps[j];
            if ((sortBy === undefined || sortBy === "type") && !YSLOW.renderer.bPrintable) {
                if (type === undefined) {
                    type = comp.type;
                } else if (type !== comp.type) { /* add type summary row */
                    tableHtml += '<tr class="type-summary ' + (collapsed ? 'expand' : 'collapse') + '"><td>' + '<a href="javascript:document.ysview.expandCollapseComponentType(document, \'' + type + '\')"><b class="expcol"><b class="exp exph"></b><b class="exp expv"></b><b class="col"></b></b><span class="rowTitle type-' + type + '">' + type + '&nbsp;(' + numComponentsByType + ')</span></a></td><td class="size">' + YSLOW.util.kbSize(sizeByType) + '</td><td><!-- GZIP --></td><td></td><td></td><td><!-- HEADERS --></td>' + '<td><!-- URL --></td><td><!-- EXPIRES --></td><td><!-- RESPTIME --></td><td><!-- ETAG --></td>' + '<td><!-- ACTION--></td></tr>'; /* flush to tableHtml */
                    tableHtml += rowHtml;
                    rowHtml = '';
                    numComponentsByType = 0;
                    sizeByType = 0;
                    type = comp.type;
                }
                rowHtml += YSLOW.renderer.genComponentRow(headers, comp, (numComponentsByType % 2 === 0 ? 'even' : 'odd'), collapsed);
                numComponentsByType += 1;
                sizeByType += comp.size;
            } else {
                tableHtml += YSLOW.renderer.genComponentRow(headers, comp, (j % 2 === 0 ? 'even' : 'odd'), false);
            }
        }
        if (rowHtml.length > 0) {
            tableHtml += '<tr class="type-summary ' + (collapsed ? 'expand' : 'collapse') + '"><td>' + '<a href="javascript:document.ysview.expandCollapseComponentType(document, \'' + type + '\')"><b class="expcol"><b class="exp exph"></b><b class="exp expv"></b><b class="col"></b></b><span class="rowTitle type-' + type + '">' + type + '&nbsp;(' + numComponentsByType + ')</span></a></td><td class="size">' + YSLOW.util.kbSize(sizeByType) + '</td><td><!-- GZIP --></td><td></td><td></td><td><!-- HEADERS --></td>' + '<td><!-- URL --></td><td><!-- EXPIRES --></td><td><!-- RESPTIME --></td><td><!-- ETAG --></td>' + '<td><!-- ACTION--></td></tr>';
            tableHtml += rowHtml;
        }
        tableHtml += '</table>';
        return tableHtml;

    },

    /**
     * @member YSLOW.HTMLRenderer
     * Generate HTML code for Components tab
     * @param {YSLOW.ComponentSet} comps  array of components
     * @param {Number} totalSize total page size
     * @return html code for Components tab
     * @type String
     */
    componentsView: function (comps, totalSize) {
        var sText,
            tableHtml = this.genComponentsTable(comps, YSLOW.renderer.sortBy, false),
            beacon_legend = 'in type column indicates the component is loaded after window onload event.',
            after_onload_legend = 'denotes 1x1 pixels image that may be image beacon',
            title = 'Components';

        if (YSLOW.doc) {
            if (YSLOW.doc.components_legend) {
                if (YSLOW.doc.components_legend.beacon) {
                    beacon_legend = YSLOW.doc.components_legend.beacon;
                }
                if (YSLOW.doc.components_legend.after_onload) {
                    after_onload_legend = YSLOW.doc.components_legend.after_onload;
                }
            }
            if (YSLOW.doc.view_names && YSLOW.doc.view_names.components) {
                title = YSLOW.doc.view_names.components;
            }
        }

        sText = '<div id="componentsDiv">' + '<div id="summary"><span class="view-title">' + title + '</span>The page has a total of ' + '<span class="number">' + comps.length + '</span>' + ' components and a total weight of ' + '<span class="number">' + YSLOW.util.kbSize(totalSize) + '</span> bytes</div>' + '<div id="expand-all"><a href="javascript:document.ysview.expandAll(document)"><b>&#187;</b><span id="expand-all-text">Expand All</span></a></div>' + '<div id="components">' + tableHtml + '</div><div class="legend">* ' + beacon_legend + '<br>' + '&#8224; ' + after_onload_legend + '</div></div>';

        return sText;
    },

    /**
     * @private
     */
    reportcardPrintableView: function (results, overall_grade, ruleset) {
        var i, j, result, grade, grade_class,
            html = '<div id="reportDiv"><table><tr class="header"><td colspan="2">Overall Grade: ' + overall_grade + '  (Ruleset applied: ' + ruleset.name + ')</td></tr>';

        for (i = 0; i < results.length; i += 1) {
            result = results[i];
            if (typeof result === "object") {
                grade = YSLOW.util.prettyScore(result.score);
                grade_class = 'grade-' + (grade === "N/A" ? 'NA' : grade);

                html += '<tr><td class="grade ' + grade_class + '"><b>' + grade + '</b></td>' + '<td class="desc"><p>' + result.name + '<br><div class="message">' + result.message + '</div>';

                if (result.components && result.components.length > 0) {
                    html += '<ul class="comps-list">';
                    for (j = 0; j < result.components.length; j += 1) {
                        if (typeof result.components[j] === "string") {
                            html += '<li>' + result.components[j] + '</li>';
                        } else if (result.components[j].url !== undefined) {
                            html += '<li>' + YSLOW.util.briefUrl(result.components[j].url, 60) + '</li>';
                        }
                    }
                    html += '</ul><br>';
                }

                html += '</p></td></tr>';
            }
        }
        html += '</table></div>';
        return html;
    },

    getFilterCode: function (categories, results, grade, url) {
        var html, id, i, len, link, result, score,
            total = results.length,
            array = [];

        for (id in categories) {
            if (categories.hasOwnProperty(id) && categories[id]) {
                array.push(id);
            }
        }
        array.sort();

        html = '<div id="filter"><ul>' + '<li class="first selected" id="all" onclick="javascript:document.ysview.updateFilterSelection(event)"><a href="#">ALL (' + total + ')</a></li>' + '<li class="first">FILTER BY: </li>';

        for (i = 0, len = array.length; i < len; i += 1) {
            html += '<li';
            if (i === 0) {
                html += ' class="first"';
            }
            html += ' id="' + array[i] + '" onclick="javascript:document.ysview.updateFilterSelection(event)"><a href="#">' + array[i].toUpperCase() + ' (' + categories[array[i]] + ')</a></li>';
        }

        // social
        link = 'http://yslow.org/scoremeter/?url=' +
            encodeURIComponent(url) + '&grade=' + grade;
        for (i = 0; i < total; i += 1) {
            result = results[i];
            score = parseInt(result.score, 10);
            if (score >= 0 && score < 100) {
                link += '&' + result.rule_id.toLowerCase() + '=' + score;
            }
        }

        // for some reason window.open mess with decoding, thus encoding twice
        link = encodeURIComponent(encodeURIComponent(link));
        url = encodeURIComponent(encodeURIComponent(url.slice(0, 60) + (url.length > 60 ? '...' : '')));

        html += '<li class="social"><a class="facebook" href="javascript:document.ysview.openPopup(\'http://www.facebook.com/sharer.php?t=YSlow%20Scoremeter&u=' + link + '\', \'facebook\')" title="Share these results"><span>Share</span></a></li>';
        html += '<li class="social"><a class="twitter" href="javascript:document.ysview.openPopup(\'http://twitter.com/share?original_referer=&source=tweetbutton&text=YSlow%20grade%20' + grade + '%20for%20' + url + '&url=' + link + '&via=yslow\', \'twitter\')" title="Tweet these results"><span>Tweet</spam></a></li>';

        html += '</ul></div>';

        return html;
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Generate HTML code for Grade screen
     * @param {YSLOW.ResultSet} resultset
     * @return html code for Grade screen
     * @type String
     */
    reportcardView: function (resultset) {
        var overall_grade, i, j, k, result, grade, index, sClass, grade_class, score, messages, comp, string, rule,
            html = '<div id="reportDiv">',
            appliedRuleset = resultset.getRulesetApplied(),
            results = resultset.getResults(),
            url = resultset.url,
            title = 'Grade',
            tab_label_html = '',
            tab_html = '',
            categories = {};


        if (YSLOW.doc) {
            if (YSLOW.doc.view_names && YSLOW.doc.view_names.grade) {
                title = YSLOW.doc.view_names.grade;
            }
        }

        overall_grade = YSLOW.util.prettyScore(resultset.getOverallScore());

        if (YSLOW.renderer.bPrintable) {
            return this.reportcardPrintableView(results, overall_grade, appliedRuleset);
        }

        html += '<div id="summary"><table><tr><td><div class="bigFont">' + title + '</div></td>' + '<td class="padding5"><div id="overall-grade" class="grade-' + overall_grade + '">' + overall_grade + '</div></td>' + '<td class="padding15">Overall performance score ' + Math.round(resultset.getOverallScore()) + '</td>' + '<td class="padding15">Ruleset applied: ' + appliedRuleset.name + '</td>' + '<td class="padding15">URL: ' + YSLOW.util.briefUrl(url, 100) + '</td>' + '</tr></table></div>';


        for (i = 0; i < results.length; i += 1) {
            result = results[i];
            if (typeof result === "object") {
                grade = YSLOW.util.prettyScore(result.score);
                index = i + 1;
                sClass = '';
                grade_class = 'grade-' + (grade === "N/A" ? 'NA' : grade);
                score = parseInt(result.score, 10);
                if (isNaN(score) || result.score === -1) {
                    score = "n/a";
                } else {
                    score += "%";
                }

                tab_label_html += '<li' + ' id="label' + index + '"';
                if (i === 0) {
                    sClass += "first selected";
                }
                if (result.category) {
                    for (k = 0; k < result.category.length; k += 1) {
                        if (sClass.length > 0) {
                            sClass += ' ';
                        }
                        sClass += result.category[k];
                        // update filter categories
                        if (categories[result.category[k]] === undefined) {
                            categories[result.category[k]] = 0;
                        }
                        categories[result.category[k]] += 1;
                    }
                }
                if (sClass.length > 0) {
                    tab_label_html += ' class="' + sClass + '"';
                }
                tab_label_html += ' onclick="javascript:document.ysview.onclickResult(event)">' + '<a href="#" class="' + grade_class + '">' + '<div class="tab-label">' + '<span class="grade" title="' + score + '">' + grade + '</span>' + '<span class="desc">' + result.name + '</span></div></a></li>';

                tab_html += '<div id="tab' + index + '" class="result-tab';
                if (i !== 0) {
                    tab_html += ' yui-hidden';
                }
                messages = result.message.split('\n');
                if (messages) {
                    result.message = messages.join('<br>');
                }
                tab_html += '"><h4>Grade ' + grade + ' on ' + result.name + '</h4><p>' + result.message + '<br>';

                if (result.components && result.components.length > 0) {
                    tab_html += '<ul class="comps-list">';
                    for (j = 0; j < result.components.length; j += 1) {
                        comp = result.components[j];
                        if (typeof comp === "string") {
                            tab_html += '<li>' + comp + '</li>';
                        } else if (comp.url !== undefined) {
                            tab_html += '<li>';
                            string = result.rule_id.toLowerCase();
                            if (result.rule_id.match('expires')) {
                                tab_html += '(' + YSLOW.util.prettyExpiresDate(comp.expires) + ') ';
                            }
                            tab_html += YSLOW.util.prettyAnchor(comp.url, comp.url, undefined, true, 120, undefined, comp.type) + '</li>';
                        }
                    }
                    tab_html += '</ul><br>';
                }
                tab_html += '</p>';

                rule = YSLOW.controller.getRule(result.rule_id);

                if (rule) {
                    tab_html += '<hr><p class="rule-info">' + (rule.info || '** To be added **') + '</p>';

                    if (rule.url !== undefined) {
                        tab_html += '<p class="more-info"><a href="javascript:document.ysview.openLink(\'' + rule.url + '\')"><b>&#187;</b>Read More</a></p>';

                    }
                }

                tab_html += '</div>';
            }
        }

        html += '<div id="reportInnerDiv">' + this.getFilterCode(categories, results, overall_grade, url) + '<div id="result" class="yui-navset yui-navset-left">' + '<ul class="yui-nav" id="tab-label-list">' + tab_label_html + '</ul>' + '<div class="yui-content">' + tab_html + '</div>' + '<div id="copyright2">' + YSLOW.doc.copyright + '</div>' + '</div></div></div>';

        return html;
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Generate HTML code for Stats screen
     * @param {Object} stats page stats
     * <ul>
     * <li><code>PAGE.totalObjCountPrimed</code> a hash of components count group by type (primed cache)</li>
     * <li><code>PAGE.totalObjSizePrimed</code> a hash of components size group by type (primed cache)</li>
     * <li><code>PAGE.totalObjRequestsPrimed</code> total number of requests (primed cache)</li>
     * <li><code>PAGE.totalSizePrimed</code> total size of all components (primed cache)</li>
     * <li><code>PAGE.totalObjCount</code> a hash of components count group by type (empty cache)</li>
     * <li><code>PAGE.totalObjSize</code> a hash of components size group by type (empty cache)</li>
     * <li><code>PAGE.totalObjRequests</code> total number of requests (empty cache)</li>
     * <li><code>PAGE.totalSize</code> total size of all components (empty cache)</li>
     * </ul>
     * @return html code for Stats screen
     * @type String
     */
    statsView: function (stats) {
        var sText = '',
            title = 'Stats';

        if (YSLOW.doc) {
            if (YSLOW.doc.view_names && YSLOW.doc.view_names.stats) {
                title = YSLOW.doc.view_names.stats;
            }
        }

        sText += '<div id="statsDiv">' + '<div id="summary"><span class="view-title">' + title + '</span>The page has a total of ' + '<span class="number">' + stats.PAGE.totalRequests + '</span>' + ' HTTP requests and a total weight of ' + '<span class="number">' + YSLOW.util.kbSize(stats.PAGE.totalSize) + '</span>' + ' bytes with empty cache</div>';

        // Page summary.
        sText += '<div class="section-header">WEIGHT GRAPHS</div>';

        sText += '<div id="empty-cache">' + '<div class="stats-graph floatLeft"><div class="canvas-title">Empty Cache</div>' + '<canvas id="comp-canvas-empty" width="150" height="150"></canvas></div>' + '<div class="yslow-stats-empty">' + YSLOW.renderer.genStats(stats, false) + '</div></div>';

        sText += '<div id="primed-cache">' + '<div class="stats-graph floatLeft"><div class="canvas-title">Primed Cache</div>' + '<canvas id="comp-canvas-primed" width="150" height="150"></canvas></div>' + '<div class="yslow-stats-primed">' + YSLOW.renderer.genStats(stats, true) + '</div></div>';

        sText += '</div>';

        return sText;
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Generate Html for Tools tab
     * @param {Array} tools array of tools
     * @return html for Tools tab
     * @type String
     */
    toolsView: function (tools) {
        var i, sText, tool,
            tableHtml = '<table>',
            title = 'Tools',
            desc = 'Click the Launch Tool link next to the tool you want to run to start the tool.';

        if (YSLOW.doc) {
            if (YSLOW.doc.tools_desc) {
                desc = YSLOW.doc.tools_desc;
            }
            if (YSLOW.doc.view_names && YSLOW.doc.view_names.tools) {
                title = YSLOW.doc.view_names.tools;
            }
        }

        for (i = 0; i < tools.length; i += 1) {
            tool = tools[i];
            tableHtml += '<tr><td class="name"><b><a href="#" onclick="javascript:document.ysview.runTool(\'' + tool.id + '\', {\'yscontext\': document.yslowContext })">' + tool.name + '</a></b></td><td>-</td><td>' + (tool.short_desc || 'Short text here explaining what are the main benefits of running this App') + '</td></tr>';
        }

        tableHtml += '</table>';

        sText = '<div id="toolsDiv">' + '<div id="summary"><span class="view-title">' + title + '</span>' + desc + '</div>' + '<div id="tools">' + tableHtml + '</div></div>';

        return sText;
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Generate Html for Ruleset Settings Screen
     * @param {Object} rulesets a hash of rulesets with { ruleset-name => ruleset }
     * @return html code for Ruleset Settings screen
     * @type String
     */
    rulesetEditView: function (rulesets) {
        var id, ruleset, tab_id, sText,
            settingsHtml = '<div id="settingsDiv" class="yui-navset yui-navset-left">',
            navHtml, contentHtml,
            index = 0,
            custom = false,
            selectedRuleset,
            defaultRulesetId,
            title = 'Rule Settings',
            desc = 'Choose which ruleset better fit your specific needs. You can Save As an existing rule, based on an existing ruleset.';

        if (YSLOW.doc) {
            if (YSLOW.doc.rulesettings_desc) {
                desc = YSLOW.doc.rulesettings_desc;
            }
            if (YSLOW.doc.view_names && YSLOW.doc.view_names.rulesetedit) {
                title = YSLOW.doc.view_names.rulesetedit;
            }
        }

        defaultRulesetId = YSLOW.controller.getDefaultRulesetId();

        navHtml = '<ul class="yui-nav"><li class="header">STANDARD SETS</li>';

        for (id in rulesets) {
            if (rulesets.hasOwnProperty(id) && rulesets[id]) {
                ruleset = rulesets[id];
                tab_id = 'tab' + index;
                if (!custom && ruleset.custom === true) {
                    navHtml += '<li class="new-section header" id="custom-set-title">CUSTOM SETS</li>';
                    custom = true;
                }
                navHtml += '<li id="label' + index + '" class="' + 'ruleset-' + ruleset.id;
                if (id === defaultRulesetId) {
                    selectedRuleset = rulesets[id];
                    navHtml += ' selected"';
                }
                navHtml += '" onclick="javascript:document.ysview.onclickRuleset(event)"><a href="#' + tab_id + '">' + ruleset.name + '</a></li>';
                index += 1;
            }
        }

        navHtml += '<li class="new-section create-ruleset" id="create-ruleset"><input type="button" value="New Set" onclick="javascript:document.ysview.createRuleset(this, \'edit-form\')"></li></ul>';
        contentHtml = '<div class="yui-content">' + YSLOW.renderer.genRulesetEditForm(selectedRuleset) + '</div>';

        settingsHtml += navHtml + contentHtml;

        sText = '<div id="rulesetEditDiv">' + '<div id="summary"><span class="view-title">' + title + '</span>' + desc + '</div>' + settingsHtml + '</div>';

        return sText;
    },

    /**
     * @private
     */
    rulesetEditUpdateTab: function (doc, form, ruleset, updateAction, updateSelection) {
        var ul_elem, content, li_elem, index, id, tab_id, event, custom_set_title,
            label_id, idx, prev_li_elem, header, event2,
            container = form.parentNode.parentNode.parentNode;

        if (container && container.id === 'settingsDiv' && ruleset.custom === true) {
            ul_elem = container.firstChild;
            content = ul_elem.nextSibling;

            if (updateAction < 1) {
                // for delete, we'll need to identify the tab to update.
                li_elem = ul_elem.firstChild;
                while (li_elem) {
                    index = li_elem.className.indexOf('ruleset-');
                    if (index !== -1) {
                        id = li_elem.className.substring(index + 8);
                        index = id.indexOf(" ");
                        if (index !== -1) {
                            id = id.substring(0, index);
                        }
                        if (ruleset.id === id) {
                            index = li_elem.id.indexOf('label');
                            if (index !== -1) {
                                tab_id = li_elem.id.substring(index + 5);
                                if (li_elem.className.indexOf('selected') !== -1) {
                                    // the tab we're removing is the selected tab, select the last non-header tab.
                                    event = {};
                                    event.currentTarget = prev_li_elem;
                                    doc.ysview.onclickRuleset(event);
                                }
                                // check if we are removing the last custom ruleset.
                                if (li_elem.previousSibling && li_elem.previousSibling.id === 'custom-set-title' && li_elem.nextSibling && li_elem.nextSibling.id === 'create-ruleset') {
                                    custom_set_title = li_elem.previousSibling;
                                }
                                ul_elem.removeChild(li_elem);
                                if (custom_set_title) {
                                    ul_elem.removeChild(custom_set_title);
                                }
                            }
                            break;
                        } else {
                            prev_li_elem = li_elem;
                        }
                    }
                    li_elem = li_elem.nextSibling;
                }
            } else {
                li_elem = ul_elem.lastChild;
                while (li_elem) {
                    idx = li_elem.id.indexOf('label');
                    if (idx !== -1) {
                        label_id = li_elem.id.substring(idx + 5);
                        break;
                    }
                    li_elem = li_elem.previousSibling;
                }

                label_id = Number(label_id) + 1;
                li_elem = doc.createElement('li');
                li_elem.className = 'ruleset-' + ruleset.id;
                li_elem.id = 'label' + label_id;
                li_elem.onclick = function (event) {
                    doc.ysview.onclickRuleset(event);
                };
                li_elem.innerHTML = '<a href="#tab' + label_id + '">' + ruleset.name + '</a>';
                ul_elem.insertBefore(li_elem, ul_elem.lastChild); // lastChild is the "New Set" button.
                header = ul_elem.firstChild;
                while (header) {
                    if (header.id && header.id === 'custom-set-title') {
                        custom_set_title = header;
                        break;
                    }
                    header = header.nextSibling;
                }
                if (!custom_set_title) {
                    custom_set_title = doc.createElement('li');
                    custom_set_title.className = 'new-section header';
                    custom_set_title.id = 'custom-set-title';
                    custom_set_title.innerHTML = 'CUSTOM SETS';
                    ul_elem.insertBefore(custom_set_title, li_elem);
                }

                if (updateSelection) {
                    event2 = {};
                    event2.currentTarget = li_elem;
                    doc.ysview.onclickRuleset(event2);
                }
            }
        }

    },

    /**
     * @private
     * Helper function to find if name is in class_name.
     * @param {String} class_name
     * @param {String} name
     * @return true if name is a substring of class_name, false otherwise.
     * @type Boolean
     */
    hasClassName: function (class_name, name) {
        var i,
            arr_class = class_name.split(" ");

        if (arr_class) {
            for (i = 0; i < arr_class.length; i += 1) {
                if (arr_class[i] === name) {
                    return true;
                }
            }
        }

        return false;
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Expand or collapse the rows in components table that matches type.
     * @param {Document} doc Document object of YSlow Chrome Window.
     * @param {HTMLElement} table table element
     * @param {String} type component type of the rows to be expanded or collapsed
     * @param {Boolean} expand true to expand, false to collapse. This can be undefined.
     * @param {Boolean} all true to expand/collapse all, can be undefined.
     */
    expandCollapseComponentType: function (doc, table, type, expand, all) {
        var hiding, i, j, do_all, row, span, names, header, className, len,
            expandAllDiv, elems, expandAllText, checkExpand,
            hasClass = this.hasClassName,
            summary = {
                expand: 0,
                collapse: 0
            };

        if (typeof all === "boolean" && all === true) {
            do_all = true;
        }

        if (table) {
            for (i = 0, len = table.rows.length; i < len; i += 1) {
                row = table.rows[i];
                className = row.className;
                if (hasClass(className, 'type-summary')) {
                    if (hasClass(className, 'expand')) {
                        summary.expand += 1;
                        hiding = false;
                    } else if (hasClass(className, 'collapse')) {
                        summary.collapse += 1;
                        hiding = true;
                    }
                    span = row.getElementsByTagName('span')[0];
                    if (do_all || hasClass(span.className, 'type-' + type)) {
                        if (do_all) {
                            names = span.className.split(' ');
                            for (j = 0; j < names.length; j += 1) {
                                if (names[j].substring(0, 5) === 'type-') {
                                    type = names[j].substring(5);
                                }
                            }
                        }
                        if (typeof hiding !== "boolean" || (typeof expand === "boolean" && expand === hiding)) {
                            if (do_all) {
                                hiding = !expand;
                                continue;
                            } else {
                                return;
                            }
                        }
                        YSLOW.view.removeClassName(row, (hiding ? 'collapse' : 'expand'));
                        row.className += (hiding ? ' expand' : ' collapse');
                        if (hiding) {
                            summary.collapse -= 1;
                            summary.expand += 1;
                        } else {
                            summary.collapse += 1;
                            summary.expand -= 1;
                        }
                    }
                } else if (hasClass(className, 'type-' + type)) {
                    if (hiding) {
                        row.style.display = "none";
                        // next sibling should be its header, collapse it too.
                        header = row.nextSibling;
                        if (header.id.indexOf('compHeaders') !== -1) {
                            header.style.display = "none";
                        }
                    } else {
                        row.style.display = "table-row";
                    }
                }
            }
        }

        // now check all type and see if we need to toggle "expand all" and "collapse all".
        if (summary.expand === 0 || summary.collapse === 0) {
            expandAllDiv = table.parentNode.previousSibling;
            if (expandAllDiv) {
                elems = expandAllDiv.getElementsByTagName('span');
                for (i = 0; i < elems.length; i += 1) {
                    if (elems[i].id === "expand-all-text") {
                        expandAllText = elems[i];
                    }
                }

                checkExpand = false;

                if (expandAllText.innerHTML.indexOf('Expand') !== -1) {
                    checkExpand = true;
                }

                // toggle
                if (checkExpand) {
                    if (summary.expand === 0) {
                        expandAllText.innerHTML = 'Collapse All';
                    }
                } else if (summary.collapse === 0) {
                    expandAllText.innerHTML = 'Expand All';
                }
            }
        }
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Expand all component rows in components table.
     * @param {Document} doc Document object of YSlow Chrome Window.
     * @param {HTMLElement} table table element
     */
    expandAllComponentType: function (doc, table) {
        var elem, i,
            expand = false,
            expandAllDiv = table.parentNode.previousSibling,
            elems = expandAllDiv.getElementsByTagName('span');

        for (i = 0; i < elems.length; i += 1) {
            if (elems[i].id === "expand-all-text") {
                elem = elems[i];
            }
        }
        if (elem) {
            if (elem.innerHTML.indexOf('Expand') !== -1) {
                expand = true;
            }
        }

        this.expandCollapseComponentType(doc, table, undefined, expand, true);

        if (elem) {
            elem.innerHTML = (expand ? 'Collapse All' : 'Expand All');
        }
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Regenerate Components Table.
     * @param {Document} doc Document object of YSlow Chrome Window
     * @param {HTMLElement} table table element
     * @param {String} column_name Column to sort by
     * @param {Boolean} sortDesc true if sort descending order, false otherwise
     * @param {YSlow.ComponentSet} cset ComponentSet object
     */
    regenComponentsTable: function (doc, table, column_name, sortDesc, cset) {
        var show, elem, tableHtml;

        if (table) {
            if (sortDesc === undefined) {
                sortDesc = false;
            }
            // hide or show expand-all
            if (column_name === "type") {
                show = true;
            }
            elem = table.parentNode.previousSibling;
            if (elem.id === 'expand-all') {
                elem.style.visibility = (show ? 'visible' : 'hidden');
            }

            tableHtml = this.genComponentsTable(cset.components, column_name, sortDesc);
            table.parentNode.innerHTML = tableHtml;
        }
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Save Ruleset.
     * @param {Document} doc Document Object of YSlow Chrome Window
     * @param {HTMLElement} form Form element
     */
    saveRuleset: function (doc, form) {
        var i, elem, index, id, saveas_name, ruleset_name, ruleset_id, rules,
            ruleset = {},
            weights = {};

        if (form) {
            ruleset.custom = true;
            ruleset.rules = {};
            ruleset.weights = {};

            for (i = 0; i < form.elements.length; i += 1) {
                elem = form.elements[i];

                // build out ruleset object with the form elements.
                if (elem.name === 'rules' && elem.type === 'checkbox') {
                    if (elem.checked) {
                        ruleset.rules[elem.value] = {};
                    }
                } else if (elem.name === 'saveas-name') {
                    saveas_name = elem.value;
                } else if (elem.name === 'ruleset-name') {
                    ruleset_name = elem.value;
                } else if (elem.name === 'ruleset-id') {
                    ruleset_id = elem.value;
                } else if ((index = elem.name.indexOf('weight-')) !== -1) {
                    weights[elem.name.substring(index)] = elem.value;
                }
            }
            rules = ruleset.rules;
            for (id in rules) {
                if (rules.hasOwnProperty(id) && weights['weight-' + id]) {
                    ruleset.weights[id] = parseInt(weights['weight-' + id], 10);
                }
            }

            if (saveas_name) {
                ruleset.id = saveas_name.replace(/\s/g, "-");
                ruleset.name = saveas_name;
            } else {
                ruleset.id = ruleset_id;
                ruleset.name = ruleset_name;
            }

            // register ruleset
            if (ruleset.id && ruleset.name) {
                YSLOW.controller.addRuleset(ruleset, true);

                // save to pref
                YSLOW.controller.saveRulesetToPref(ruleset);

                // update UI
                if (saveas_name !== undefined) {
                    this.updateRulesetUI(doc, form, ruleset, 1);
                }
            }
        }
    },

    updateRulesetUI: function (doc, form, ruleset, updateAction) {
        var i, forms = doc.getElementsByTagName('form');

        for (i = 0; i < forms.length; i += 1) {
            if (forms[i].id === form.id) {
                this.rulesetEditUpdateTab(doc, forms[i], ruleset, updateAction, (forms[i] === form));
            }
        }
        doc.ysview.updateRulesetList();
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Delete the current selected ruleset in Ruleset settings screen.
     * @param {Document} doc Document object of YSlow Chrome Window.
     * @param {HTMLElement} form Form element
     */
    deleteRuleset: function (doc, form) {
        var ruleset_id = this.getEditFormRulesetId(form),
            ruleset = YSLOW.controller.removeRuleset(ruleset_id);

        if (ruleset && ruleset.custom) {
            // remove from pref
            YSLOW.controller.deleteRulesetFromPref(ruleset);

            // update UI
            this.updateRulesetUI(doc, form, ruleset, -1);
        }
    },

    /**
     * @member YSLOW.HTMLRenderer
     * Get form id from Ruleset Settings screen.
     * @param {DOMElement} form Form element
     */
    getEditFormRulesetId: function (form) {
        var i,
            aInputs = form.getElementsByTagName('input');

        for (i = 0; i < aInputs.length; i += 1) {
            if (aInputs[i].name === 'ruleset-id') {
                return aInputs[i].value;
            }
        }

        return undefined;
    }

});

YSLOW.registerRenderer({
    /**
     * @member YSLOW.XMLRenderer
     * @final
     */
    id: 'xml',
    /**
     * @member YSLOW.XMLRenderer
     * @final
     */
    supports: {
        components: 1,
        reportcard: 1,
        stats: 1
    },

    /**
     * @member YSLOW.XMLRenderer
     * Generate XML code for Components tab
     * @param {Array} comps  array of components
     * @param {Number} totalSize total page size
     * @return XML code for Components tab
     * @type String
     */
    componentsView: function (comps, totalSize) {
        var i, cookieSize,
            sText = '<components>';

        for (i = 0; i < comps.length; i += 1) {
            sText += '<component>';
            sText += '<type>' + comps[i].type + '</type>';
            sText += '<size>' + comps[i].size + '</size>';
            if (comps[i].compressed === false) {
                sText += '<gzip/>';
            } else {
                sText += '<gzip>' + (comps[i].size_compressed !== undefined ? parseInt(comps[i].size_compressed, 10) : 'uncertain') + '</gzip>';
            }
            cookieSize = comps[i].getSetCookieSize();
            if (cookieSize > 0) {
                sText += '<set-cookie>' + parseInt(cookieSize, 10) + '</set-cookie>';
            }
            cookieSize = comps[i].getReceivedCookieSize();
            if (cookieSize > 0) {
                sText += '<cookie>' + parseInt(cookieSize, 10) + '</cookie>';
            }
            sText += '<url>' + encodeURI(comps[i].url) + '</url>';
            sText += '<expires>' + comps[i].expires + '</expires>';
            sText += '<resptime>' + comps[i].respTime + '</resptime>';
            sText += '<etag>' + comps[i].getEtag() + '</etag>';
            sText += '</component>';
        }
        sText += '</components>';
        return sText;
    },

    /**
     * @member YSLOW.XMLRenderer
     * Generate XML code for Grade tab
     * @param {YSlow.ResultSet} resultset object containing result.
     * @return xml code for Grades tab
     * @type String
     */
    reportcardView: function (resultset) {
        var i, j, result,
            overall_score = resultset.getOverallScore(),
            overall_grade = YSLOW.util.prettyScore(overall_score),
            appliedRuleset = resultset.getRulesetApplied(),
            results = resultset.getResults(),
            sText = '<performance ruleset="' + appliedRuleset.name + '" url="' + resultset.url + '">';

        sText += '<overall grade="' + overall_grade + '" score="' + overall_score + '" />';

        for (i = 0; i < results.length; i += 1) {
            result = results[i];

            sText += '<lints id="' + result.rule_id + '" ruletext="' + result.name + '" hreftext="' + YSLOW.controller.getRule(result.rule_id).url + '" grade="' + YSLOW.util.prettyScore(result.score) + '" score="' + result.score + '" category="' + result.category.join(',') + '">';

            sText += '<message>' + result.message + '</message>';
            if (results.components && results.components.length > 0) {
                sText += '<offenders>';
                for (j = 0; j < result.components.length; j += 1) {
                    if (typeof result.components[j] === "string") {
                        sText += '<offender>' + result.components[j] + '</offender>';
                    } else if (result.components[j].url !== undefined) {
                        sText += '<offender>' + result.components[j].url + '</offender>';
                    }
                }
                sText += '</offenders>';
            }
            sText += '</lints>';
        }
        sText += '</performance>';
        return sText;
    },

    /**
     * @member YSLOW.XMLRenderer
     * Generate XML code for Stats tab
     * @param {Object} stats page stats
     * <ul>
     * <li><code>PAGE.totalObjCountPrimed</code> a hash of components count group by type (primed cache)</li>
     * <li><code>PAGE.totalObjSizePrimed</code> a hash of components size group by type (primed cache)</li>
     * <li><code>PAGE.totalObjRequestsPrimed</code> total number of requests (primed cache)</li>
     * <li><code>PAGE.totalSizePrimed</code> total size of all components (primed cache)</li>
     * <li><code>PAGE.totalObjCount</code> a hash of components count group by type (empty cache)</li>
     * <li><code>PAGE.totalObjSize</code> a hash of components size group by type (empty cache)</li>
     * <li><code>PAGE.totalObjRequests</code> total number of requests (empty cache)</li>
     * <li><code>PAGE.totalSize</code> total size of all components (empty cache)</li>
     * </ul>
     * @return xml code for Stats tab
     * @type String
     */
    statsView: function (stats) {
        var i, sType, sText,
            primed_cache_items = '<items type="primedCache">',
            empty_cache_items = '<items type="emptyCache">',
            aTypes = YSLOW.peeler.types;

        for (i = 0; i < aTypes.length; i += 1) {
            sType = aTypes[i];
            if ((stats.PAGE.totalObjCountPrimed[sType]) !== undefined) {
                primed_cache_items += '<item type="' + sType + '" count="' + stats.PAGE.totalObjCountPrimed[sType] + '" size="' + stats.PAGE.totalObjSizePrimed[sType] + '" />';
            }
            if ((stats.PAGE.totalObjCount[sType]) !== undefined) {
                empty_cache_items += '<item type="' + sType + '" count="' + stats.PAGE.totalObjCount[sType] + '" size="' + stats.PAGE.totalObjSize[sType] + '" />';
            }
        }
        primed_cache_items += '</items>';
        empty_cache_items += '</items>';

        sText = '<stats numRequests="' + stats.PAGE.totalRequests + '" totalSize="' + stats.PAGE.totalSize + '" numRequests_p="' + stats.PAGE.totalRequestsPrimed + '" totalSize_p="' + stats.PAGE.totalSizePrimed + '">' + primed_cache_items + empty_cache_items + '</stats>';

        return sText;
    }
});
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/
/*jslint white: true, onevar: true, undef: true, newcap: true, nomen: true, plusplus: true, bitwise: true, continue: true, maxerr: 50, indent: 4 */

/**
 * @todo:
 * - need better way to discover @import stylesheets, the current one doesn't find them
 * - add request type - post|get - when possible, maybe in the net part of the peeling process
 *
 */

/**
 * Peeler singleton
 * @class
 * @static
 */
YSLOW.peeler = {

    /**
     * @final
     */
    types: ['doc', 'js', 'css', 'iframe', 'flash', 'cssimage', 'image',
        'favicon', 'xhr', 'redirect', 'font'],

    NODETYPE: {
        ELEMENT: 1,
        DOCUMENT: 9
    },

/*
     * http://www.w3.org/TR/DOM-Level-2-Style/css.html#CSS-CSSRule
     */
    CSSRULE: {
        IMPORT_RULE: 3,
        FONT_FACE_RULE: 5
    },

    /**
     * Start peeling the document in passed window object.
     * The component may be requested asynchronously.
     *
     * @param {DOMElement} node object
     * @param {Number} onloadTimestamp onload timestamp
     * @return ComponentSet
     * @type YSLOW.ComponentSet
     */
    peel: function (node, onloadTimestamp) {
        // platform implementation goes here
    },

    /**
     * @private
     * Finds all frames/iframes recursively
     * @param {DOMElement} node object
     * @return an array of documents in the passed DOM node.
     * @type Array
     */
    findDocuments: function (node) {
        var frames, doc, docUrl, type, i, len, el, frameDocs, parentDoc,
            allDocs = {};

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 1,
            'message': 'Finding documents'
        });

        if (!node) {
            return;
        }

        // check if frame digging was disabled, if so, return the top doc and return.
        if (!YSLOW.util.Preference.getPref('extensions.yslow.getFramesComponents', true)) {
            allDocs[node.URL] = {
                'document': node,
                'type': 'doc'
            };
            return allDocs;
        }

        type = 'doc';
        if (node.nodeType === this.NODETYPE.DOCUMENT) {
            // Document node
            doc = node;
            docUrl = node.URL;
        } else if (node.nodeType === this.NODETYPE.ELEMENT &&
                node.nodeName.toLowerCase() === 'frame') {
            // Frame node
            doc = node.contentDocument;
            docUrl = node.src;
        } else if (node.nodeType === this.NODETYPE.ELEMENT &&
                node.nodeName.toLowerCase() === 'iframe') {
            doc = node.contentDocument;
            docUrl = node.src;
            type = 'iframe';
            try {
                parentDoc = node.contentWindow;
                parentDoc = parentDoc && parentDoc.parent;
                parentDoc = parentDoc && parentDoc.document;
                parentDoc = parentDoc || node.ownerDocument;
                if (parentDoc && parentDoc.URL === docUrl) {
                    // check attribute
                    docUrl = !node.getAttribute('src') ? '' : 'about:blank';
                }
            } catch (err) {
                YSLOW.util.dump(err);
            }
        } else {
            return allDocs;
        }
        allDocs[docUrl] = {
            'document': doc,
            'type': type
        };

        try {
            frames = doc.getElementsByTagName('iframe');
            for (i = 0, len = frames.length; i < len; i += 1) {
                el = frames[i];
                if (el.src) {
                    frameDocs = this.findDocuments(el);
                    if (frameDocs) {
                        allDocs = YSLOW.util.merge(allDocs, frameDocs);
                    }
                }
            }

            frames = doc.getElementsByTagName('frame');
            for (i = 0, len = frames.length; i < len; i += 1) {
                el = frames[i];
                frameDocs = this.findDocuments(el);
                if (frameDocs) {
                    allDocs = YSLOW.util.merge(allDocs, frameDocs);
                }
            }
        } catch (e) {
            YSLOW.util.dump(e);
        }

        return allDocs;
    },

    /**
     * @private
     * Find all components in the passed node.
     * @param {DOMElement} node DOM object
     * @param {String} doc_location document.location
     * @param {String} baseHref href
     * @return array of object (array[] = {'type': object.type, 'href': object.href } )
     * @type Array
     */
    findComponentsInNode: function (node, baseHref, type) {
        var comps = [];
        
        try {
            comps = this.findStyleSheets(node, baseHref);
        } catch (e1) {
            YSLOW.util.dump(e1);
        }
        try {
            comps = comps.concat(this.findScripts(node));
        } catch (e2) {
            YSLOW.util.dump(e2);
        }
        try {
            comps = comps.concat(this.findFlash(node));
        } catch (e3) {
            YSLOW.util.dump(e3);
        }
        try {
            comps = comps.concat(this.findCssImages(node));
        } catch (e4) {
            YSLOW.util.dump(e4);
        }
        try {
            comps = comps.concat(this.findImages(node));
        } catch (e5) {
            YSLOW.util.dump(e5);
        }
        try {
            if (type === 'doc') {
                comps = comps.concat(this.findFavicon(node, baseHref));
            }
        } catch (e6) {
            YSLOW.util.dump(e6);
        }
        
        return comps;
    },

    /**
     * @private
     * Add components in Net component that are not component list found by
     * peeler. These can be xhr requests or images that are preloaded by
     * javascript.
     *
     * @param {YSLOW.ComponentSet} component_set ComponentSet to be checked
     * against.
     * @param {String} base_herf base href
     */
    addComponentsNotInNode: function (component_set, base_href) {
        var i, j, imgs, type, objs,
            types = ['flash', 'js', 'css', 'doc', 'redirect'],
            xhrs = YSLOW.net.getResponseURLsByType('xhr');

        // Now, check net module for xhr component.
        if (xhrs.length > 0) {
            for (j = 0; j < xhrs.length; j += 1) {
                component_set.addComponent(xhrs[j], 'xhr', base_href);
            }
        }

        // check image beacons
        imgs = YSLOW.net.getResponseURLsByType('image');
        if (imgs.length > 0) {
            for (j = 0; j < imgs.length; j += 1) {
                type = 'image';
                if (imgs[j].indexOf("favicon.ico") !== -1) {
                    type = 'favicon';
                }
                component_set.addComponentNoDuplicate(imgs[j], type, base_href);
            }
        }

        // should we check other types?
        for (i = 0; i < types.length; i += 1) {
            objs = YSLOW.net.getResponseURLsByType(types[i]);
            for (j = 0; j < objs.length; j += 1) {
                component_set.addComponentNoDuplicate(objs[j], types[i], base_href);
            }
        }
    },

    /**
     * @private
     * Find all stylesheets in the passed DOM node.
     * @param {DOMElement} node DOM object
     * @param {String} doc_location document.location
     * @param {String} base_href base href
     * @return array of object (array[] = {'type' : 'css', 'href': object.href})
     * @type Array
     */
    findStyleSheets: function (node, baseHref) {
        var styles, style, i, len,
            head = node.getElementsByTagName('head')[0],
            body = node.getElementsByTagName('body')[0],
            comps = [],
            that = this,

            loop = function (els, container) {
                var i, len, el, href, cssUrl;

                for (i = 0, len = els.length; i < len; i += 1) {
                    el = els[i];
                    href = el.href || el.getAttribute('href');
                    if (href && (el.rel === 'stylesheet' ||
                            el.type === 'text/css')) {
                        comps.push({
                            type: 'css',
                            href: href === node.URL ? '' : href,
                            containerNode: container
                        });
                        cssUrl = YSLOW.util.makeAbsoluteUrl(href, baseHref);
                        comps = comps.concat(that.findImportedStyleSheets(el.sheet, cssUrl));
                    }
                }
            };

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 2,
            'message': 'Finding StyleSheets'
        });

        if (head || body) {
            if (head) {
                loop(head.getElementsByTagName('link'), 'head');
            }
            if (body) {
                loop(body.getElementsByTagName('link'), 'body');
            }
        } else {
            loop(node.getElementsByTagName('link'));
        }

        styles = node.getElementsByTagName('style');
        for (i = 0, len = styles.length; i < len; i += 1) {
            style = styles[i];
            comps = comps.concat(that.findImportedStyleSheets(style.sheet, baseHref));
        }

        return comps;
    },

    /**
     * @private
     * Given a css rule, if it's an "@import" rule then add the style sheet
     * component. Also, do a recursive check to see if this imported stylesheet
     * itself contains an imported stylesheet. (FF only)
     * @param {DOMElement} stylesheet DOM stylesheet object
     * @return array of object
     * @type Array
     */
    findImportedStyleSheets: function (styleSheet, parentUrl) {
        var i, rules, rule, cssUrl, ff, len,
            reFile = /url\s*\(["']*([^"'\)]+)["']*\)/i,
            comps = [];

        try {
            if (!(rules = styleSheet.cssRules)) {
                return comps;
            }
            for (i = 0, len = rules.length; i < len; i += 1) {
                rule = rules[i];
                if (rule.type === YSLOW.peeler.CSSRULE.IMPORT_RULE && rule.styleSheet && rule.href) {
                    // It is an imported stylesheet!
                    comps.push({
                        type: 'css',
                        href: rule.href,
                        base: parentUrl
                    });
                    // Recursively check if this stylesheet itself imports any other stylesheets.
                    cssUrl = YSLOW.util.makeAbsoluteUrl(rule.href, parentUrl);
                    comps = comps.concat(this.findImportedStyleSheets(rule.styleSheet, cssUrl));
                } else if (rule.type === YSLOW.peeler.CSSRULE.FONT_FACE_RULE) {
                    if (rule.style && typeof rule.style.getPropertyValue === 'function') {
                        ff = rule.style.getPropertyValue('src');
                        ff = reFile.exec(ff);
                        if (ff) {
                            ff = ff[1];
                            comps.push({
                                type: 'font',
                                href: ff,
                                base: parentUrl
                            });
                        }
                    }
                } else {
                    break;
                }
            }
        } catch (e) {
            YSLOW.util.dump(e);
        }

        return comps;
    },

    /**
     * @private
     * Find all scripts in the passed DOM node.
     * @param {DOMElement} node DOM object
     * @return array of object (array[] = {'type': 'js', 'href': object.href})
     * @type Array
     */
    findScripts: function (node) {
        var comps = [],
            head = node.getElementsByTagName('head')[0],
            body = node.getElementsByTagName('body')[0],

            loop = function (scripts, container) {
                var i, len, script, type, src;

                for (i = 0, len = scripts.length; i < len; i += 1) {
                    script = scripts[i];
                    type = script.type;
                    if (type &&
                            type.toLowerCase().indexOf('javascript') < 0) {
                        continue;
                    }
                    src = script.src || script.getAttribute('src');
                    if (src) {
                        comps.push({
                            type: 'js',
                            href: src === node.URL ? '' : src,
                            containerNode: container
                        });
                    }
                }
            };

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 3,
            'message': 'Finding JavaScripts'
        });

        if (head || body) {
            if (head) {
                loop(head.getElementsByTagName('script'), 'head');
            }
            if (body) {
                loop(body.getElementsByTagName('script'), 'body');
            }
        } else {
            loop(node.getElementsByTagName('script'));
        }

        return comps;
    },

    /**
     * @private
     * Find all flash in the passed DOM node.
     * @param {DOMElement} node DOM object
     * @return array of object (array[] =  {'type' : 'flash', 'href': object.href } )
     * @type Array
     */
    findFlash: function (node) {
        var i, el, els, len,
            comps = [];

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 4,
            'message': 'Finding Flash'
        });

        els = node.getElementsByTagName('embed');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            if (el.src) {
                comps.push({
                    type: 'flash',
                    href: el.src
                });
            }
        }

        els = node.getElementsByTagName('object');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            if (el.data && el.type === 'application/x-shockwave-flash') {
                comps.push({
                    type: 'flash',
                    href: el.data
                });
            }
        }

        return comps;
    },

    /**
     * @private
     * Find all css images in the passed DOM node.
     * @param {DOMElement} node DOM object
     * @return array of object (array[] = {'type' : 'cssimage', 'href': object.href } )
     * @type Array
     */
    findCssImages: function (node) {
        var i, j, el, els, prop, url, len,
            comps = [],
            hash = {},
            props = ['backgroundImage', 'listStyleImage', 'content', 'cursor'],
            lenJ = props.length;

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 5,
            'message': 'Finding CSS Images'
        });

        els = node.getElementsByTagName('*');
        for (i = 0, len = els.length; i < len; i += 1) {
            el = els[i];
            for (j = 0; j < lenJ; j += 1) {
                prop = props[j];
                url = YSLOW.util.getComputedStyle(el, prop, true);
                if (url && !hash[url]) {
                    comps.push({
                        type: 'cssimage',
                        href: url
                    });
                    hash[url] = 1;
                }
            }
        }

        return comps;
    },

    /**
     * @private
     * Find all images in the passed DOM node.
     * @param {DOMElement} node DOM object
     * @return array of object (array[] = {'type': 'image', 'href': object.href} )
     * @type Array
     */
    findImages: function (node) {
        var i, img, imgs, src, len,
            comps = [],
            hash = {};

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 6,
            'message': 'Finding Images'
        });

        imgs = node.getElementsByTagName('img');
        for (i = 0, len = imgs.length; i < len; i += 1) {
            img = imgs[i];
            src = img.src;
            if (src && !hash[src]) {
                comps.push({
                    type: 'image',
                    href: src,
                    obj: {
                        width: img.width,
                        height: img.height
                    }
                });
                hash[src] = 1;
            }
        }

        return comps;
    },

    /**
     * @private
     * Find favicon link.
     * @param {DOMElement} node DOM object
     * @return array of object (array[] = {'type': 'favicon', 'href': object.href} )
     * @type Array
     */
    findFavicon: function (node, baseHref) {
        var i, len, link, links, rel,
            comps = [];

        YSLOW.util.event.fire('peelProgress', {
            'total_step': 7,
            'current_step': 7,
            'message': 'Finding favicon'
        });

        links = node.getElementsByTagName('link');
        for (i = 0, len = links.length; i < len; i += 1) {
            link = links[i];
            rel = (link.rel || '').toLowerCase(); 
            if (link.href && (rel === 'icon' ||
                rel === 'shortcut icon')) {
                comps.push({
                    type: 'favicon',
                    href: link.href
                });
            }
        }

        // add default /favicon.ico if none informed
        if (!comps.length) {
            comps.push({
                type: 'favicon',
                href: YSLOW.util.makeAbsoluteUrl('/favicon.ico', baseHref)
            });
        }

        return comps;
    },

    /**
     * @private
     * Get base href of document.  If <base> element is not found, use doc.location.
     * @param {Document} doc Document object
     * @return base href
     * @type String
     */
    getBaseHref: function (doc) {
        var base;
        
        try {
            base = doc.getElementsByTagName('base')[0];
            base = (base && base.href) || doc.URL; 
        } catch (e) {
            YSLOW.util.dump(e);
        }

        return base;
    }
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YSLOW*/

YSLOW.peeler.peel = function (node) {
    var url, docs, doc, doct, baseHref,
        comps = [];

    try {
        // Find all documents in the window.
        docs = this.findDocuments(node);

        for (url in docs) {
            if (docs.hasOwnProperty(url)) {
                doc = docs[url];
                if (doc) {
                    // add the document.
                    comps.push({
                        type: doc.type,
                        href: url
                    });

                    doct = doc.document;
                    if (doct && url) {
                        baseHref = this.getBaseHref(doct);
                        comps = comps.concat(this.findComponentsInNode(doct,
                            baseHref, doc.type));
                    }
                }
            }
        }
    } catch (err) {
        YSLOW.util.dump(err);
        YSLOW.util.event.fire('peelError', {
            'message': err
        });
    }

    return comps;
};
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YUI*/

YUI.add('yslow-config', function (Y) {
    Y.namespace('YSLOW').config = {
        /* make sure host has trailing slash */
        host: 'http://localhost:8000/',
        //host: 'http://secondbelong-lm.corp.yahoo.com:8000/',
        /* do no include scheme nor colon and double slashes */
        /* comment out to use the default provided by YUI YQL */
        //yql: 'staging.query.yahooapis.com/v1/public/yql?',
        /* yql opentable url */
        /* comment out to use the default YQL community table data.headers */
        //table: 'http://sandbox.javascriptrules.com/yql/data.headers.xml',
        js: 'yslow-bookmarklet.js',
        css: 'yslow-style.css'
    };
});
/**
 * Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2013, Marcel Duran and other contributors. All rights reserved.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global YUI, YSLOW*/
/*jslint white: true, onevar: true, undef: true, newcap: true, nomen: true, regexp: true, plusplus: true, bitwise: true, continue: true, browser: true, maxerr: 50, indent: 4 */

YUI().use(function (iY) {
    var sbY = YUI({
        win: window,
        doc: document
    });

    // sandbox YUI
    iY.Get.script = function () {
        return sbY.Get.script.apply(sbY, arguments);
    };

    iY.use('features', 'node-base', 'node-style', 'yql', 'jsonp-url', 'yslow-config', function (Y) {
        var 
            iwin, idoc, fetchCount, fetchTotal, iframeNode,

            win = Y.config.win,
            doc = Y.config.doc,
            config = Y.namespace('YSLOW').config,
            arrayEach = Y.Array.each,
            objEach = Y.Object.each,
            encode = win.encodeURIComponent,

            URL_MAX_LEN = Y.UA.ie && Y.UA.ie < 7 ? 1800 : 6000,
            YQL_REQ_TABLE = config.table ? 'use "' + config.table + '";' : '',
            YQL_REQ_URL_LEN = 230 + encode(YQL_REQ_TABLE).length,
            YQL_REQ_SEP_LEN = 9, //%22%2C%22 = ","
            YQL_REQ_UA = win.navigator.userAgent,
            YQL_REQ_UA_LEN = encode('"' + YQL_REQ_UA + '"').length,

            yscontext = new YSLOW.context(doc),
            reIgnore = /^(chrome\-extension|data|chrome|javascript|about|resource|jar|file):/i,
            iframe = Y.one('#YSLOW-bookmarklet');

        if (config.yql) {
            Y.YQLRequest.BASE_URL = ':/' + '/' + config.yql;
        }

        // init YSlow iframe
        YSLOW.bookmarklet = true;
        iframeNode = Y.Node.getDOMNode(iframe);
        iframeNode.style.cssText = 'display:block;background:#fff;' +
            'border:1px solid #000;position:fixed;bottom:0;left:0;height:50%;' +
            'width:100%;z-index:2147483647;_position:absolute;_height:350px;';
        iwin = iframeNode.contentWindow;
        idoc = iwin.document;
        idoc.body.innerHTML = '<div style="display:none;" id="yslowDiv"></div>';
        iwin.panelNode = idoc.getElementById('yslowDiv');

        // make mobile viewport wider
        if (Y.one('meta[name=viewport]')) {
            iframe.setStyles({
                position: 'absolute',
                width: '974px'
            });
        }

        // make YSLOW compatible
        YSLOW.controller.init();
        idoc.ysview = new YSLOW.view(iwin, yscontext);
        idoc.yslowContext = yscontext;

        function closeYSlow(e) {
            e.preventDefault();
            try {
                delete win.YSLOW;
            } catch (err) {
                win.YSLOW = null;
            }
            iframe.remove();
        }

        function fullScreen(e) {
            var target = e.target.ancestor('li', true),
                fs = target.hasClass('restore');

            e.preventDefault();
            iframe.setStyle('height', (fs ? 50 : 100) + '%');
            target.toggleClass('restore');
        }

        // YUI control for YSLOW inside an iframe
        YUI({win: iwin, doc: idoc}).use('features', 'node-base', 'node-style', function (iY) {
            var create = iY.Node.create,
                closeBtn = create('<li id="fsClose"><a href="#">' +
                    '<b class="icon">X</b><em>Close</em></a></li>'),
                fsBtn = create('<li id="fsLink"><a href="#">' +
                    '<b class="icon exp">&and;</b><em class="exp">Expand</em>' +
                    '<b class="icon res">&or;</b><em class="res">Restore</em>' +
                    '</a></li>');

            iY.Get.css(config.host + config.css);
            closeBtn.on('click', closeYSlow);
            fsBtn.on('click', fullScreen);
            // start in fullscreen mode on mobile, but ipad
            if (Y.UA.mobile) {
                if (!Y.UA.ipad) {
                    fsBtn.addClass('restore');
                    iframe.setStyle('height', '100%');
                } else {
                    iframe.setStyle('width', '100%');
                }
            }
            iY.one('#tbActions').insert(fsBtn, 1);
            iY.one('#tbActions').append(closeBtn);

            // remove buttons
            // TODO: put them back once tools are working
            iY.one('#ysToolButton').remove();
            iY.one('#printLink').remove();
        });
        
        function buildComponentSet(comps) {
            var i, comp, len,
                baseHref = YSLOW.peeler.getBaseHref(doc),
                cset = new YSLOW.ComponentSet(doc);

            for (i = 0, len = comps.length; i < len; i += 1) {
                comp = comps[i];
                cset.addComponent(comp.href, comp.type,
                    comp.base ? comp.base : baseHref, {
                        obj: comp.obj,
                        component: comp,
                        comp: comp
                    });
            }

            return cset;
        }

        function breakDownUrls(urls) {
            var len = YQL_REQ_URL_LEN + YQL_REQ_UA_LEN,
                chunk = [],
                res = [];

            arrayEach(urls, function (url) {
                len += encode(url).length + YQL_REQ_SEP_LEN;
                if (len <= URL_MAX_LEN || !chunk.length) {
                    chunk.push(url);
                } else {
                    res.push('"' + chunk.join('","') + '"');
                    len = YQL_REQ_URL_LEN + YQL_REQ_UA_LEN +
                        encode(url).length + YQL_REQ_SEP_LEN;
                    chunk = [url];
                }
            });
            res.push('"' + chunk.join('","') + '"');

            return res;
        }

        function peelDone(cset) {
            YSLOW.util.event.fire('componentFetchProgress', {
                'total': fetchTotal + 2,
                'current': fetchTotal + 2,
                'last_component_url': 'Done'
            });
            yscontext.component_set = cset;
            YSLOW.util.event.fire('peelComplete', {
                'component_set': cset
            });
            cset.notifyPeelDone();
        }

        // set cookies for components in the same domain as main document
        function setSameDomainCookies(cset) {
            var i, len, comp,
                getHostname = YSLOW.util.getHostname,
                docDomain = getHostname(cset.doc_comp.url),
                comps = cset.components,
                cookies = cset.cookies;

            for (i = 0, len = comps.length; i < len; i += 1) {
                comp = comps[i];
                if (getHostname(comp.url) === docDomain &&
                        comp.cookie.length < cookies.length) {
                    comp.cookie = cookies;
                } 
            }
        }

        function showError() {
            idoc.ysview.openDialog(idoc, 400, 150,
                'Ooops! An error occured fetching page components. ' +
                'Plese try again.', null, 'OK', function () {
                    idoc.ysview.setSplashView(true, true, true);
                    idoc.ysview.closeDialog(idoc);
                });
        }

        function parseYQL(r, hash, comps) {
            var cset,
                query = r.query,
                res = query && query.results;

            if (!res || r.error) {
                return showError();
            }

            YSLOW.util.event.fire('componentFetchProgress', {
                'total': fetchTotal + 2,
                'current': fetchTotal - fetchCount,
                'last_component_url': YSLOW.util.plural('%num% component%s% fetched',
                    (query && query.count) || 0)
            });

            res = res && res.resources;
            arrayEach(res, function (v) {
                // find and get comp from comps hash
                var comp,
                    redir = v.redirect,
                    rawHeaders = '';

                // check for redirect
                if (redir) {
                    redir = [].concat(redir);
                    comp = hash[redir[0].url];
                    arrayEach(redir, function (red) {
                        var headers = {};

                        // normalize headers, yql introduced result in response
                        red.headers = red.headers.result || red.headers;

                        objEach(red.headers, function (value, key) {
                            headers[key.toLowerCase()] = value;
                        });
                        comps.push({
                            url: red.url,
                            href: red.url,
                            rawHeaders: 'Location: ' + headers.location + '\n',
                            status: red.status,
                            headers: headers,
                            type: 'redirect'
                        });
                    });
                } else {
                    comp = hash[v.url];
                }
                comp.href = comp.url = v.url;

                // normalize headers, yql introduced result in response
                v.headers = v.headers.result || v.headers;

                // build raw headers
                objEach(v.headers, function (v, k) {
                    rawHeaders += k + ': ' + v + '\n';
                });
                comp.rawHeaders = rawHeaders;

                comp.status = v.status;
                comp.headers = v.headers;
                comp.content = v.content;
            });

            if (!(fetchCount -= 1)) {
                cset = buildComponentSet(comps);
                YSLOW.util.event.fire('componentFetchProgress', {
                    'total': fetchTotal + 2,
                    'current': fetchTotal + 1,
                    'last_component_url': 'Checking post onload components'
                });
                cset.inline = YSLOW.util.getInlineTags(doc);
                cset.domElementsCount = YSLOW.util.countDOMElements(doc);
                cset.cookies = YSLOW.util.getDocCookies(doc);
                setSameDomainCookies(cset);
                cset.components = YSLOW.util.setInjected(doc,
                    cset.components, cset.doc_comp.body);
                cset.setAfterOnload(peelDone);
            }
        }

        function request(hash, comps, urls) {
            urls = breakDownUrls(urls);
            fetchCount = fetchTotal = urls.length;
            
            arrayEach(urls, function (url) {
                Y.YQL(YQL_REQ_TABLE + 
                    'select * from data.headers where url in (' + url + ') and ua="' +
                    YQL_REQ_UA + '";', {
                        on: {
                            success: parseYQL,
                            failure: showError,
                            timeout: showError
                        },
                        args: [hash, comps]
                    });
            });
        }

        function fetchResult(result) {
            var i, comp, url, len,
                hash = {},
                urls = [],
                comps = [];

            for (i = 0, len = result.length; i < len; i += 1) {
                comp = result[i];
                url = comp.href;
                if (url && !reIgnore.test(url)) {
                    hash[url] = comp;
                    comps.push(comp);
                    urls.push(url);
                } else if (!url) {
                    comps.push(comp);
                }
            }

            return request(hash, comps, urls);
        }

        YSLOW.controller.run = function (win, yscontext, autorun) {
            YSLOW.util.event.fire('peelStart');
            fetchResult(YSLOW.peeler.peel(doc));
        };

        YSLOW.util.event.addListener('peelStart', function () {
            idoc.ysview.genProgressView();
        });
        YSLOW.util.event.addListener('peelProgress', function (progress) {
            idoc.ysview.updateProgressView('peel', progress);
        });
        YSLOW.util.event.addListener('componentFetchProgress', function (progress) {
            idoc.ysview.updateProgressView('fetch', progress);
        });
        YSLOW.util.event.addListener('componentFetchDone', function () {
            idoc.ysview.show();
        });
        
        idoc.ysview.setSplashView(true, true, true);
    });
});
