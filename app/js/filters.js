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
            return text.substring(0,limit) + '<span class="text-info">&hellip;</span>';
        else
            return text;
    }
});

openQualityFilters.filter('cleanField', function() {
    return function(text) {
        var tmp = text.match(/^\d+\s*-\s*(.*)$/);
        if (tmp && tmp.length == 2)
            return tmp[1];
        
        return text;
    }
});
