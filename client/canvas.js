/********************************************
 * InfoMachine
 * 
 * Copyright (c) 2010 Casey Grun
 *********************************************/


/*
 * Note: for the time being, this file is fairly spaghetti-like. Forgive the mess.
 */

// Bootstrap user interface
Ext.onReady(function(){

    // Initialize random Ext things
    Ext.QuickTips.init();
    Ext.form.Field.prototype.msgTarget = 'side';

    // Remove the loading panel after the page is loaded
    Ext.get('loading').remove();
    Ext.get('loading_mask').fadeOut({
        remove: true
    });

    // Build canvas to fill viewport
    var viewport = new Ext.Viewport({
        layout: 'fit',
        items: [new Ext.ux.LiveCanvas({
            workspaceData: App.getLoadedData()
        })]

    });
});

/**
 * @class Ext.ux.LiveCanvas
 * The application interface. Responsible for constructing a {@link Workspace} object, managing user interface controls which appear
 * outside the Workspace area itself (such as the Object tree and Ribbon UI)
 * @extends Ext.Panel
 */
Ext.ux.LiveCanvas = Ext.extend(Ext.Panel, {
    layout: 'border',
    initComponent: function(){

        Ext.applyIf(this, {
            workspaceData: {}
        })
        Ext.apply(this, {
            items: [new Ext.ux.Ribbon({

                // North region: Ribbon interface
                region: 'north',
                height: 100,
                ref: 'ribbon',
                border: false,
                collapseMode: 'mini',
                canvas: this

            }),
            {

                // Center region: workspace canvas
                region: 'center',
                ref: 'bodyPanel',
                autoScroll: true,
                bbar: {
                  items: ['->','Zoom:&nbsp;',{
                    ref: '../../zoomField',
                    xtype: 'slider',
                    value: 1,
                    minValue: 0.25,
                    maxValue: 4,
                    decimalPrecision: 2,
                    animate: true,
                    plugins: new Ext.slider.Tip({
                        getText: function(thumb){
                            return String.format('{0}%', thumb.value * 100);
                        }
                    }),
                    width: 100,
                    tooltip: {
                        title: 'Zoom',
                        text: 'Workspace zoom'
                    }
                  }]
                }
                /*
                bbar: new Ext.ux.StatusBar({
                  ref: '../statusBar'
                })
                */
                // West region: Tree of objects
            },
            {              
                region: 'west',
                split: true,
                collapseMode: 'mini',
                border: false,
                width: 200,
                layout: 'border',
                items: [new Ext.ux.ObjectTree({
                    region: 'center',
                    ref: '../objectTree',
                    border: true,
                    frame: false,
                    split: true,
                    title: 'Objects',
                    root: {
                        text: 'Workspace',
                        id: 'workspace',
                        nodeType: 'node'
                    }
                }), new Ext.ux.ObjectProperties({
                  ref: '../objectProperties',
                  height: 250,
                  split: true,
                  border: true,
                  frame: false,
                  region: 'south'
                })]
            }]
        });
        Ext.ux.LiveCanvas.superclass.initComponent.call(this);

        // build interface on render
        this.bodyPanel.on('render',
        function(){

            // mask workspace while deserializing
            var mask = new Ext.LoadMask(this.bodyPanel.body, {
                msg: 'Loading Workspace...'
            });

            // build workspace, using loaded data bootstrapped from App.loadData
            this.workspace = new Workspace(this.bodyPanel.body, this.workspaceData);
            this.workspace.on('afterload',
            function(){
                mask.hide()
            },
            {
                single: true
            });

            // deprecated
            App.defaultWorkspace = this.workspace;

            // attach ribbon and object property grid to workspace to allow it to respond to selections
            this.ribbon.attachTo(this.workspace);
            this.objectProperties.attachTo(this.workspace);

            // attach tree to workspace to allow it to mirror selection
            this.objectTree.attachTo(this.workspace);
            
            this.zoomField.on('change',this.zoomWorkspace,this);

        },
        this);

        // deprecated
        this.bodyPanel.on('resize',
        function(c, w, h){
            this.workspace.bodyResize(c,c.getInnerWidth(),c.getInnerHeight());
        },
        this);

    },
    /**
	 * saveWorkspace
	 * Serializes, encodes, and saves the workspace to the server
	 */
    saveWorkspace: function(){
        this.savingMask = new Ext.LoadMask(this.bodyPanel.body, {
            msg: 'Saving Workspace...'
        });
        this.savingMask.show();
        //this.statusBar.setBusy();
        var o = this.workspace.serialize(),
        s = Ext.encode(o);
        this._lastSave = o;
        Ext.Ajax.request({
            url: App.getEndpoint('save'),//'/canvas/index.php/workspaces/save',
            params: {
                rows: s
            },
            success: this.onSave,
            failure: this.onSaveFail,
            scope: this
        })

    },
    /**
	 * onSave
	 * callback to restore the UI after successful save
	 */
    onSave: function(){
        this.savingMask.hide();
        console.log('Workspace Saved.', this._lastSave);
    },
    /**
	 * onSaveFail
	 * callback to inform the user of failed save
	 */
    onSaveFail: function(){
        alert("Workspace saving failed.");
        console.log('Workspace save failed.', this._lastSave);
    },
    zoomWorkspace: function(s,v) {
      this.workspace.zoomTo(v);
    }

});

Ext.ux.Ribbon = Ext.extend(Ext.TabPanel, {
    initComponent: function(){
        Ext.apply(this, {
            activeTab: 0,
            items: [new Ext.ux.ToolsTab({
                title: 'Tools',
                ref: 'toolsTab'
            }), new Ext.ux.InsertTab({
                title: 'Insert',
                ref: 'insertTab',
            }), new Ext.ux.FillStrokeTab({
                title: 'Fill and Stroke',
                ref: 'fillStroke'
            }), new Ext.ux.GeometryTab({
                title: 'Geometry',
                ref: 'geometry'
            }), new Ext.ux.MetaTab({
                title: 'Meta',
                ref: 'metaTab'
            })]
        });

        Ext.ux.Ribbon.superclass.initComponent.apply(this, arguments);

        // Allow the tools tab to manage the workspace tool
        this.mon(this.toolsTab, 'toolChange', this.setActiveTool, this);
        this.mon(this.insertTab, 'toolChange', this.setActiveTool, this);


        // allow ribbon tabs to invoke actions on the workspace
        this.items.each(function(item){
            this.mon(item, 'action', this.doAction, this);
        },
        this);

        // allow workspace to be saved
        this.mon(this.toolsTab, 'save', this.saveWorkspace, this);
    },
    attachTo: function(workspace){
        this.workspace = workspace;

        // bind ribbon to objects when selected in workspace
        this.mon(this.workspace, 'select', this.bind, this);
        this.mon(this.workspace, 'unselect', this.unbind, this);

    },

    setActiveTool: function(tool){
        this.workspace.setActiveTool(tool);
    },
    /**
   * doAction
   * Invokes the passed {@link WorkspaceAction} on the {@link #workspace}
   * @param {WorkspaceAction} action
   */
    doAction: function(action){
        var undoAction = action.getUndo();
        this.workspace.doAction(action);
    },
    /**
   * bind
   * Binds the ribbon to the passed items
   * @param {Workspace.Object} item
   */
    bind: function(item){
        this.items.each(function(tab){
            if (tab.bind && Ext.isFunction(tab.bind))
            tab.bind(item);
        });
    },
    /**
   * unbind
   * Unbinds the ribbon from the passed items
   * @param {Workspace.Object} item
   */
    unbind: function(item){
        this.items.each(function(tab){
            if (tab.unbind && Ext.isFunction(tab.unbind))
            tab.unbind(item);
        });
    },
    saveWorkspace: function(){
        this.canvas.saveWorkspace();
    }
})

/**
 * @class Ext.ux.ObjectTree
 * Displays a tree of objects in the workspace, grouped heirarchically
 */
Ext.ux.ObjectTree = Ext.extend(Ext.tree.TreePanel, {
    initComponent: function(){
        Ext.apply(this, {
            selModel: new Ext.tree.MultiSelectionModel()
        });
        Ext.ux.ObjectTree.superclass.initComponent.apply(this, arguments);
        this.editor = new Ext.tree.TreeEditor(this);
        this.editor.on('complete', this.onEditName, this);
    },
    /**
	 * attachTo
	 * Links this tree to the passed {@link Workspace}
	 * @param {Workspace} workspace
	 */
    attachTo: function(workspace){
        this.workspace = workspace;
        this.mon(this.workspace, 'instantiate', this.onCreate, this);
        this.mon(this.workspace, 'select', this.onWorkspaceSelect, this);
        this.mon(this.workspace, 'unselect', this.onWorkspaceUnselect, this);
        this.mon(this.workspace, 'destroy', this.onObjectDestroy, this);
        var sm = this.getSelectionModel();
        sm.on('selectionchange', this.onSelect, this);
    },
    /**
	 * Finds a node in the tree for the passed object
	 * @param {Workspace.Object} item
	 * @return {Ext.tree.Node} node
	 */
    findNodeForObject: function(item){
        if (item){
            // true to search deeply
            return this.findNodeForId(item.getId());
        }
        return false;
    },
    /**
	 * Finds a node in the tree for the passed object id
	 * @param {String} id
	 * @return {Ext.tree.Node} node
	 */
    findNodeForId: function(id){
        // true to search deeply
        return this.getRootNode().findChild('id', id, true);
    },
    /**
	 * Finds an object in the configured workspace corresponding to the passed node
	 * @param {Ext.tree.Node} node
	 */
    getObjectFromNode: function(node){
        return this.workspace.getObjectById(node.id);
    },
    /**
	 * onEditName
	 * callback invoked by tree editor after a node's text has been edited; sets the name of the requisite object
	 * @param {Ext.tree.TreeEditor} editor
	 * @param {Object} value
	 */
    onEditName: function(editor, value){
        var o = this.getObjectFromNode(this.editor.editNode);
        o.set('name', value);
    },
    /**
	 * onSelect
	 * callback invoked by the selection model after the selection has been changed; updates the workspace selection to match
	 * @param {Object} sm
	 * @param {Object} nodes
	 */
    onSelect: function(sm, nodes){
        if (!this.ignoreSelectionChange){
            this.ignoreSelectionChange = true;
            var toSelect = [];
            Ext.each(nodes,
            function(node){
                toSelect.push(this.workspace.getObjectById(node.id));
            },
            this);
            this.workspace.setSelection(toSelect);
            this.ignoreSelectionChange = false;
        }
    },
    /**
	 * onWorkspaceSelect
	 * listener invoked by the workspace when its selection changes; updates the tree's selection to match
	 * @param {Workspace.Object} item
	 */
    onWorkspaceSelect: function(item){
        if (!this.ignoreSelectionChange){
            this.ignoreSelectionChange = true;
            var n = this.findNodeForObject(item);
            if (n){
                n.select();
            }
            this.ignoreSelectionChange = false;
        }
    },
    /**
	 * onWorkspaceUnselect
	 * listener invoked by the workspace when its selection changes; updates the tree's selection to match
	 * @param {Workspace.Object} item
	 */
    onWorkspaceUnselect: function(item){
        if (!this.ignoreSelectionChange){
            this.ignoreSelectionChange = true;
            var n = this.findNodeForObject(item);
            if (n){
                n.unselect();
            }
            this.ignoreSelectionChange = false;
        }
    },
    /**
	 * onCreate
	 * listener invoked by the workspace when an object is constructed; builds a node for it in the tree
	 * @param {Workspace.Object} obj
	 */
    onCreate: function(obj){
        var parentNode;
        /*
		if (obj.hasParent()) {
			parentNode = this.findNodeForObject(obj.getParent());
		}
		else {
		*/
        parentNode = this.getRootNode();

        if (parentNode){
            parentNode.appendChild(new Ext.tree.TreeNode({
                text: obj.get('name'),
                id: obj.getId(),
                iconCls: obj.get('iconCls'),
                editable: true
            }));
        }
        obj.on('change', this.onChange, this);
    },
    /**
	 * onObjectDestroy
	 * listener invoked by the workspace when an object is constructed; builds a node for it in the tree
	 * @param {Workspace.Object} obj
	 */
    onObjectDestroy: function(obj){
        var node = this.findNodeForObject(obj);
        if (node){
            node.remove();
            node.destroy();
        }
        obj.un('change', this.onChange, this);
    },

    /**
	 * onChange
	 * listener invoked by an object when one of its properties is changed; updates the tree to match
	 * @param {String} prop
	 * @param {Mixed} value
	 * @param {Workspace.Object} obj
	 */
    onChange: function(prop, value, obj){
        if (!this.ignoreChange){
            if (prop == 'name'){
                var node = this.findNodeForObject(obj);
                if (node){
                    node.setText(value);
                }
            }
            else
            if (prop == 'parent'){
                var node = this.findNodeForObject(obj),
                parentNode = this.findNodeForObject(obj.getParent());
                if (parentNode){
                    node.remove(false);
                    parentNode.appendChild(node);
                }
            }
        }
    },
})

/**
 * @class Ext.ux.BoundObjectPanel
 * Allows ribbon tabs to be bound to {@link Workspace.Object}s and fields within the panel to be bound to object properties.
 * Components within this panel which contain an {@link #objectBinding} property will be set to the value of that property when objects are bound, and
 * changes to those components triggering the change event (or another event specified in {@link #objectBindingEvent}) will cause {@link WorkspaceAction}s
 * to be generated and applied to the attached workspace.
 * @extends Ext.Panel
 */
Ext.ux.BoundObjectPanel = Ext.extend(Ext.Panel, {
    initComponent: function(){
        Ext.ux.BoundObjectPanel.superclass.initComponent.apply(this, arguments);

        this.addEvents('action');
        
        // objects which have been bound to this panel with #bind
        this.boundObjects = new Workspace.ObjectCollection();

        // fields which specify an objectBinding
        this.boundFields = new Ext.util.MixedCollection();
        
        // fields which specify a displayIf or an enableIf function
        this.dynamicFields = new Ext.util.MixedCollection();

        // collect all fields with object bindings specified
        var boundFields = this.findBy(function(cmp){
                return (Ext.isDefined(cmp.objectBinding) && cmp.objectBinding != '');
            },this),
            dynamicFields = this.findBy(function(cmp){
                return (Ext.isFunction(cmp.enableIf) || Ext.isFunction(cmp.showIf));
            },this);
        

        // oh, yeah and look in the toolbar too since that's where they're ALL going to be
        if (this.topToolbar){
            boundFields = boundFields.concat(this.topToolbar.findBy(function(cmp){
                return (Ext.isDefined(cmp.objectBinding) && cmp.objectBinding != '');
            },this));
            dynamicFields = dynamicFields.concat(this.topToolbar.findBy(function(cmp){
                return (Ext.isFunction(cmp.enableIf) || Ext.isFunction(cmp.showIf));
            },this));
        }

        // index fields and add event handlers
        Ext.each(boundFields,
        function(field){
            var eventName = field.objectBindingEvent || 'change';
            field.addListener(eventName, this.updateObjects, this);
            this.boundFields.add(field.objectBinding, field);
        },this);

        this.dynamicFields.addAll(dynamicFields);

        this.on('afterrender', this.buildTips, this);
        this.on('afterrender', this.updateDynamicFields, this);
    },
    buildTips: function(){
        // collect all fields with tooltip configs specified
        var tips = this.findBy(function(cmp){
            return (Ext.isDefined(cmp.tooltip) && cmp.tooltip != '' && !cmp.isXType('button', true));
        },
        this);

        // oh, yeah and look in the toolbar too since that's where they're ALL going to be
        if (this.topToolbar){
            tips = tips.concat(this.topToolbar.findBy(function(cmp){
                return (Ext.isDefined(cmp.tooltip) && cmp.tooltip != '' && !cmp.isXType('button', true));
            },
            this));
        }
        this.tips = [];
        Ext.each(tips,
        function(field){
            if (field.tooltip){
                var t = field.tooltip;
                if (t.text && !t.html){
                    t.html = t.text;
                }
                t.target = field.getEl();
                this.tips.push(new Ext.ToolTip(t));
            }
        },
        this)
    },
    /**
   * updateObjects
   * listener invoked by bound field on change (or other {@link #objectBinding} event); generates a {@link WorkspaceAction} to update
   * the specified propery in all bound objects
   * @param {Object} field
   * @param {Object} newValue
   * @param {Object} oldValue
   */
    updateObjects: function(field, newValue, oldValue){
        if (!this.ignoreNext){
            if (field.objectBinding){
                var values = {},
                action;
                values[field.objectBinding] = newValue;

                // Build WorkspaceAction
                action = new Workspace.Actions.ChangePropertyAction({
                    values: values,
                    subjects: this.boundObjects.getRange()
                });

                this.fireEvent('action', action);
            }
        }
    },
    /**
   * updateFields
   * Updates the fields in this ribbon to match the values in this object
   * @param {Workspace.Object} item
   */
    updateFields: function(item){
        this.boundFields.each(function(field){
            if (item.has(field.objectBinding)){
                field.setValue(item.get(field.objectBinding));
            }
        },
        this);
    },
    /**
   * updateFieldsHandler
   * Called when bound objects change
   * @param {Object} prop
   * @param {Object} val
   * @param {Object} item
   */
    updateFieldsHandler: function(prop, val, item){
        if (this.boundFields.containsKey(prop)){
            var f = this.boundFields.get(prop);
            this.ignoreNext = true;
            f.setValue(val);
            this.ignoreNext = false;
        }
    },
    updateDynamicFields: function() {
      var common = this.boundObjects.getCommonWType();
      this.dynamicFields.each(function(f) {
        if(Ext.isFunction(f.showIf)) {
          if(f.showIf(common,this.boundObjects,this)) 
            f.show();
          else 
            f.hide();
        }
        if(Ext.isFunction(f.enableIf)) {
          if(f.enableIf(common,this.boundObjects,this)) 
            f.enable();
          else 
            f.disable();
        }
      },this);
    },
    /**
   * bind
   * Attaches the given object to this panel, so that changes in the panel will be reflected in the object
   * @param {Workspace.Object} item
   */
    bind: function(item){
        if (!this.boundObjects.containsKey(item.getId())){
            this.boundObjects.add(item.getId(), item);
            if (this.boundObjects.length == 1){
                this.updateFields(item);
            }
            this.mon(item, 'change', this.updateFieldsHandler, this);
            this.updateDynamicFields();
        }
    },
    /**
   * unbind
   * Detaches the given object from this panel
   * @param {Workspace.Object} item
   */
    unbind: function(item){
        if (item){
            if (this.boundObjects.containsKey(item.getId())){
                this.boundObjects.removeKey(item.getId());
                this.mun(item, 'change', this.updateFieldsHandler, this);
            }
        } else{
            this.boundObjects.clear();
        }
        this.updateDynamicFields();
    },

    /**
     * destroy
     */
    destroy: function(){
        Ext.each(this.tips,
        function(tip){
            tip.destroy();
        });
        Ext.ux.BoundObjectPanel.superclass.destroy.apply(this, arguments);

    }
});

/**
 * @class Ext.ux.ObjectProperties
 * Allows creation and editing object properties
 * @extends Ext.ux.BoundObjectPanel
 */

Ext.ux.ObjectProperties = function(){
    Ext.ux.ObjectProperties.superclass.constructor.apply(this, arguments);
}

Ext.extend(Ext.ux.ObjectProperties, Ext.ux.BoundObjectPanel, {
    initComponent: function(){
        Ext.apply(this, {
            title: 'Selected Object',
            layout: 'fit',
            items: [{
                xtype: 'propertygrid',
                ref: 'grid',
                border: false
            }]
        });
        Ext.ux.ObjectProperties.superclass.initComponent.apply(this,arguments);
        this.grid.on('propertychange',this.onPropertyChange,this);
    },
    bind: function(obj) {
      this.unbind();
      this.boundObject = obj;
      this.boundObject.on('change',this.onObjectChange,this);
      this.grid.setSource(obj.getReadableHash());
    },
    unbind: function() {
      if(this.boundObject) {
        this.boundObject.un('change',this.onObjectChange,this);
        this.grid.setSource({});
        this.boundObject = false;
      }
    },
    onObjectChange: function(prop, val) {
      if(!this.ignore)
        this.grid.setProperty(prop,val,true);
    },
    onPropertyChange: function(src,prop,value) {
      if(this.boundObject) {
        this.boundObject.set(prop,value);
      }
    },
    attachTo: function(workspace){
        this.workspace = workspace;

        // bind ribbon to objects when selected in workspace
        this.mon(this.workspace, 'select', this.bind, this);
        this.mon(this.workspace, 'unselect', this.unbind, this);

    },
})

/**
 * @class Ext.ux.ToolsTab
 * Manages the tool palate and provides several object actions
 * @extends Ext.ux.BoundObjectPanel
 */
Ext.ux.ToolsTab = Ext.extend(Ext.ux.BoundObjectPanel, {
    /**
	 * @cfg {String} tool
	 * The default tool
	 */
    tool: 'pointer',
    generateConfig: function() {
      return {
            tbar: [{

                // 'Tools' group
                xtype: 'buttongroup',
                title: 'Tools',
                columns: 2,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [{
                    iconCls: 'cursor',
                    enableToggle: true,
                    toggleGroup: 'toolbox',
                    toolName: 'pointer',
                    pressed: true,
                    tooltip: {
                        title: 'Pointer Tool',
                        text: 'Select, move, and resize objects. Click objects or drag boxes around them to select. Grab and drag to move. Drag hangles to resize (objects without handles can\'t be resized).'
                    }
                },
                {
                    iconCls: 'pencil',
                    enableToggle: true,
                    toggleGroup: 'toolbox',
                    toolName: 'pencil',
                    tooltip: {
                        title: 'Pencil Tool',
                        text: 'Draw freehand objects. Click and drag to start drawing; release to finish.'
                    }
                },
                {
                    iconCls: 'idea',
                    toggleGroup: 'toolbox',
                    enableToggle: true,
                    toolName: 'idea',
                    tooltip: {
                        title: 'Idea Tool',
                        text: 'Group objects into ideas. Drag a box around a group of objects to make an idea.'
                    }
                },
                {
                    iconCls: 'connector',
                    toggleGroup: 'toolbox',
                    enableToggle: true,
                    toolName: 'connector',
                    tooltip: {
                        title: 'Connector Tool',
                        text: 'Draw connections between objects. Click one point or object and drag to another point or object.'
                    }
                },

                /*{
         iconCls: 'vector',
         toggleGroup: 'toolbox',
         enableToggle: true,
         disabled: true,
         tooltip: {title: 'Vector Tool', text:'Edit shapes'}
         },*/
                ]
            },
            
            {

                // 'Object' group
                xtype: 'buttongroup',
                title: 'Object',
                columns: 3,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [{
                    scale: 'medium',
                    rowspan: 2,
                    iconAlign: 'top',
                    iconCls: 'delete-24',
                    text: 'Delete',
                    handler: this.deleteObjects,
                    scope: this,
                    tooltip: {
                        title: 'Delete',
                        text: 'Deletes the selected objects.'
                    },
                    enableIf: function(com,bound) {
                      return bound.getCount()>0;
                    } 
                },
                {
                    disabled: true,
                    scale: 'medium',
                    rowspan: 2,
                    iconAlign: 'top',
                    iconCls: 'duplicate-24',
                    text: 'Duplicate',
                    handler: this.duplicateObjects,
                    scope: this,
                    tooltip: {
                        title: 'Duplicate',
                        text: 'Inserts a copy of the selected objects.'
                    }
                },
                {

                    ref: '../../nameField',
                    fieldLabel: 'Name',
                    objectBinding: 'name',
                    xtype: 'textfield',
                    width: 150,
                    tooltip: {
                        title: 'Name',
                        text: 'The object\'s name'
                    },
                },
                {
                    ref: '../../typeField',
                    xtype: 'combo',
                    objectBinding: 'wtype',
                    store: Workspace.Components.getTypeStore(),
                    tpl: new Ext.XTemplate(
                    '<tpl for="."><div class="x-combo-list-item">',
                    '<img src="' + Ext.BLANK_IMAGE_URL + '" class="combo-icon {iconCls}" />&nbsp;<span>{wtype}</span>',
                    '</div></tpl>'
                    ),
                    valueField: 'wtype',
                    displayField: 'wtype',
                    typeAhead: true,
                    mode: 'local',
                    forceSelection: true,
                    triggerAction: 'all',
                    selectOnFocus: true,
                    width: 150,
                    tooltip: {
                        title: 'Type',
                        text: 'The object type.'
                    }
                }]
            },
            {

                // 'Idea' group
                xtype: 'buttongroup',
                title: 'Idea',
                columns: 2,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [
                {
                    scale: 'medium',
                    rowspan: 2,
                    iconAlign: 'top',
                    iconCls: 'idea-form-24',
                    text: 'Form idea',
                    tooltip: {
                        title: 'Form idea',
                        text: 'Makes a new idea from the selected objects. Select the objects you want to add to an idea, then click this button'
                    },
                    handler: this.formIdea,
                    scope: this,
                    enableIf: function(com,bound) {
                      return bound.getCount() > 0;
                    }
                },
                {
                    iconCls: 'idea-remove',
                    text: 'Remove from Idea',
                    rowspan: 1,
                    handler: this.orphanObjects,
                    scope: this,
                    tooltip: {
                        title: 'Remove from Idea',
                        text: 'Removes the selected objects from the idea they\'re a part of (if any).'
                    },
                    enableIf: function(com,bound) {
                      var p = false;
                      bound.each(function(f){
                        if(f.hasParent()) { p = true; return false; }
                      });
                      return p;
                    }
                },
                {
                    iconCls: 'idea-add',
                    text: 'Add to Idea',
                    rowspan: 1,
                    toolName: 'idea-add',
                    enableToggle: true,
                    toggleGroup: 'toolbox',
                    tooltip: {
                        title: 'Add this to Idea',
                        text: 'Allows you to add the selected object(s) to an idea. Select the objects you want to add to an idea, then click this button, then click an idea.'
                    }
                }]

            },
            // not implemented
            // 'Transform' group
            /*{
       xtype:'buttongroup',
       title:'Transform',
       columns: 4,
       items:[{
       iconCls: 'rotate-left'
       },{
       iconCls: 'rotate-right'
       },{
       iconCls: 'flip-horiz'
       },{
       iconCls: 'flip-vert'
       },{
       iconCls: 'arrange-forward'
       },{
       iconCls: 'arrange-backwards'
       },{
       iconCls: 'arrange-front'
       },{
       iconCls: 'arrange-back'
       }]
       },*/
            '->', {

                // 'Workspace' group
                xtype: 'buttongroup',
                title: 'Workspace',
                columns: 4,
                items: [{
                    scale: 'medium',
                    iconCls: 'undo-24',
                    text: 'Undo',
                    rowspan: 2,
                    iconAlign: 'top',
                    handler: this.undo,
                    scope: this,
                    ref: '../undoButton',
                    disabled: true
                },
                {
                    scale: 'medium',
                    iconCls: 'redo-24',
                    text: 'Redo',
                    rowspan: 2,
                    iconAlign: 'top',
                    handler: this.redo,
                    scope: this,
                    ref: '../undoButton',
                    disabled: true
                },
                {
                    scale: 'medium',
                    iconCls: 'save-24',
                    text: 'Save',
                    rowspan: 2,
                    iconAlign: 'top',
                    handler: this.saveWorkspace,
                    scope: this
                },
                {
                    scale: 'medium',
                    iconCls: 'document-24',
                    text: 'Expand',
                    rowspan: 2,
                    iconAlign: 'top',
                    handler: this.expandWorkspace,
                    scope: this
                }]
            },
            {
                // 'User' group
                xtype: 'buttongroup',
                title: 'User',
                columns: 1,
                items: [{
                    scale: 'small',
                    iconCls: 'user',
                    text: App.User.name,
                    rowspan: 1,
                    iconAlign: 'left',
                    //handler: ,
                    //scope: this  
                },
                {
                    scale: 'small',
                    iconCls: 'key',
                    text: 'Logout',
                    rowspan: 1,
                    iconAlign: 'left',
                    //handler: ,
                    //scope: this  
                }]
            }]
        };
    },
    initComponent: function(){
        this.addEvents('toolChange');
        Ext.apply(this, this.generateConfig());

        Ext.ux.ToolsTab.superclass.initComponent.apply(this, arguments);

        // dictionary of all buttons with configured toolName bindings
        this.toolButtons = new Ext.util.MixedCollection();

        // collect all buttons with tool bindings specified
        var toolButtons = this.findBy(function(cmp){
            return (Ext.isDefined(cmp.toolName) && cmp.toolName != '');
        },
        this);

        if (this.topToolbar){
            toolButtons = toolButtons.concat(this.topToolbar.findBy(function(cmp){
                return (Ext.isDefined(cmp.toolName) && cmp.toolName != '');
            },
            this));
        }

        // index buttons and add event handlers
        Ext.each(toolButtons,
        function(button){
            button.addListener('toggle', this.onToggle, this);
            this.toolButtons.add(button.toolName, button);
        },
        this);

        // not implemented
        //		this.uploaderWindow = new Ext.Window({
        //			title: 'Upload files',
        //			closeAction: 'hide',
        //			frame: true,
        //			width: 500,
        //			height: 200,
        //			items: {
        //				xtype: 'awesomeuploader',
        //				gridHeight: 100,
        //				height: 160,
        //				awesomeUploaderRoot: '/scripts/awesomeuploader_v1.3.1/',
        //				listeners: {
        //					scope: this,
        //					fileupload: function(uploader, success, result){
        //						if (success) {
        //							Ext.Msg.alert('File Uploaded!', 'A file has been uploaded!');
        //						}
        //					}
        //				}
        //			}
        //		});
    },
    // not implemented
    pushUndo: function(action){
        this.undoStack.push(action);
        this.rebuildUndo();
    },
    // not implemented
    popUndo: function(){
        var a = this.undoStack.pop();
        this.rebuildUndo();
        return a;
    },
    // not implemented
    rebuildUndo: function(){
        this.undoButton.menu.removeAll();
        this.undoButton.menu.add(this.undoStack);
        if (this.undoStack.length > 0){
            this.undoButton.enable();
        }
        else{
            this.undoButton.disable();
        }
    },
    // not implemented
    undo: function(){
        this.fireEvent('undo', this);
    },
    // not implemented
    redo: function(){
        this.fireEvent('redo', this)
    },
    /**
	 * deleteObjects
	 * Generates a WorksapceAction to delete the bound objects
	 */
    deleteObjects: function(){
        var action = new Workspace.Actions.DeleteObjectAction({
            subjects: this.boundObjects.getRange()
        });
        this.fireEvent('action', action);
    },
    /**
   * duplicateObjects
   * Generates a WorksapceAction to delete the bound objects
   */
    duplicateObjects: function(){
        var action = new Workspace.Actions.DuplicateObjectAction({
            objects: this.boundObjects.getRange()
        });
        this.fireEvent('action', action);
    },
    /**
	 * orphanObjects
	 * Generates a WorksapceAction to decouple the bound objects from their parent(s)
	 */
    orphanObjects: function(){
        var action = new Workspace.Actions.OrphanObjectAction({
            subjects: this.boundObjects.getRange()
        });
        this.fireEvent('action', action);
    },
    /**
     * formIdea
     * Generates a WorkspaceAction to build an idea from the current selection
     */
    formIdea: function(){
        var action = new Workspace.Actions.FormIdeaAction({
            subjects: this.boundObjects.getRange()
        });
        this.fireEvent('action', action);
    },
    /**
	 * expandWorkspace
	 * Generates a WorkspaceAction to expand the size of the workspace
	 */
    expandWorkspace: function(){
        var action = new Workspace.Actions.ExpandAction({});
        this.fireEvent('action', action);
    },
    /**
	 * saveWorkspace
	 * Generates an event notifying the parent canvas to save the workspace
	 */
    saveWorkspace: function(){
        this.fireEvent('save', this);
    },
    /**
	 * onToggle
	 * Event handler automatically applied to buttons with configured {@link #toolName}s
	 * @param {Ext.Button} btn
	 * @param {Boolean} pressed
	 */
    onToggle: function(btn, pressed){
        if (pressed){
            this.setActiveTool(btn.toolName);
        }
    },

    /**
	 * getActiveTool
	 * Gets the name of the currently active tool
	 * @return {String} toolName
	 */
    getActiveTool: function(){
        return this.tool;
    },
    /**
   * setActiveTool
   * Allows Tools tab in ribbon to set the active workspace tool
   * @param {String} tool
   */
    setActiveTool: function(tool){
        if (!this.ignoreToolChange){
            this.tool = tool;
            this.fireEvent('toolChange', tool);
        }
    },
    /**
   * onToolChange
   * Responds to workspace toolChange event and updates UI to reflect
   * @param {String} tool
   */
    onToolChange: function(tool){
        var button = this.toolButtons.get(tool);
        if (button){
            this.ignoreToolChange = true;
            button.toggle(true);
            this.tool = tool;
            this.fireEvent('toolChange');
            this.ignoreToolChange = false;
        }
    }
});


Ext.ux.InsertTab = Ext.extend(Ext.ux.ToolsTab,{
  generateConfig: function() {
    return {
      tbar:[{
        // 'Insert' group 
        xtype: 'buttongroup',
        title: 'Insert',
        columns: 5,
        defaults: {
            cellCls: 'table-cell-padded'
        },
        items: [{
            iconCls: 'line',
            enableToggle: true,
            toggleGroup: 'toolbox',
            toolName: 'line',
            tooltip: {
                title: 'Line',
                text: 'Draw straight lines. Click and drag to draw a line; release to finish.'
            }
        },
        {
            iconCls: 'rect',
            enableToggle: true,
            toggleGroup: 'toolbox',
            toolName: 'rect',
            tooltip: {
                title: 'Rectangle',
                text: 'Draw rectangles. Click and drag a box to draw; release to finish.'
            }
        },
        {
            iconCls: 'ellipse',
            toggleGroup: 'toolbox',
            enableToggle: true,
            toolName: 'ellipse',
            tooltip: {
                title: 'Ellipse',
                text: 'Draw ellipses. Click and drag to draw; release to finish.'
            }
        },
        {
            iconCls: 'polygon',
            toggleGroup: 'toolbox',
            enableToggle: true,
            tooltip: {
                title: 'Polygon',
                text: 'Draw closed polygons. Click once to start drawing; each click adds a point. Double-click to finish'
            },
            toolName: 'polygon'
  
        },
        {
            iconCls: 'path',
            toggleGroup: 'toolbox',
            enableToggle: true,
            toolName: 'polyline',
            tooltip: {
                title: 'Polylines',
                text: 'Draw open polygons. Click once to start drawing; each click adds a point. Double-click to finish'
            }
        },
        {
            iconCls: 'text-icon',
            enableToggle: true,
            toggleGroup: 'toolbox',
            toolName: 'textbox',
            tooltip: {
                title: 'Text Tool',
                text: 'Enter and edit text. Click or click and drag to insert a textbox. Click a textbox to edit text.'
            }
        },
        {
            iconCls: 'math-icon',
            toggleGroup: 'toolbox',
            enableToggle: true,
            toolName: 'math',
            tooltip: {
                title: 'Equations',
                text: 'Insert mathematical equations. Click and drag to draw an equation box.'
            }
        },]
                /*{
         iconCls: 'curve',
         toggleGroup: 'toolbox',
         enableToggle: true,
         toolName: 'curve',
         disabled: true,
         },{
         iconCls: 'image',
         enableToggle: false,
         disabled: true,
         handler: function() {
         this.uploaderWindow.show();
         },
         scope: this
         }*/
                
      }]
    };
  }
});


/**
 * @class Ext.ux.FillStrokeTab
 * A ribbon tab to manage setting the fill and stroke of objects
 * @extends Ext.ux.BoundObjectPanel
 */
Ext.ux.FillStrokeTab = Ext.extend(Ext.ux.BoundObjectPanel, {
    initComponent: function(){
        Ext.apply(this, {
            tbar: [{

                // 'Fill' group
                xtype: 'buttongroup',
                title: 'Fill',
                columns: 1,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [new Ext.ux.ColorField({
                    ref: '../../fillColorField',
                    fieldLabel: 'Fill Color',
                    objectBinding: 'fill',
                    width: 100,
                    tooltip: {
                        title: 'Fill Color',
                        text: 'Color of the object\'s background (fill).'
                    },
                }), {
                    ref: '../../fillOpacityField',
                    xtype: 'slider',
                    objectBinding: 'fillOpacity',
                    objectBindingEvent: 'changecomplete',
                    minValue: 0,
                    maxValue: 1,
                    decimalPrecision: 2,
                    animate: true,
                    plugins: new Ext.slider.Tip({
                        getText: function(thumb){
                            return String.format('{0}%', thumb.value * 100);
                        }
                    }),
                    width: 100,
                    tooltip: {
                        title: 'Fill Opacity',
                        text: 'Opacity/transparency of the stroke.'
                    },
                }]
            },
            {

                // 'Stroke' group
                xtype: 'buttongroup',
                title: 'Stroke',
                columns: 2,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [new Ext.ux.ColorField({
                    ref: '../../strokeColorField',
                    anchor: 'left',
                    objectBinding: 'stroke',
                    width: 100,
                    tooltip: {
                        title: 'Stroke Color',
                        text: 'Color of the object\'s outline (stroke).'
                    },
                }), {
                    ref: '../../strokeTypeField',
                    xtype: 'combo',
                    objectBinding: 'strokeDasharray',
                    store: new Ext.data.ArrayStore({
                        fields: ['name', 'dash_array'],
                        data: [['solid', ''], ['dashed', '--'], ['dashed', '-'], ['dashed', '- '], ['dotted', '.'], ['dotted', '. '], ['dashed/dotted', '-.'], ['dashed/dotted', '-..'], ['dashed/dotted', '- .'], ['dashed/dotted', '--.'], ['dashed/dotted', '--..']]
                    }),
                    tpl: new Ext.XTemplate(
                    '<tpl for="."><div class="x-combo-list-item">',
                    '<span>{name}</span>&nbsp;(<var>{dash_array}</var>)',
                    '</div></tpl>'
                    ),
                    valueField: 'dash_array',
                    displayField: 'dash_array',
                    typeAhead: true,
                    mode: 'local',
                    forceSelection: true,
                    triggerAction: 'all',
                    selectOnFocus: true,
                    width: 100,
                    tooltip: {
                        title: 'Stroke Type',
                        text: 'Style of the stroke (solid, dashed, etc.).'
                    },
                    cellCls: 'table-cell-padded-right'
                },
                {
                    ref: '../../strokeOpacityField',
                    xtype: 'slider',
                    objectBinding: 'strokeOpacity',
                    objectBindingEvent: 'changecomplete',
                    minValue: 0,
                    maxValue: 1,
                    decimalPrecision: 2,
                    animate: true,
                    plugins: new Ext.slider.Tip({
                        getText: function(thumb){
                            return String.format('{0}%', thumb.value * 100);
                        }
                    }),
                    width: 100,
                    tooltip: {
                        title: 'Stroke Opacity',
                        text: 'Opacity/transparency of the stroke.'
                    },
                },
                {
                    ref: '../../strokeWidthField',
                    xtype: 'slider',
                    objectBinding: 'strokeWidth',
                    objectBindingEvent: 'changecomplete',
                    minValue: 0,
                    maxValue: 10,
                    decimalPrecision: 1,
                    increment: 0.5,
                    animate: true,
                    plugins: new Ext.slider.Tip({
                        getText: function(thumb){
                            return String.format('{0} px', thumb.value);
                        }
                    }),
                    width: 100,
                    cellCls: 'table-cell-padded-right',
                    tooltip: {
                        title: 'Stroke Width',
                        text: 'Width of the object\'s outline (stroke).'
                    },
                }]

            }]
        });

        Ext.ux.FillStrokeTab.superclass.initComponent.apply(this, arguments);

        //this.on('afterrender', this.afterrender, this);
    },

});

/**
 * @class Ext.ux.GeometryTab
 * Ribbon panel which displays the position and dimensions of an object
 * @extends Ext.ux.BoundObjectPanel
 */
Ext.ux.GeometryTab = Ext.extend(Ext.ux.BoundObjectPanel, {
    initComponent: function(){
        Ext.apply(this, {
            tbar: [{

                // Position group
                xtype: 'buttongroup',
                title: 'Position',
                columns: 1,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [{
                    ref: '../../xField',
                    fieldLabel: 'X',
                    objectBinding: 'x',
                    xtype: 'numberfield',
                    width: 100,
                    tooltip: {
                        title: 'x position',
                        text: 'The object\'s x position'
                    },
                },
                {
                    ref: '../../yField',
                    fieldLabel: 'Y',
                    objectBinding: 'y',
                    xtype: 'numberfield',
                    width: 100,
                    tooltip: {
                        title: 'y position',
                        text: 'The object\'s y position'
                    },
                }]
            },
            {

                // Dimensions group
                xtype: 'buttongroup',
                title: 'Dimensions',
                columns: 1,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [{
                    ref: '../../widthField',
                    fieldLabel: 'Width',
                    objectBinding: 'width',
                    xtype: 'numberfield',
                    width: 100,
                    tooltip: {
                        title: 'Width',
                        text: 'The object\'s width'
                    },
                },
                {
                    ref: '../../heightField',
                    fieldLabel: 'Height',
                    objectBinding: 'height',
                    xtype: 'numberfield',
                    width: 100,
                    tooltip: {
                        title: 'Height',
                        text: 'The object\'s height'
                    },
                }]
            }]
        });

        Ext.ux.GeometryTab.superclass.initComponent.apply(this, arguments);

        //this.on('afterrender', this.afterrender, this);
    },
    afterrender: function(){
        var tips = [this.xField, this.tField, this.widthField, this.heightField];
        this.tips = [];
        Ext.each(tips,
        function(field){
            if (field.tooltip){
                var t = field.tooltip;
                if (t.text && !t.html){
                    t.html = t.text;
                }
                t.target = field.getEl();
                this.tips.push(new Ext.ToolTip(t));
            }
        },
        this)
    }
});

/**
 * @class Ext.ux.MetaTab
 * Ribbon panel which displays properties of an object 
 * @extends Ext.ux.BoundObjectPanel
 */
Ext.ux.MetaTab = Ext.extend(Ext.ux.BoundObjectPanel, {
    initComponent: function(){
        Ext.apply(this, {
            tbar: [{

                // Name group
                xtype: 'buttongroup',
                title: 'Name',
                columns: 1,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: [{
                    ref: '../../nameField',
                    fieldLabel: 'Name',
                    objectBinding: 'name',
                    xtype: 'textfield',
                    width: 200,
                    tooltip: {
                        title: 'Name',
                        text: 'The object\'s name'
                    },
                },
                {
                    ref: '../../typeField',
                    xtype: 'combo',
                    objectBinding: 'wtype',
                    store: Workspace.Components.getTypeStore(),
                    tpl: new Ext.XTemplate(
                    '<tpl for="."><div class="x-combo-list-item">',
                    '<img src="' + Ext.BLANK_IMAGE_URL + '" class="combo-icon {iconCls}" />&nbsp;<span>{wtype}</span>',
                    '</div></tpl>'
                    ),
                    valueField: 'wtype',
                    displayField: 'wtype',
                    typeAhead: true,
                    mode: 'local',
                    forceSelection: true,
                    triggerAction: 'all',
                    selectOnFocus: true,
                    width: 200,
                    tooltip: {
                        title: 'Type',
                        text: 'The object type.'
                    },
                    cellCls: 'table-cell-padded-right'
                }]
            },
            {

                // Properties group
                xtype: 'buttongroup',
                title: 'Properties',
                columns: 1,
                defaults: {
                    cellCls: 'table-cell-padded'
                },
                items: []
            }]
        });

        Ext.ux.MetaTab.superclass.initComponent.apply(this, arguments);

        //this.on('afterrender', this.afterrender, this);
    },
    afterrender: function(){
        var tips = [this.nameField];
        this.tips = [];
        Ext.each(tips,
        function(field){
            if (field.tooltip){
                var t = field.tooltip;
                if (t.text && !t.html){
                    t.html = t.text;
                }
                t.target = field.getEl();
                this.tips.push(new Ext.ToolTip(t));
            }
        },
        this)
    }
});

// Deprecated
Ext.ux.VectorObjectInspector = Ext.extend(Ext.Window, {
    initComponent: function(){
        Ext.apply(this, {
            boundObjects: new Ext.util.MixedCollection(),
            plain: true,
            width: 220,
            border: false,
            tbar: [{
                xtype: 'buttongroup',
                title: 'Fill',
                columns: 1,
                items: [new Ext.ux.ColorField({
                    ref: '../fillColorField',
                    fieldLabel: 'Fill Color',
                    listeners: {
                        'change': {
                            scope: this,
                            fn: this.updateFillColor
                        }
                    }
                }), {
                    ref: '../fillOpacityField',
                    xtype: 'slider',
                    listeners: {
                        'change': {
                            scope: this,
                            fn: this.updateFillOpacity
                        }
                    }
                }]

            },
            {
                xtype: 'buttongroup',
                title: 'Stroke',
                columns: 1,
                items: [new Ext.ux.ColorField({
                    ref: '../strokeColorField',
                    anchor: 'right',
                    listeners: {
                        'change': {
                            scope: this,
                            fn: this.updateStrokeColor
                        }
                    }
                }), {
                    ref: '../strokeWidthField',
                    xtype: 'slider',
                    anchor: 'right',
                    listeners: {
                        'change': {
                            scope: this,
                            fn: this.updateStrokeWidth
                        }
                    }
                }]

            }]
        });

        if (this.item){
            this.boundObjects.add(item.getId(), item);
        }

        this.on('afterrender', this.position, this);
        Ext.ux.VectorObjectInspector.superclass.initComponent.call(this);
    },
    updateObjects: function(field, value){
        this.boundObjects.each(function(item){
            item.set(field, value);
        });
    },
    updateFillColor: function(field, value){
        this.updateObjects('fill', value);
    },
    updateFillOpacity: function(field, value){
        this.updateObjects('fillOpacity', value);
    },
    updateStrokeWidth: function(field, value){
        this.updateObjects('strokeWidth', value * 10);
    },
    updateStrokeColor: function(field, value){
        this.updateObjects('stroke', value);
    },
    position: function(){
        if (this.boundObjects.length == 1){
            var item = this.boundObjects.itemAt(0),
            pos = item.getAbsolutePosition();
            this.setPagePosition(parseInt(pos.x + item.getWidth() + 20), parseInt(pos.y - 10));
        }
    },
    updateValuesToMatch: function(item){
        this.fillColorField.setValue(item.get('fill'));
        this.strokeColorField.setValue(item.get('stroke'));
        this.fillOpacityField.setValue(item.get('fillOpacity'));
        this.strokeWidthField.setValue(item.get('strokeWidth'));
    },
    bind: function(item){
        if (!this.boundObjects.containsKey(item.getId())){
            this.boundObjects.add(item.getId(), item);
            if (this.boundObjects.length == 0){
                this.updateValuesToMatch(item);
            }
        }
        this.position();
        this.show();
    },
    unbind: function(item){
        if (item){
            if (!Ext.isFunction(item.getId)){
                if (this.boundObjects.containsKey(item)){
                    this.boundObjects.removeKey(item);
                }
            } else{
                if (this.boundObjects.containsKey(item.getId())){
                    this.boundObjects.removeKey(item.getId());
                }
            }
        } else{
            this.boundObjects.clear();
        }
        if (this.boundObjects.length == 0){
            this.hide();
        }
    },
    showIfBound: function(){
        if (this.boundObjects.length > 0){
            this.show();
            this.position();
        }
    }
});

// deprecated
//Ext.ux.SidebarInspector = Ext.extend(Ext.Panel,{
//	initComponent: function() {
//		Ext.apply(this,{
//			items: [{
//				xtype: 'fieldset',
//				title: 'Fill',
//					ref: '../fillColorField',
//				items: [new Ext.ux.ColorField({
//					fieldLabel:'Fill Color'
//				}), {
//					ref: '../fillOpacityField',
//					xtype: 'slider',
//					fieldLabel: 'Fill Opacity'
//				}]
//			},{
//				xtype: 'fieldset',
//				title: 'Stroke',
//				items: [new Ext.ux.ColorField({
//					fieldLabel:'Stroke Color'
//				}), {
//					ref: '../strokeOpacityField',
//					xtype: 'slider',
//					fieldLabel: 'Stroke Opacity'
//				}, {
//					ref: '../strokeWidthField',
//					xtype: 'slider',
//					fieldLabel: 'Stroke Width'
//				}]
//			}]	
//		});
//	},
//	frame: true,
//	title: 'Inspector',
//})
//
//
// Deprecated
//Ext.ux.Inspector = Ext.extend(Ext.Window, {
//	initComponent: function() {
//		if(this.item) {
//			var items = [];
//			var t = this.item.getType();
//			if(t) {
//				items.push(Ext.apply({
//					item: this.item
//				},t.editorConfig));
//				Ext.apply(this,{
//					layout: 'fit',
//					autoShow: true,
//					renderTo: document.body,
//					width: 280,
//					height: 200,
//					minHeight: 200,
//					plain: true,
//					border: false,
//					items: items
//				});	
//			}
//		}
//		this.on('afterrender',this.position,this);
//		Ext.ux.Inspector.superclass.initComponent.call(this);
//	},
//	position: function() {
//		
//		if(this.item) {
//			var pos = this.item.getAbsolutePosition();
//			this.setPagePosition(parseInt(pos.x+this.item.getWidth()+20),parseInt(pos.y-10));
//		}	
//	}
//});
//
//
// Deprecated
//Ext.ux.InfoMachineObjectEditor = Ext.extend(Ext.FormPanel, {
//	initComponent: function() {
//		if(this.item) {
//			var items = [];
//			/*
//			var groups = {};
//			if(this.groups) {
//				for(var groupName in this.groups) {
//					var group = this.groups[groupName];
//					var fieldSet = { xtype: 'fieldset', items: [] }
//				}	
//			}
//			*/
//			
//			this.item.eachField(function(fieldName,field) {
//				var t = InfoMachine.getType(field.type);
//				var editorConfig = Ext.apply({
//					item: this.item,
//					fieldBinding: fieldName,
//					listeners: {
//						'change': function(field, newValue, oldValue) {
//							if(field.item && field.isValid()) {
//								field.item.set(field.fieldBinding, newValue);
//							}	
//						}	
//					}
//				},t.editorConfig);
//				
//				editorConfig.fieldLabel = field.canonical || '';
//				items.push(editorConfig);
//			},this);
//			
//			
//			
//			Ext.apply(this,{
//				frame: 'false',
//				border: 'false',					
//				autoScroll: true,
//				items: items
//			});	
//		}
//		Ext.ux.InfoMachineObjectEditor.superclass.initComponent.call(this);
//	},
//	
//});
//
//
//Ext.reg('objecteditor',Ext.ux.InfoMachineObjectEditor);
