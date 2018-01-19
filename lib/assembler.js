
const globby = require('globby');
const hbs = require('handlebars');
const dirTree = require('directory-tree');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const slug = require('slug');
const matter = require('gray-matter');


const config = {
    src: ['elements']
};


const injectMarkup = (registry, file, markup) => {

    let find = `"path":"${file}"`;
    let rep = `${find}, "markup": "${markup}"`;
    let re = new RegExp(find, 'gi');

    let str = JSON.stringify(registry);

    if (str.match(re).length > 0) {
        str = str.replace(re, rep);
        registry = JSON.parse(str);
    }

    return registry;
};

const injectData = (registry, file, data) => {
    let find = `"path":"${file}"`;
    let rep = `${find}, "data": ${JSON.stringify(data)}`;
    let re = new RegExp(find, 'gi');

    let str = JSON.stringify(registry);

    if (str.match(re).length > 0) {
        str = str.replace(re, rep);
        registry = JSON.parse(str);
    }

    return registry;
};

const buildManifest = (registry) => {
    let manifest = [];
    let marr = registry.slice();

    while (marr.length > 0) {
        let item = marr.shift();
        if (item.hasOwnProperty('children')) {
            marr = marr.concat(item.children.slice());

            delete item.children;
        }

        manifest.push(item);
    }

    return manifest;
};

const getMarkup = (markup) => {
    return markup.replace(/\r?\n|\r/g, '')
    .replace(/[\t ]+\</g, "<")
    .replace(/\>[\t ]+\</g, "><")
    .replace(/\>[\t ]+$/g, ">");
};

const getContent = (file) => {
    let content = fs.readFileSync(file, 'utf-8');

    let fm = matter(content);
    fm['name'] = getName(file);
    return fm;
};

const getName = (file) => {
    let farr = file.split('.'); farr.pop();
    return String(slug(farr.join('.').split('/').pop())).toLowerCase();
};


/**
 *  Module
 * @param callback { Function } Method to execute upon completion
 */
module.exports = (callback) => {

    // Data placeholder
    let data = {};

    // Get the registry structure
    let registry = config.src.map((path) => { return dirTree(path); });

    // Get the partials
    let markupGlobs = config.src.map((path) => { return [`${path}/**/*.html`, `${path}/**/*.hbs`]; })[0];
    let markupFiles = globby.sync(markupGlobs, {nodir: true, nosort: true});

    markupFiles.forEach((file) => {
        let cont = getContent(file);
        let markup = getMarkup(cont.content);

        // Inject Markup into registry
        registry = injectMarkup(registry, file, markup);

        // Inject the data into the registry
        registry = injectData(registry, file, cont.data);

        // Register the partial
        hbs.registerPartial(cont.name, markup);

        // Set global data object value
        data[cont.name] = cont.data;
    });


    // TODO: read .json files into the `data` object

    // TODO: read .scss files into the `style` object

    // TODO: read .md files into the `docs` object



    let manifest = buildManifest(registry);

    console.log(manifest);


    if (typeof callback === 'function') {
        callback();
    }
};