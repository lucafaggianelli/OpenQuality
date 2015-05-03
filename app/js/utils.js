Utils = {};

var BYTES_MAGNITUDES = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

Utils.getFileSizeString = function(size) {
    if (typeof(size) == 'string')
        size = parseInt(size);

    var i = -1;
    do {
        size /= 1024;
        i++;
    } while (size > 1024);

    return Math.max(size, 0.1).toFixed(1) + ' ' + BYTES_MAGNITUDES[i];
}

Utils.obj2arr = function(obj) {
    var arr = [];
    angular.forEach(obj, function(value, key) {
        arr.push(value);
    });
    return arr;
}
