var Marjuan = window.Marjuan || {};
window.Marjuan = Marjuan;

Marjuan.Helpers = {

    createGUID: function () {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    ifnnull: function (field) {
        if (field == undefined)
            return '';
        return field;
    },
    formatDateTime: function (field) {
        if (field == undefined)
            return '';
        var dt = new Date(field);
        return dt.getDate() + ' ' + month_names_short[dt.getMonth()] + ' ' + dt.getFullYear() + ' ' + dt.getHours() + ':' + (dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes();
    },
    formatDateTimeHyphenated: function (field) {
        var dt = new Date();
        if (field != undefined)
            dt = new Date(field);
        return dt.getDate() + '-' + (dt.getMonth()+1) + '-' + dt.getFullYear() + '-' + dt.getHours() + '-' + (dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes() + '-' + (dt.getSeconds() < 10 ? '0' : '') + dt.getSeconds();
    },
    formatElapsedTime: function (field) {
        if (field == undefined || isNaN(field))
            return '';
        var value = parseInt(field);
        var format = '';
        format = Math.floor(value / (60 * 60 * 24)) + 'd ';
        value = value % (60 * 60 * 24);
        format += Math.floor(value / (60 * 60)) + 'h ';
        value = value % (60 * 60);
        format += Math.floor(value / (60)) + 'm ';
        value = value % (60);
        format += value + 's';
        return format;
    },
    namespace: function (namespaceString) {
        var parts = namespaceString.split('.'),
        parent = window,
        currentPart = '';

        for (var i = 0, length = parts.length; i < length; i++) {
            currentPart = parts[i];
            parent[currentPart] = parent[currentPart] || {};
            parent = parent[currentPart];
        }

        return parent;
    },
    formatNumberWithCommas: function (x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
};