Template.TreeView.onCreated(function() {
  this.state = new ReactiveDict();
  this.state.setDefault({
    errorMessage: null
  });
  let dataContext = Template.currentData();

  if (dataContext && dataContext.collection) {
    if (dataContext.subscription) {
      this.subscribe(dataContext.subscription);
    }
  } else {
    this.state.set('errorMessage', 'No collection set.');
  }
});

Template.TreeView.helpers({
  showArgs() {
    const instance = Template.instance();
    return {
      errorMessage: instance.state.get('errorMessage'),
      subscriptionsReady: instance.subscriptionsReady(),
      options: Template.currentData()
    }
  }
});

Template.TreeView_content.onRendered(function() {
  let dataContext = Template.currentData();
  let collection = dataContext.collection;
  let instance = this;

  function getNodes(parent) {
    return collection.find({parent}).map( (item) => {
      item.id = item._id;
      item.text = item.name;
      Tracker.nonreactive(function() {
        item.children = collection.find({parent: item._id}).count() > 0;
      });
      delete item.parent;
      return item;
    });
  }

  // function inspired from tracker.js
  function useComputation(c, f) {
    let savedComputation = Tracker.currentComputation;
    Tracker.currentComputation = c;
    Tracker.active = !! c;

    f();

    Tracker.currentComputation = savedComputation;
    Tracker.active = !! savedComputation;
  }

  instance.autorun((computation) => {
    if (computation.firstRun) {
      this.$('.js-treeview-content').jstree({
        core: {
          data: function(node, callback) {

            // The computation is reused to trigger only one refresh of the
            // complete tree.

            useComputation(computation, function() {
              if (node.id === '#') {
                callback(getNodes(null));
              } else {
                callback(getNodes(node.id));
              }
            });
          }
        }
      });
    } else {
      console.log("refresh");
      this.$('.js-treeview-content').jstree().refresh();
    }
  });
});
