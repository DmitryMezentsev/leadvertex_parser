// Адреса страниц в кабинете Leadvertex
exports.pages = {
    login: 'https://leadvertex.ru/operator/login.html',
    tablePage: 'https://{project}.leadvertex.ru/operator.html?status=3',
};


// Данные для авторизации
exports.user = {
    login: '',
    password: '',
};


// Путь экспортируемого .xlsx
exports.exportPath = './exports/{date}.xlsx';


// Проекты для обработки
exports.projects = [
    'megawatch',
    'devices-gadgets',
];


// Настройки колонок в таблицах проектов
exports.cols = {
    'megawatch': [{
        position: 36,
        name: 'ФИО',
    }, {
        position: 37,
        name: 'Телефон',
        childSelector: 'a:first-child',
    }],
    'devices-gadgets': [{
        position: 34,
        name: 'ФИО',
    }, {
        position: 35,
        name: 'Телефон',
        childSelector: 'a:first-child',
    }],
};


// Настройки фильтрации
exports.filters = {
    'megawatch': {
        colPosition: 25,
        filter: /Вручение/i,
    },
    'devices-gadgets': {
        colPosition: 25,
        filter: /Вручение/i,
    },
};