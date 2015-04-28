var openQualityFilters = angular.module('openQualityFilters', []);

openQualityFilters.filter('html2text', function() {
    return function(text) {
        return String(text).replace(/<[^>]+>/gm, '').trim();
    }
});
