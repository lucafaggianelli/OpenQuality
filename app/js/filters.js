var openQualityFilters = angular.module('openQualityFilters', []);

openQualityFilters.filter('html2text', function() {
    return function(text) {
        return String(text).replace(/<[^>]+>/gm, '').trim();
    }
});

openQualityFilters.filter('hellip', function() {
    return function(text, limit) {
        if (!limit)
            limit = 100;

        if (text && text.length > limit)
            return text.substring(0,limit) + '<span class="text-info">&hellip; (more)</span>';
        else
            return text;
    }
});
