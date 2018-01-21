const path         = require('path');
const fs           = require('fs-extra');
const assembler    = require('../lib/assembler');
const formatter    = require('json-stringify-pretty-compact');


// Run assembler
const toolkit = assembler({
    src: {
        root        : 'test/toolkit',
        data        : ['test/toolkit/data'],
        catalyst    : ['test/toolkit/catalyst'],
        elements    : ['test/toolkit/elements'],
        templates   : ['test/toolkit/templates'],
        themes      : ['test/toolkit/styles/themes'],
    },
});


// Format results
const registry = formatter(toolkit);

// Output results
const outputFile = path.resolve(__dirname, 'build/registry.json');

fs.ensureFileSync(outputFile);
fs.writeFileSync(outputFile, registry, 'utf-8');
