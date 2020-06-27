import $ from "jquery";
// load "jstree" after jquery
import "jstree";

import {Meteor} from "meteor/meteor";
import {Template} from "meteor/templating";
import {ReactiveDict} from "meteor/reactive-dict";
import {Tracker} from "meteor/tracker";

import "./checkNpmVersions";
import "./tree_view.html";

// eslint-disable-next-line meteor/template-names
Template.TreeView.onCreated(function () {
    const instance = this;

    instance.state = new ReactiveDict();
    instance.state.setDefault({
        errorMessage: null,
        ready: false
    });

    instance.autorun(() => {
        instance.state.set('ready', false);
        // console.log('autorun in TreeView');

        const dataContext = Template.currentData();

        Tracker.afterFlush(function () {
            if (dataContext && dataContext.collection) {
                if (dataContext.subscription) {
                    // console.log('Calling subscribe');
                    if (dataContext.selector) {
                        instance.subscribe(dataContext.subscription, dataContext.selector, {
                            onReady: () => {
                                // console.log("onReady called");
                                // console.debug(this);
                                instance.state.set('ready', true);
                            }
                        });
                    } else {
                        instance.subscribe(dataContext.subscription, {
                            onReady: () => {
                                // console.log("onReady called");
                                // console.debug(this);
                                instance.state.set('ready', true);
                            }
                        });
                    }
                    Tracker.afterFlush(function () {
                        instance.state.set('ready', instance.subscriptionsReady());
                    });
                }
            } else if (!dataContext || !dataContext.core || !dataContext.core.data) {
                this.state.set('errorMessage', 'No collection set.');
            }

        });

    });

});

// eslint-disable-next-line meteor/template-names
Template.TreeView.helpers({
    showArgs() {
        const instance = Template.instance();
        return {
            errorMessage: instance.state.get('errorMessage'),
            ready: instance.state.get('ready'),
            options: Template.currentData()
        };
    }
});

// eslint-disable-next-line meteor/template-names
Template.TreeView_content.onRendered(function () {
    const dataContext = Template.currentData();
    const collection = dataContext.collection;
    const disableAutoTreeRefresh = dataContext.disableAutoTreeRefresh || false;
    const mapping = dataContext.mapping || {};
    const events = dataContext.events || {};
    const instance = this;
    const select = dataContext.select;

    let parents = [];
    if (select && collection) {
        parents = getParents(select);
    }

    function getParents(id) {
        const parents = [];

        do {
            const item = collection.findOne(id);
            if (!item) break;
            id = item.parent;
            if (id) parents.push(id);
        } while (id);

        return parents;
    }

    let openId = null;
    let editId = null;

    function getItemId(item) {
    // Handle Mongos ObjectID instances
        if (item._id.valueOf) return item._id.valueOf();
        return item._id;
    }

    function getCount(listOrCursor) {
        if (typeof listOrCursor.count === 'function') return listOrCursor.count();
        return listOrCursor.length;
    }

    function getNodes(parent) {

        const f = dataContext.getNodes || function (parent) {
            const search = {};
            search[mapping.parent || 'parent'] = parent;
            return collection.find(search);
        };

        return f(parent).map((item) => {
            node = {
                id: getItemId(item),
                text: getContent(item, 'text'),
                icon: getContent(item, 'icon'),
                // TODO: set state to show a selected node
                state: getState(item),
                li_attr: { class: getContent(item, 'liClass') },
                a_attr: getContent(item, 'aAttr'),
                data: item
            };

            // MMA: Allow node postprocessing for adding other plugins like "type"
            if (typeof dataContext.processNode === 'function') { dataContext.processNode(node, item); }

            node.children = getCount(f(getItemId(item))) > 0;
            return node;
        });
    }

    function getContent(item, field) {
        if (mapping && mapping[field]) {
            const f = mapping[field];
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
        const content = getContent(item, 'state');
        if (content) return content;

        if (dataContext.selectAll) {
            return { selected: true, opened: true };
        } else if (dataContext.select) {
            const state = {
                selected: getItemId(item) === dataContext.select
            };
            if (dataContext.openAll || parents.indexOf(getItemId(item)) > -1) {
                state.opened = true;
            }
            return state;
        } else if (dataContext.openAll) {
            return { opened: true };
        }
    }

    // function inspired from tracker.js
    function useComputation(c, f) {
        const savedComputation = Tracker.currentComputation;
        Tracker.currentComputation = c;
        Tracker.active = !!c;

        f();

        Tracker.currentComputation = savedComputation;
        Tracker.active = !!savedComputation;
    }

    instance.autorun((computation) => {
        if (computation.firstRun) {
            // Create tree on first run

            const jsTreeOptions = dataContext.jstree || {};

            jsTreeOptions.core = jsTreeOptions.core || {};
            jsTreeOptions.core.data = jsTreeOptions.core.data
        || function (node, callback) {

            // The computation is reused to trigger only one refresh of the
            // complete tree.

            useComputation(computation, function () {
                if (node.id === '#') {
                    callback(getNodes(dataContext.parent || null));
                } else {
                    callback(getNodes(node.id));
                }
            });
        };

            jsTreeOptions.core.check_callback = jsTreeOptions.core.check_callback
        || !!events.create
        || !!events.rename
        || !!events.delete
        || !!events.copy
        || !!events.move;

            jsTreeOptions.contextmenu = jsTreeOptions.contextmenu || {};
            jsTreeOptions.contextmenu.items = jsTreeOptions.contextmenu.items
        || (function () {
            const items = $.jstree.defaults.contextmenu.items();
            if (!events.create) delete items.create;
            if (!events.rename) delete items.rename;
            if (!events.delete) delete items.remove;
            if (!events.copy) delete items.ccp.submenu.copy;
            if (!events.move) delete items.ccp.submenu.move;
            if (!events.copy && !events.move) delete items.ccp;

            return items;
        }());

            jsTreeOptions.dnd = jsTreeOptions.dnd || {};
            jsTreeOptions.dnd.always_copy = !!events.copy && !events.move;
            jsTreeOptions.dnd.copy = !!events.copy;


            const tree = $('.js-treeview-content').jstree(jsTreeOptions);

            // Attach events
            function attachEventHandler(eventname, f) {
                if (typeof f === 'function') {
                    tree.on(eventname, function (e, data) {
                        // console.log(data);
                        if (eventname === 'create_node.jstree') {
                            tree.jstree().open_node(data.parent);
                        }
                        const nodeId = data.selected || (data.original && data.original.id) || data.node.id;

                        const parentNode = data.node && tree.jstree().get_node(data.parent);
                        const itemNode = data.node && tree.jstree().get_node(nodeId);

                        const newId = f(e, nodeId,
                            {
                                text: data.text,
                                parent: data.parent,
                                position: data.position,
                                item_data: (itemNode && itemNode.data) || {},
                                parent_data: (parentNode && parentNode.data) || {}
                            });

                        if (newId === false) {
                            // //console.log("Refreshing because of false as return value.")
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
            const tree = $('.js-treeview-content').jstree();
            if (!disableAutoTreeRefresh) {
                tree.refresh();
            }
            if (editId) {
                // console.log('Calling edit on ' + editId);
                Meteor.setTimeout(function () {
                    tree.edit(editId);
                    editId = null;
                }, 1000);
            }
        }
    });
});
