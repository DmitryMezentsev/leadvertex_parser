const parser = require('./parser');

const async = require('async');

async.waterfall([
    parser.auth,
    parser.getData,
    parser.export,
], err => {
    if (err) return console.error(err);

    console.log(`Экспорт завершен`);
});
