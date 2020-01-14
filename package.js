Package.describe({
    name: 'sebl29:treeview',
    version: '1.2.0',
    summary: 'Show and edit data from a collection using jsTree',
    git: 'https://github.com/Sebl29/meteor-treeview',
    documentation: 'README.md'
});

Npm.depends({
    jstree: '3.3.8',
});

Package.onUse((api) => {
    api.versionsFrom('1.8.3');
    api.use([
        "ecmascript@0.13.2",
    ]);
    api.use([
        "blaze-html-templates@1.1.2", // meta-package with blaze, spacebars, templating, ...
        "reactive-dict@1.3.0",
        "tmeasday:check-npm-versions@0.3.2",
    ], 'client');
    api.mainModule('client/tree_view.js', 'client');
});
