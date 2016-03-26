Package.describe({
  name: 'qnipp:treeview',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'Show and edit data from a collection using jsTree',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use(['ecmascript']);
  api.use(['blaze', 'templating', 'jquery', 'reactive-dict'], 'client');
  api.use(['qnipp:jstree'], 'client');
  api.addFiles('client/tree_view.html', 'client');
  api.addFiles('client/tree_view.js', 'client');

});

Package.onTest(function(api) {
});
