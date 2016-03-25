Template.TreeView.onCreated(function() {
  let instance = this;

  instance.state = new ReactiveDict();
  instance.state.setDefault({
    errorMessage: null,
    ready: false
  });

  instance.autorun(() => {
    instance.state.set('ready', false);

    let dataContext = Template.currentData();

    if (dataContext && dataContext.collection) {
      if (dataContext.subscription) {
        //console.log('Calling subscribe');
        instance.subscribe(dataContext.subscription, {
          onReady: () => {
            //console.log("onReady called");
            //console.debug(this);
            instance.state.set('ready', true);
          }
        });
        Tracker.afterFlush(function() {
          instance.state.set('ready', instance.subscriptionsReady());
        });
      }
    } else if(! data.Context || ! dataContext.core || ! dataContext.core.data) {
      this.state.set('errorMessage', 'No collection set.');
    }
  });

});

Template.TreeView.helpers({
  showArgs() {
    const instance = Template.instance();
    return {
      errorMessage: instance.state.get('errorMessage'),
      ready: instance.state.get('ready'),
      options: Template.currentData()
    }
  }
});

Template.TreeView_content.onRendered(function() {
  let dataContext = Template.currentData();
  let collection = dataContext.collection;
  let mapping = dataContext.mapping || {};
  let events = dataContext.events || {};
  let instance = this;
  let select = dataContext.select;

  let parents = [];
  if (select && collection) {
    parents = getParents(select);
  }

  function getParents(id) {
    let parents = [];

    do {
      let item = collection.findOne(id);
      if (! item) break;
      id = item.parent;
      if(id) parents.push(id);
    } while (id);

    return parents;
  }

  let openId = null;
  let editId = null;

  function getNodes(parent) {

    let f = dataContext.getNodes || function(parent) {
      let search = {};
      search[mapping['parent'] || 'parent'] = parent;
      return collection.find(search);
    }

    return f(parent).map( (item) => {
      node = {
        id: item._id,
        text: getContent(item, 'text'),
        icon: getContent(item, 'icon'),
        // TODO: set state to show a selected node
        state: getState(item),
        li_attr: {class: getContent(item, 'liClass')},
        a_attr: getContent(item, 'aAttr'),
        data: item
      };

      node.children = f(item._id).count() > 0;
      return node;
    });
  }

  function getContent(item, field) {
    if (mapping && mapping[field]) {
      let f = mapping[field];
      if (typeof f === 'object') {
        return f;
      } else if (typeof f === 'string') {
        return item[f];
      } else if (typeof f === 'function') {
        return f(item, field);
      }
    } else {
      return item[field];
    }
  }

  function getState(item) {
    let content = getContent(item, 'state');
    if (content) return content;

    if (dataContext.select) {
      let state = {
        selected: (item._id == dataContext.select)
      }
      if (parents.indexOf(item._id) > -1) {
        state.opened = true;
      }
      return state;
    }
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

      // Create tree on first run

      let jsTreeOptions = dataContext.jstree || {};

      jsTreeOptions.core = jsTreeOptions.core || {};
      jsTreeOptions.core.data = jsTreeOptions.core.data ||
        function(node, callback) {

          // The computation is reused to trigger only one refresh of the
          // complete tree.

          useComputation(computation, function() {
            if (node.id === '#') {
              callback(getNodes(dataContext.parent || null));
            } else {
              callback(getNodes(node.id));
            }
          });
        };

      jsTreeOptions.core.check_callback =
        jsTreeOptions.core.check_callback ||
        !! events.create ||
        !! events.rename ||
        !! events.delete ||
        !! events.copy ||
        !! events.move;

      jsTreeOptions.contextmenu = jsTreeOptions.contextmenu || {};
      jsTreeOptions.contextmenu.items = jsTreeOptions.contextmenu.items ||
        function() {
          let items = $.jstree.defaults.contextmenu.items();
          if (! events.create) delete items.create;
          if (! events.rename) delete items.rename;
          if (! events.delete) delete items.remove;
          if (! events.copy) delete items.ccp.submenu.copy;
          if (! events.move) delete items.ccp.submenu.move;
          if (! events.copy && ! events.move) delete items.ccp;

          return items;
        }();

      jsTreeOptions.dnd = jsTreeOptions.dnd || {};
      jsTreeOptions.dnd.always_copy = !! events.copy && ! events.move;
      jsTreeOptions.dnd.copy = !! events.copy;


      let tree = this.$('.js-treeview-content').jstree(jsTreeOptions);

      // Attach events
      function attachEventHandler(eventname, f) {
        if (typeof f == 'function') {
          tree.on(eventname, function(e, data) {
            //console.log(data);
            if (eventname === 'create_node.jstree') {
              tree.jstree().open_node(data.parent);
            }
            let newId = f(e, data.selected || (data.original && data.original.id) || data.node.id,
                          {text: data.text, parent: data.parent, position: data.position});
            if (newId === false) {
              ////console.log("Refreshing because of false as return value.")
              tree.jstree().refresh();
            } else if (newId) {
              data.instance.set_id(data.node, newId);
              if (eventname === 'create_node.jstree') {
                openId = data.parent;
                editId = newId;
              }
            }
          });
        }
      }

      attachEventHandler("changed.jstree", events.changed);
      attachEventHandler("create_node.jstree", events.create);
      attachEventHandler("rename_node.jstree", events.rename);
      attachEventHandler("delete_node.jstree", events.delete);
      attachEventHandler("copy_node.jstree", events.copy);
      attachEventHandler("move_node.jstree", events.move);

    } else {
      //console.log("refresh");

      let tree = this.$('.js-treeview-content').jstree();
      tree.refresh();
      if (editId) {
        //console.log('Calling edit on ' + editId);
        Meteor.setTimeout(function() {
          tree.edit(editId);
          editId = null;
        }, 1000);
      }
    }
  });
});
