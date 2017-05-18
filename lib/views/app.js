(function() {
    'use strict';

    const $ = (selector) => Array.prototype.slice.call(document.querySelectorAll(selector));

    const removeClass = function(className, elem) {
        if (!elem) return;
        let classes = elem.className.split(/ +/g);
        let index = classes.indexOf(className);
        if (-1 !== index) {
            classes.splice(index, 1);
            elem.className = classes.join(' ');
        }
    };

    const addClass = function(className, elem) {
        if (!elem) return;
        let classes = elem.className.split(/ +/g);
        let index = classes.indexOf(className);
        if (-1 === index) {
            classes.push(className);
            elem.className = classes.join(' ');
        }
    };

    const show = function(elem) {
        if (!elem) return;
        elem.style.display = 'block';
    };

    const hide = function(elem) {
        if (!elem) return;
        elem.style.display = 'none';
    };

    let links = $('nav li.route');
    let resources = $('#details .resource');

    const onNavChange = function() {
        let link = links[0].parentElement;
        let resource = resources[0];
        let hash = (window.location.hash || '').replace(/^#/, '');

        if (hash) {
            resource = document.getElementById(hash);
            link = $('nav a[href="#' + hash + '"]')[0].parentElement;
        }

        resources.forEach(hide.bind(null));
        links.forEach(removeClass.bind(null, 'selected'));

        if (resource && link) {
            show(resource);
            addClass('selected', link);
            window.scrollTo(0, Math.max(0, resource.offsetTop - 10));
        }
    }

    // links.forEach((link) => link.addEventListener('click', onNavChange));
    window.addEventListener('hashchange', onNavChange);

    onNavChange();
})();
