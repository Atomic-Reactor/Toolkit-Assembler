
const slug          = require('slug');
const path          = require('path');
const globby        = require('globby');
const _             = require('lodash');
const fs            = require('fs-extra');
const bytes         = require('bytes.js');
const camelcase     = require('camelcase');
const decamelize    = require('decamelize');
const matter        = require('gray-matter');
const tree          = require('directory-tree');
const md            = require('markdown').markdown;
const version       = require('../package').version;


const config = {
    version      : 0,
    timestamp    : 0,
    dataMerge    : true,
    markupExt    : 'html',
    src          : {
        root        : 'src',
        data        : ['src/data'],
        themes      : ['src/themes'],
        layouts     : ['src/layouts'],
        catalyst    : ['src/catalyst'],
        elements    : ['src/elements'],
        templates   : ['src/templates'],
    },
    data         : {},
    themes       : {},
    templates    : {},
    layouts      : {},
    catalyst     : {},
    demos        : {},
    docs         : {},
    partials     : {},
    styles       : {},
    js           : {},
    manifest     : [],
};

const dirTree = (dir) => {
    return tree(dir, {exclude:/.ds_store/i});
};

const flattenRegistry = (registry) => {
    let manifest = [];
    let marr = _.cloneDeep(registry);

    while (marr.length > 0) {
        let item = marr.shift();
        if (!item) { continue; }
        if (item.hasOwnProperty('children')) {
            marr = marr.concat(item.children.slice());

            delete item.children;
        }

        manifest.push(item);
    }

    return manifest;
};

const getName = (file) => {
    let filename = path.basename(file, path.extname(file)).toLowerCase();
    return slug(filename);
};

const getBytes = (str) => {
    return bytes.fromString(str);
};

const getContent = (file) => {
    let content = fs.readFileSync(file, 'utf-8');

    let fm = matter(content);
    fm['name'] = getParent(file);
    return fm;
};

const getParent = (file) => {
    return path.dirname(file);
};

const getData = (file) => {
    let content = fs.readFileSync(file, 'utf-8');
    let isCat = isCatalyst(file);
    let isRoot = (config.src.data.indexOf(path.dirname(file)) > -1);
    let name = getName(file);

    if (!isRoot) {
        name = getParent(file);
    }

    if (isCat) {
        name = path.basename(getParent(file));
    }

    let fm            = matter(`---\n${content}\n---\n`);
    fm['name']        = getKeyName(name) || name;
    fm['catalyst']    = isCat;

    return fm;
};

const getKeyName = (name) => {
    let oname = name;
    config.src.elements.forEach((p) => { name = name.split(p).join(''); });

    if (name.length < 1) {
        name = oname.split(config.src.root).join('');
    }

    name = name.split('/').join('-');
    name = decamelize(camelcase(name), '-');

    return name;
};

const isCatalyst = (file) => {
    return (config.src.catalyst.indexOf(path.dirname(path.dirname(file))) > -1);
};

/**
 *  Module
 */
module.exports = (params = {}) => {

    // Merge params with config
    Object.keys(params).forEach((key) => { config[key] = params[key]; });

    // Source files
    const source = _.concat(config.src.elements, config.src.catalyst);

    // Get the base registry structure
    config.registry = dirTree(config.src.root);

    // -------------------------------------
    // ALERT: MUST BE FIRST THING ADDED !!!!
    // Get data files .json|.yml
    // -------------------------------------
    let dataGlobs = _.flatten(_.concat(config.src.data, config.src.elements, config.src.catalyst).map((p) => {
        return [
            `${p}/**/*.json`,
            `${p}/**/*.yml`
        ];
    }));
    let dataFiles = globby.sync(dataGlobs, {nodir: true, nosort: true});
    dataFiles.forEach((file) => {
        let cont     = getData(file);
        let isCat    = cont.catalyst;
        let key      = cont.name;

        if (isCat === true) {
            config.data.catalyst = config.data.catalyst || {};
            config.data.catalyst[key] = (config.data.catalyst.hasOwnProperty(key))
                ? Object.assign({}, config.data.catalyst[key], cont.data)
                : cont.data;
        } else {
            config.data[key] = (config.data.hasOwnProperty(key))
                ? Object.assign({}, config.data[key], cont.data)
                : cont.data;
        }
    });


    // -------------------------------------
    // Get the partials
    // -------------------------------------
    let markupGlobs = _.flatten(source.map((p) => {
        return [`${p}/**/*.${config.markupExt}`];
    }));
    let markupFiles = globby.sync(markupGlobs, {nodir: true, nosort: true});
    markupFiles.forEach((file) => {
        let cont = getContent(file);
        let markup = getBytes(cont.content);
        let isCat = isCatalyst(file);
        let key = (isCat === true)
            ? getKeyName(path.basename(cont.name))
            : getKeyName(cont.name);


        // Update global data object
        if (config.dataMerge === true) {
            if (isCat === true) {
                config.data.catalyst[key] = (config.data.catalyst.hasOwnProperty(key))
                    ? Object.assign({}, cont.data, config.data.catalyst[key])
                    : cont.data;
            } else {
                config.data[key] = (config.data.hasOwnProperty(key))
                    ? Object.assign({}, cont.data, config.data[key])
                    : cont.data;
            }
        }

        switch (getName(file)) {

            case 'demo':
                if (isCat === true) {
                    key = `catalyst-${key}`;
                }
                config.demos[key]          = config.demos[key] || {};
                config.demos[key][file]    = markup;
                break;

            default:
                if (isCat === true) {
                    config.catalyst[key]          = config.catalyst[key] || {};
                    config.catalyst[key][file]    = markup;
                } else {
                    config.partials[key]          = config.partials[key] || {};
                    config.partials[key][file]    = markup;
                }
        }
    });


    // -------------------------------------
    // Get markdown files
    // -------------------------------------
    let markdownGlobs = _.flatten(source.map((p) => { return [`${p}/**/*.md`]; }));
    let markdownFiles = globby.sync(markdownGlobs, {nodir: true, nosort: true});
    markdownFiles.forEach((file) => {
        let cont = getContent(file);
        let markdown = getBytes(md.toHTML(cont.content));
        let key = (isCatalyst(file))
            ? `catalyst-${getKeyName(path.basename(cont.name))}`
            : getKeyName(cont.name);

        config.docs[key]          = config.docs[key] || {};
        config.docs[key][file]    = markdown;
    });


    // -------------------------------------
    // Get style files
    // -------------------------------------
    let styleGlobs = _.flatten(source.map((p) => { return [`${p}/**/*.scss`, `${p}/**/*.less`]; }));
    let styleFiles = globby.sync(styleGlobs, {nodir: true, nosort: true});
    styleFiles.forEach((file) => {
        let cont = getContent(file);
        let key = (isCatalyst(file))
            ? `catalyst-${getKeyName(path.basename(cont.name))}`
            : getKeyName(cont.name);

        config.styles[key] = config.styles[key] || {};
        config.styles[key][file] = getBytes(cont.content);
    });


    // -------------------------------------
    // Get js
    // -------------------------------------
    let jsFiles = globby.sync([`${config.src.root}/**/*index.js`], {nodir: true, nosort: true});
    jsFiles.forEach((file) => {
        let cont = getContent(file);
        let key = (isCatalyst(file))
            ? `catalyst-${getKeyName(path.basename(cont.name))}`
            : getKeyName(cont.name);

        config.js[key] = config.js[key] || {};
        config.js[key][file] = getBytes(cont.content);
    });


    // -------------------------------------
    // Get templates
    // -------------------------------------
    let tempDirs = config.src.templates.map((dir) => { return dirTree(dir); });
    tempDirs.forEach((dir) => {
        if (!dir) { return; }
        if (!dir.hasOwnProperty('children')) { return; }

        dir.children.forEach((item) => {
            if (item.extension !== `.${config.markupExt}`) { return; }

            let cont   = getContent(item.path);
            let key    = getName(item.path);
            let markup = getBytes(cont.content);

            config.templates[key] = {
                data      : cont.data,
                path      : item.path,
                markup    : markup,
                size      : item.size,
            };
        });
    });


    // -------------------------------------
    // Get layouts
    // -------------------------------------
    let layoutDirs = config.src.layouts.map((dir) => { return dirTree(dir); });
    layoutDirs.forEach((dir) => {
        if (!dir) { return; }
        if (!dir.hasOwnProperty('children')) { return; }

        dir.children.forEach((item) => {
            if (item.extension !== `.${config.markupExt}`) { return; }

            let cont   = getContent(item.path);
            let key    = getName(item.path);
            let markup = getBytes(cont.content);

            config.layouts[key] = {
                data      : cont.data,
                path      : item.path,
                markup    : markup,
                size      : item.size,
            };
        });
    });


    // -------------------------------------
    // Get themes
    // -------------------------------------
    let themeDirs = config.src.themes.map((dir) => { return dirTree(dir); });
    themeDirs.forEach((dir) => {
        if (!dir) { return; }
        if (!dir.hasOwnProperty('children')) { return; }

        dir.children.forEach((item) => {
            let key    = getName(item.path);
            config.themes[key] = item;
        });
    });


    // set the version number
    config['version'] = version;

    // set the timestamp
    config['timestamp'] = Date.now();

    // flatten the registry into the manifest array
    config['manifest'] = flattenRegistry(config.registry);

    // output the config
    return config;
};
