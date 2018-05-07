const config = require('./config');


const needle     = require('needle');
const async      = require('async');
const url        = require('url');
const jsdom      = require('jsdom');
const dateFormat = require('dateformat');
const XLSX       = require('xlsx');

const { JSDOM } = jsdom;
const { URL }   = url;


// Авторизация
exports.auth = (callback) => {
    // Сначала грузим страницу с формой входа, чтобы получить OPERATORSESSID и YII_CSRF_TOKEN в cookies
    needle.request('get', config.pages.login, {}, (err, response) => {
        if (err) return callback(err);

        let cookies = response.cookies;

        // Затем отправляем запрос на авторизацию
        needle.request('post', config.pages.login, {
            FormLogin: {
                rememberMe: 1,
                username: config.user.login,
                password: config.user.password,
            },
            YII_CSRF_TOKEN: cookies.YII_CSRF_TOKEN,
        }, {
            cookies: cookies,
        }, (err, response) => {
            if (err) return callback(err);

            Object.assign(cookies, response.cookies);
            callback(null, cookies);
        });
    });
};

// Парсинг данных
exports.getData = (cookies, callback) => {
    async.waterfall([
        // Получаем списки всех страниц, с которых надо спарсить данные
        (callback) => {
            async.parallel((() => {
                let f = {};

                for (let project of config.projects) {
                    f[project] = (callback) => {
                        let tablePageURL = config.pages.tablePage.replace('{project}', project);

                        needle.request('get', tablePageURL, '', {
                            cookies: cookies,
                        }, (err, response) => {
                            if (err) return callback(err);

                            let pages = [];

                            // Если страница прогружена успешно
                            if (response.statusCode === 200) {
                                // Имя GET-параметра, определяющего номер страницы в постраничной навигации
                                const PAGE_URL_PARAM_NAME = 'Order_page';

                                let DOM = new JSDOM(response.body);
                                // Находим ссылку на последнюю страницу в постраничной навигации
                                let lastPageLink = DOM.window.document.querySelector('.pagination .yiiPager .last a');

                                // Постраничная навигация есть
                                if (lastPageLink) {
                                    // Выдергиваем URL и номер последней страницы
                                    let href = lastPageLink.getAttribute('href');
                                    let maxPage = url.parse(href, true).query[PAGE_URL_PARAM_NAME];

                                    let pageURL = new URL(tablePageURL);

                                    // Добавляем ссылки на все страницы в массив
                                    for (let p = 1; p <= maxPage; ++p) {
                                        pageURL.searchParams.set(PAGE_URL_PARAM_NAME, String(p));
                                        pages.push(pageURL.href);
                                    }
                                // Постраничной навигации нет, страница всего одна
                                } else {
                                    pages.push(tablePageURL);
                                }

                                console.log(`Страниц по проекту '${project}': ${pages.length}.`);
                            } else {
                                console.error(`Не удалось получить доступ к проекту '${project}'.`);
                            }

                            callback(null, pages);
                        });
                    };
                }

                return f;
            })(), callback);
        },
        // Парсим данные со страниц
        (pages, callback) => {
            let progress = {};

            // Проекты обрабатываются параллельно
            async.parallel((() => {
                let f = {};

                for (let [project, pagesList] of Object.entries(pages)) {
                    progress[project] = 0;

                    f[project] = (callback) => {
                        // Страницы одного проекта обрабатываются последовательно
                        async.series((() => {
                            let f = [];

                            pagesList.forEach((page) => {
                                f.push((callback) => {
									function loadAndParse () {
										needle.request('get', page, '', {
											cookies: cookies,
										}, (err, response) => {
											// Из-за бага в модуле needle в случае ошибки приходится
											// заставлять его грузить страницу повторно
											if (err) return loadAndParse();

											let data = [];

											if (response.statusCode === 200) {
												let DOM = new JSDOM(response.body);
												let tr = DOM.window.document.querySelectorAll('#admin-orders-grid-tbody tr');

												// Перебираем строки
												tr.forEach((row) => {
													let trData = {};

													// Перебираем столбцы
													config.cols[project].forEach((col) => {
														let td = row.querySelectorAll('td')[col.position];

														if (td && col.childSelector)
															td = td.querySelector(col.childSelector);

														trData[col.name] = (td) ? td.textContent : '';
													});

													// Фильтрация и добавление результатов
													{
														if (config.filters[project]) {
															let td = row.querySelectorAll('td')[config.filters[project].colPosition];

															if (td.textContent.search(config.filters[project].filter) !== -1)
																data.push(trData);
														// Если настроек фильтрации нет
														} else {
															data.push(trData);
														}
													}
												});

												++progress[project];

												console.log(`${project}: Обработано ${progress[project]} страниц из ${pagesList.length}.`);
											} else {
												console.error(`${project}: Не удалось загрузить страницу '${page}'.`);
											}

											callback(null, data);
										});
									}
									
									loadAndParse();
                                });
                            });

                            return f;
                        })(), callback);
                    };
                }

                return f;
            })(), callback);
        },
    ], callback);
};

// Экспорт в .xlsx
exports.export = (data, callback) => {
    let currentDateTime = dateFormat((new Date()), 'yyyy-mm-dd_HH-MM-ss');
    let exportPath = config.exportPath.replace('{date}', currentDateTime);

    let wb = XLSX.utils.book_new();

    config.projects.forEach((project) => {
        let xlsxData = [];

        data[project].forEach((i) => {
            i.forEach((j) => xlsxData.push(j));
        });

        let ws = XLSX.utils.json_to_sheet(xlsxData);
        XLSX.utils.book_append_sheet(wb, ws, project);
    });

    XLSX.writeFile(wb, exportPath, { bookType: 'xlsx', type: 'binary' });

    callback();
};