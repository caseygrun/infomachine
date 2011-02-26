// Misc To-do section:
// TODO: implement InfoMachineHttpProxy, InfoMachineJsonReader, InfoMachineJsonWriter, and InfoMachineStore.
// TODO: update InfoMachine.generateReference() and InfoMachine.resolveReference() to talk to some kind of InfoMachineStore
// TODO: document.


/* @class InfoMachine
 * @singleton
 * 
 * Core InfoMachine utilities and functions
 */
InfoMachine = new Ext.util.Observable();
Ext.apply(InfoMachine, {
	UNDEFINED: 'InfoMachine.UNDEFINED',
	
	config: {
	  proxyConfig: {
	    api: {
	      read: 'index.php/infomachine_objects/load',
	      create: 'index.php/infomachine_objects/create',
	      update: 'index.php/infomachine_objects/update',
	      destroy: 'index.php/infomachine_objects/destroy',
	    }
	  }
	},
	
	/**
	 * setup
	 * Intitiates an InfoMachineStore 
	 */
	setup: function() {
	  InfoMachine.store = new InfoMachineStore({
	    reader: new InfoMachineReader(),
	    writer: new InfoMachineWriter(),
	    proxy: new Ext.data.HttpProxy(InfoMachine.config.proxyConfig)
	  });
	  
	  InfoMachine.store.load();
	},
	
	// TODO: replace all three MixedCollections with store
	objects: new Ext.util.MixedCollection(),
	types: new Ext.util.MixedCollection(),
	verbs: new Ext.util.MixedCollection(),
	
	// Object/item management
	register: function(item) {
    InfoMachine.store.add(item);
		return item.id;
	},
	unregister: function(reference) {
		if(InfoMachine.objects.confainsKey(reference)) {
			return InfoMachine.objects.removeKey(reference);
		}
		if(InfoMachine.objects.confains(reference)) {
			return InfoMachine.objects.remove(reference);
		}
	},
	
	/*
	registerType: function(type) {
		if(type.name) {
			InfoMachine.types.add(type.name,type);
			InfoMachine.register(type);	
		}
	},
	unregisterType: function(type) {
		if(InfoMachine.objects.confainsKey(type)) {
			return InfoMachine.objects.removeKey(type);
		}
		if(InfoMachine.objects.confains(type)) {
			return InfoMachine.objects.remove(type);
		}
		InfoMachine.unregister(type);
	},
	*/
	
	createType: function(config,fields) {
		// TODO: InfoMachine.create - still necessary?
		return new InfoMachineType(config,fields);	
	},
	getType: function(typeName) {
    return InfoMachine.store.query('name',typeName);  
	},
	hasType: function(typeName) {
		return InfoMachine.store.query('name',typeName);	
	},
	instantiate: function(typeName,data) {
	   var o = InfoMachine.getType(typeName).instantiate(data);
	   InfoMachine.register(o);
	},
	
	isReference: function(reference) {
		return InfoMachine.validateReference(reference);		
	},
	resolveReference: function(reference) {
	  if(reference.getId && Ext.isFunction(reference.getId)) { 
	    return reference;
		} else {
		  r = InfoMachine.store.getById(reference)
		  return r;
		}
	},
	validateReference: function(reference) {
		if(reference.getId && Ext.isFunction(reference.getId)) { 
      return InfoMachine.store.indexOfId(reference.getId()) != -1;
    } else {
      return InfoMachine.store.indexOfId(reference) != -1;
    }
	},
	generateReference: function(reference) {
		if(reference.getId && Ext.isFunction(reference.getId)) {
			return reference.getId();	
		}
		if(Ext.isString(reference)) {
			return reference;	
		}
		return false;
	}
});

/** 
 * @class InfoMachineObject
 * @extends Ext.data.Record
 * 
 * Specialized Ext.data.Record to represent a complex (ie: non-primitive) InfoMachine object (noun, adjective, or type).
 * 
 * This class should not be instantiated directly, but rather generated by an {@link InfoMachineJsonReader} or created manually with {@link InfoMachine.instantiate}
 */
var InfoMachineObject = function(config) {
	InfoMachineObject.superclass.constructor.call(this, config);
	
	/* TODO: decide if InfoMachineObject contructor really should register the new object; this seems
	 * in general to turn out not to be a good idea.
	 */
	InfoMachine.register(this);
	this.meta = 'object';
};

Ext.extend(InfoMachineObject, Ext.data.Record, {
	
	/**
	 * getId
	 * Returns this {@link InfoMachineObject}'s id
	 * @return {String} id
	 */
	getId: function() {
		if(this.id) {
			return this.id;
		} else {
			this.id = App.nextId();
			return this.id;	
		}
	},
	
	/**
	 * getType
	 * Returns this object's {@link InfoMachineType}.
	 * @return {InfoMachineType} type
	 */
	getType: function() {
		return InfoMachine.getType(this.type);
	},
	
	/**
	 * getField
	 * Gets the field description object
	 * @param {String} fieldName
	 * @return {InfoMachineField} field
	 */
	getField: function(fieldName) {
		return this.fields.get(fieldName);
	},
  /**
   * hasField
   * Determines whether the object has a valid field descriptor for the given fieldName
   * @param {String} fieldName
   * @return {InfoMachineField} field
   */
	hasField: function(fieldName) {
		return this.fields.contains(fieldName);
	},
	
	/**
   * addField
   * Adds a new field based on a description object
   * @param {Object} fieldConfig The new InfoMachineField object or config object
   */
	addField: function(fieldConfig, value) {
    fieldConfig = fieldConfig || {};
    fieldName = fieldConfig.name;
    var field = new InfoMachineField(fieldConfig);
    this.fields.add(fieldName,field); 
    if(value) this.set(fieldName,value);
  },
	
	/**
   * setField
   * Updates the field description object
   * @param {String} fieldName
   * @param {Object} fieldConfig The new InfoMachineField object or config object
   * @param {Mixed} value The new value for the field
   */
	// TODO: fire events in field mutation functions
	setField: function(fieldName, fieldConfig, value) {
	  fieldConfig = fieldConfig || {};
	  fieldConfig.name = fieldName;
	  var field = new InfoMachineField(fieldConfig);
	  
	  // add new field (MixedCollection#add with auto-replace)
		this.fields.add(fieldName,field);	
		if(value) this.set(fieldName,value);
	},
	updateField: function(fieldName,property) {
		// TODO: updateField
	},
	updateFields: function(fields) {
    // TODO: updateFields
    /*
		if(Ext.isArray(fields)) {
			var property;
			for(var i=0, l=fields.length; i<l; i++) {
				property = fields[i];
				if(Ext.isObject(property)) {
					property.name = property.name || ('property_'+i);
					this.setField(property.name,property);
				} else {
					this.setField(property, {});	
				}
			}
		} else if(Ext.isObject(fields)) {
			var property;
			for(propertyName in fields) {
				property = fields[propertyName];
				if(Ext.isObject(property)) {
					property.name = property.name || ('property_'+i);
					this.setField(property.name,property);
				} else {
					this.setField(property, {});	
				}
			}
		}	
		*/
	},
	 /**
   * getFieldNames
   * Gets the name of each field
   * @return {String[]} fields
   */
	getFieldNames: function() {
		return this.fields.keys;	
	},
	eachField: function(fn, scope) {
		return this.fields.eachKey(fn, scope);	
	},
	/**
   * getValues
   * Returns an object containing each of this object's fields' raw values
   * @return {Object} values
   */
	getValues: function(fields) {
		var result = {};
		Ext.each(fields, function(fieldName) {
			result[fieldName] = this.get(fieldName);
		},this);
	},
	/**
   * get
   * Gets the value of a given field, {@link InfoMachine#resolveReference resolving InfoMachine references} and wrapping primitive types in boxing classes
   * @param {String} fieldName
   * @return {Mixed} value
   */
	get: function(fieldName) {
		f = this.getField(field);
		if(f) {
		  // search for boxing type 
		  var t = Ext.data.Types[f.type.toUpper()];

      // if boxing function is found, wrap value in boxing class
		  if(t && t.box && Ext.isFunction(t.box)) {
        return t.box(this.data[fieldName]);
		  }
		  return this.data[fieldName];
		}
		return false;
	},
	/**
   * set
   * Updates the value of a given field, {@link InfoMachine#generateReference generating InfoMachine references} and unwrapping primitive types from boxing classes
   * @param {String} fieldName
   * @param {Mixed} value
   */
	set: function(fieldName,value) {
		f = this.getField(fieldName);
		if(f) {
      // search for boxing type 
      var t = Ext.data.Types[f.type.toUpper()];

      // if unboxing function is found, unwrap boxed value (serialize)
      if(t && t.unbox && Ext.isFunction(t.unbox)) {
        value = t.unbox(value);
      }
      
      InfoMachineObject.superclass.set.call(this,fieldName,value);
    }
 		return false;
	},
	/**
   * has
   * Determines whether this object has a given field
   * @param {String} fieldName
   * @return {Bool} value
   */
	has: function(field) {
		return this.hasField(field);
	},
  serialize: function() {

  },
  is: function(adjective) {
    return InfoMachine.matchesAdjective(this,adjective);  
  },
  /**
   * manifest
   * "Manifests" this object in the view by instantiating the configured proxyType and binding that
   * proxy object to this InfoMachineObject
   */
  manifest: function(proxyType) {
    this.proxyType |= proxyType;
    var proxy; 
    if(Ext.isFunction(this.proxyType)) {
      proxy = new this.proxyType();
    } else if(Ext.isFunction(window[this.proxyType])) {
      proxy = new window[this.proxyType()];
    }
    if(proxy) proxy.bind(this);
  }
});

/**
 * @class InfoMachineObjectProxy
 * @extends Ext.util.Observable
 * 
 * Classes which wish to represent underlying InfoMachine objects should extend or mixin this class, which provides the ability to 
 * expose InfoMachineObject getters and setters while concealing access to the underlying records and the InfoMachineStore
 */
var InfoMachineObjectProxy = function() {
    InfoMachineObjectProxy.superclass.constructor.apply(this,arguments);
    this.readable = {};
    this.writeable = {};
    this._virtual = {};
    this.fields = {};
}

Ext.extend(InfoMachineObjectProxy, Ext.util.Observable, {
	/**
	 * bind
	 * Attaches this proxy to an InfoMachine object
	 * @param {InfoMachineObject} object The object to bind
	 */
	bind: function(object) {
	  this.object = object;
	  for(var fieldName in this._virtual) {
	    this.expose(fieldName,this._virtual[fieldName].readable,this._virtual[fieldName].writeable);
	  }
	},
	get: function(fieldName) {
	  if(this.readable[fieldName]) {
	    return this.readable[fieldName]();
	  }
	},
	set: function(fieldName,value) {
    if(this.writeable[fieldName]) {
      return this.writeable[fieldName](value);
    }
  },
  has: function(fieldName) {
    return this.object.has(fieldName);
  },
  /**
   * expose
   * Exposes an InfoMachine object field through this object's getters and/or setters
   * @param {String} fieldName The name of the field to be exposed
   * @param {Bool/Function} readable Set to any non-false value to allow this field to be read through {@link InfoMachineObjectProxy#get}. Pass a function to 
      allow pre-processing of this field on each get(). 
   * @param {Bool/Function} writeable Set to any non-false value to allow this field to be written through {@link InfoMachineObjectProxy#set}. Pass a function to 
      allow pre-processing of this field on each set(). 
   */
  // TODO: document what readable and writeable functions are passed
	expose: function(fieldName,readable,writeable) {
	  readable = readable || true;
	  writeable = writeable || true;

	  if(this.object) { 
  		if(this.object.hasField(fieldName)) {
  		  if(readable) { 
  		    readable = (Ext.isFunction(readable) ? readable : 
  		       (Ext.isFunction(this[readable]) ? this[readable] : readable));
  		    this.readable[fieldName] = (Ext.isFunction(readable) 
           ? (function(fieldName) { 
              return this.readable[fieldName](this.object.get(fieldName),this.object,this, fieldName)
             }).createDelegate(this,[fieldName],true) 
           : (function(fieldName) {
             return this.object.get(fieldName);
            }).createDelegate(this,[fieldName],true)
          );
  		  }
  		  
  		  if(writeable) { 
          writeable = (Ext.isFunction(writeable) ? writeable : 
             (Ext.isFunction(this[writeable]) ? this[writeable] : writeable));
          
          this.writeable[fieldName] = (Ext.isFunction(writeable) 
           ? (function(fieldName) { 
              return this.object.set(fieldName, this.writeable[fieldName](value,this.object,this, fieldName));
             }).createDelegate(this,[fieldName],true) 
           : (function(fieldName,value) {
              return this.object.set(fieldName);
            }).createDelegate(this,[fieldName],true)
          );
        }
  		}
  		
    // allow for virtual properties if object is not yet bound
		} else {
		  this._virtual[fieldName] = {};
		  if(readable) {
		    this._virtual[fieldName].readable = readable;
		    // allow for readable to be a name of a member function
		    // if readable's a function, retain
		     readable = (Ext.isFunction(readable) ? readable : 
		         // if readable's not a function, see if it's the name of a member function and pass that instead
             (Ext.isFunction(this[readable]) ? this[readable] : readable));
             
        // create accessor
		    this.readable[fieldName] = (Ext.isFunction(readable) 
		      
		      // readable's a function; call it on access
		      ? function(fieldName) { 
		          return this.readable[fieldName](this.fields[fieldName],false,this, fieldName);
		        }.createDelegate(this,[fieldName],true)
		      
		      // readable's just a bool
		      : function(fieldName) { 
              return this.fields[fieldName];
            }.createDelegate(this,[fieldName],true)
        );
		  }
		  
		  if(writeable) { 
		    this._virtual[fieldName].writeable = writeable;
		    
		    // allow writeable to be a name of a member function
		    writeable = (Ext.isFunction(writeable) ? writeable : 
           (Ext.isFunction(this[writeable]) ? this[writeable] : writeable));
          
        // create accessor
        this.writeable[fieldName] = (Ext.isFunction(writeable) 
           
           // writeable's a function; call it on access
           ? function(fieldName) { 
              this.fields[fieldName] = this.writeable[fieldName](value,false,this, fieldName);
             }.createDelegate(this,[fieldName],true) 
           : function(fieldName,value) {
             this.fields[fieldName] = value;
            }.createDelegate(this,[fieldName],true)
          );
        }
		}
	},
	/**
	 * conceal
	 * Opposite of {@link InfoMachineObjectProxy#expose expose}.
	 */
	conceal: function(fieldName,readable,writeable) {
    readable = readable || false;
    writeable = writeable || false;
    if(this.object.hasField(fieldName)) {
      this.readable[fieldName] = readable;
      this.writeable[fieldName] = writeable; 
    }
  },
  /**
   * realize
   * Creates a new {@link InfoMachineObject} instance and binds it to this proxy
   */
  realize: function(infomachine_type) {
    this.infomachine_type |= infomachine_type; 
    if(this.infomachine_type && InfoMachine.hasType(this.infomachine_type)) {
      this.bind(InfoMachine.instantiate(this.infomachine_type));
    }
  }
});




var InfoMachineAdjective = function() {		
	InfoMachineAdjective.superclass.constructor.apply(this, arguments);
  this.meta = 'adjective';
};

Ext.extend(InfoMachineAdjective,InfoMachineObject, {
	match: function(item) {
		var match = true;
		this.eachField(function(fieldName,field) {
			var value = item.get(fieldName);
			if(field.type) {
				var t = InfoMachine.getType(field.type);
				match = match && t.match(value);	
			}
			if(field.constraint) {
				if(Ext.isFunction(field.constraint)) {
					match = match && field.constraint(value);	
				}	
			}
		},this);
		return match;
	}
});


var InfoMachineType = function() {
	InfoMachineType.superclass.constructor.apply(this, arguments);
	
	// TODO: Decide whether types should register themselves in constructor (probably not, since this register
	InfoMachine.registerType(this);
	this.meta = 'type';
};

Ext.extend(InfoMachineType,InfoMachineAdjective, {
	getParent: function() {
		var t = InfoMachine.getType(this['extends']); 
		if(t) { 
			return t;
		} else {
			return InfoMachine.getType('object');	
		}	
	},
	/**
	 * @private
	 * Deep-copies fields
	 */
	deepCopyFields: function(target) {
	  this.eachField(function(fieldName,field) {
	    this.addField(fieldName,field.clone());
	  },target);
	},
	/**
	 * instantiate
	 * Creates an instance of this type
	 * @param {String} id The record ID to assign this new object (used when reading objects from an {@link Ext.data.HttpProxy})
	 * @param {Object} data The field values to assign to this object
	 */
	instantiate: function(id, data) {
	  // TODO: See if it makes sense to copy meta-properties on instantiation
	  var base = InfoMachineType.copy.call(this,id);
	  this.deepCopyFields(base);
	  if(data) {
	    base.setValues(data);
	  }
	  base.type = this.name;
    return base;
	},
	/**
	 * extend
	 * Creates a new type which inherits this
	 */
	extend: function(id) {
	  // TODO: See if it makes sense to copy meta-properties on type extension
	  var base = InfoMachineType.copy.call(this,id);
	  this.deepCopyFields(base);
	  base.type = 'type'
	  base.extends = this.name;
	  return base;
	}
});


var InfoMachineField = function(config) {
  InfoMachineField.superclass.constructor.apply(this, arguments);
  this.meta = 'field';
  Ext.applyIf(this,config)
};

Ext.extend(InfoMachineField,Ext.data.Field, {
  'infomachine_type':'object',
  clone: function() {
    return new InfoMachineField(this);
  }
});



Ext.apply(Ext.data.Types,{
  'INFOMACHINE_OBJECT': {
    convert: Ext.data.Types.AUTO.convert,
    sortType: function(v) {
      var r = InfoMachine.resolveReference(v);
      return (r ? r.sortType() : Ext.data.SortTypes.none);
    },
    type: 'infomachine_object',
    box: function(v) {
      var r = InfoMachine.resolveReference(v);
      return (r ? r : v)
    },
    unbox: function(v) {
      var r = InfoMachine.generateReference(v);
      return (r ? r : v);
    }
  },
  
  // TODO: custom Ext.data.Type(s)
  'COLOR': {
    convert: Ext.data.Types.AUTO.convert,
    sortType:  Ext.data.Types.AUTO.sortType,
    type: 'color'
  },
  'URL': {
    convert: Ext.data.Types.AUTO.convert,
    sortType: Ext.data.Types.AUTO.sortType,
    type: 'url'
  },
  'HTML': {
    convert: Ext.data.Types.AUTO.convert,
    sortType: Ext.data.Types.AUTO.sortType,
    type: 'html'
  },
  'NUMBER': {
    convert: Ext.data.Types.AUTO.convert,
    sortType: Ext.data.Types.AUTO.sortType,
    type: 'number'
  },
  'TEXT': {
    convert: Ext.data.Types.AUTO.convert,
    sortType: Ext.data.Types.AUTO.sortType,
    type: 'number'
  },
});

var InfoMachineStore = Ext.extend(Ext.data.Store,{});

// TODO: InfoMachineReader
var InfoMachineReader = Ext.extend(Ext.data.DataReader,{
    /**
     * @cfg {String} typeRootProperty
     * The property of the response object which contains an array of type config objects
     */
    typeRootProperty: 'types',
    /**
     * @cfg {String} objectRootProperty
     * The property of the response object which contains an array of object config objects
     */
    objectRootProperty: 'objects',
    /**
     * @cfg {Bool} successProperty
     * The property of the response object which contains a bool indicating whether the action was successful
     */
    successProperty: 'success',
    /**
     * @cfg {String} messageProperty
     * The property of the response object which contains an error message
     */
    messageProperty: 'message',
    /**
     * This is the dumbest method ever.
     */
    buildExtractors: function() {
      this.getTypeRoot = function(o) {
        return o[this.typeRootProperty];
      };
      this.getObjectRoot = function(o) {
        return o[this.objectRootProperty];
      };
      this.getSuccess = function(o) {
        return o[this.successProperty];
      };
      this.getMessage = function(o) {
        return o[this.messageProperty];
      };
    },
    
    /* This method is used only by a DataProxy which has retrieved data from a remote server
     * @param {Object} response The XHR object which contains the JSON data in its responseText.
     * @return {Object} data A data block which is used by an Ext.data.Store object as
     * a cache of Ext.data.Records.
     */
     
    read : function(response){
        var json = response.responseText;
        var o = Ext.decode(json);
        if(!o) {
            throw {message: 'InfoMachineReader.read: Json object not found'};
        }
        return this.readRecords(o);
    },
    /**
     * Create a data block containing Ext.data.Records from an InfoMachine-formatted JSON object.
     * @param {Object} o An object which contains an Array of type object configs in the property specified
     * in the config as 'typeRoot', an array of object configs in the property specified in the config as 
     * 'objectRoot', as well as optionally a property, specified in the config as 'totalProperty'
     * which contains the total size of the dataset. That is:
     * <code>
 o = {
   (typeRoot): [(typeConfig), (typeConfig), ... ],
   (objectRoot): [(objectConfig), (objectConfig) ...],
   (totalProperty)
 }
     * </code>
     * @see #readTypeConfig
     * @see #readObjectConfig
     * @return {Object} data A data block which is used by an Ext.data.Store object as
     * a cache of Ext.data.Records.
     */
    readRecords : function(o){
        /**
         * After any data loads, the raw JSON data is available for further custom processing.  If no data is
         * loaded or there is a load exception this property will be undefined.
         * @type Object
         */
        this.jsonData = o;
        
        success = true;
        
        // load types
        var typeRootArray = this.getTypeRoot(o), type, types = []; 
        success &= typeRootArray;
        
        for(var i=0,l=typeRootArray.length;i<l;i++) {
          type = this.readTypeConfig(typeRootArray[i]);
          if(type) types.push(type);
          else success = false;
        }
        
        // load objects
        var objectRootArray = this.getObjectRoot(o), obj, objects = [];
        success &= objectRootArray;
        
        for(var i=0,l=objectRootArray.length;i<l;i++) {
          obj = this.readObjectConfig(objectRootArray[i]);
          if(obj) objects.push(obj);
          else success = false;
        }
        
        records = types.concat(objects);
        success &= this.getSuccess(o);
        totalRecords = records.length;
        
        // TODO return Ext.data.Response instance instead.  @see #readResponse
        return {
            success : success,
            records : records,
            totalRecords : totalRecords
        };
    },
    
    /*
     * TODO: refactor code between JsonReader#readRecords, #readResponse into 1 method.
     * there's ugly duplication going on due to maintaining backwards compat. with 2.0.  It's time to do this.
     */
    /**
     * Decode a JSON response from server.
     * @param {String} action [Ext.data.Api.actions.create|read|update|destroy]
     * @param {Object} response The XHR object returned through an Ajax server request.
     * @return {Response} A {@link Ext.data.Response Response} object containing the data response, and also status information.
     */
    readResponse : function(action, response) {
        var o = (response.responseText !== undefined) ? Ext.decode(response.responseText) : response;
        if(!o) {
            throw new Ext.data.JsonReader.Error('response');
        }

        var typeRoot = this.getTypeRoot(o), objectRoot = this.getObjectRoot(o);
        if (action === Ext.data.Api.actions.create) {
            var def = Ext.isDefined(typeRoot);
            if (def && Ext.isEmpty(typeRoot)) {
                throw new InfoMachineReader.Error('type-root-empty', this.typeRootProperty);
            }
            else if (!def) {
                throw new InfoMachineReader.Error('type-root-undefined-response', this.typeRootProperty);
            }
            
            
            var def = Ext.isDefined(objectRoot);
            if (def && Ext.isEmpty(objectRoot)) {
                throw new InfoMachineReader.Error('object-root-empty', this.objectRootProperty);
            }
            else if (!def) {
                throw new InfoMachineReader.Error('object-root-undefined-response', this.objectRootProperty);
            }
        }

        // instantiate response object
        var res = new Ext.data.Response(Ext.apply(this.readRecords(o),{
            action: action,
            message: this.getMessage(o),
            raw: o
        }));

        // blow up if no successProperty
        if (Ext.isEmpty(res.success)) {
            throw new Ext.data.JsonReader.Error('successProperty-response', this.successProperty);
        }
        return res;
    },
    
    /**
     * Create a data block containing Ext.data.Records from an InfoMachine-formatted JSON object.
     * @param {Object} o An object which contains a type config specification
     * @return {InfoMachineType} type an InfoMachine type
     */
    readTypeConfig: (function() {
      var metaProperties = ['id','name','type','extends','proxyType'];
      
      return function(o) {
        var extendsTypeName = o['extends'] || 'object',
            extendsType = InfoMachine.getType(extendsTypeName) || InfoMachine.getType('object'),
            id = o['id'],
            fields = o['fields'];
            type = extendsType.extend(id);
        
        // add or override fields
        for(var i=0,l=fields.length;i<l;i++) {
          type.addField(fields[i]);
        }
        // copy meta properties
        for(i=0,l=fields.length;i<l;i++) {
          type[metaProperties[i]] = o[metaProperties[i]];
        }
        
        return type;
      }
    })(),
    readObjectConfig: (function() {
      var metaProperties = ['id','name','type','proxyType'];
      
      return function(o) {
        var typeName = o['type'] || 'object',
            type = InfoMachine.getType(typeName) || InfoMachine.getType('object'),
            id = o['id'],
            fields = o['fields'];
            data = o[data],
            
            // retrieve type instance
            obj = extendsType.instantiate(id);
        
        // add or override fields
        for(var i=0,l=fields.length;i<l;i++) {
          obj.addField(fields[i]);
        }
        
        // copy meta properties
        for(i=0,l=fields.length;i<l;i++) {
          type[metaProperties[i]] = o[metaProperties[i]];
        }
        
        // update values of new instance
        obj.setValues(data);
        
        return obj;
      }
    })()
});


/**
 * @class InfoMachineReader.Error
 * Error class for InfoMachineReader
 */
InfoMachineReader.Error = Ext.extend(Ext.Error, {
    constructor : function(message, arg) {
        this.arg = arg;
        Ext.Error.call(this, message);
    },
    name : 'InfoMachineReader'
});
Ext.apply(Ext.data.JsonReader.Error.prototype, {
    lang: {
        'response': 'An error occurred while json-decoding your server response',
        'successProperty-response': 'Could not locate your "successProperty" in your server response.  Please review your JsonReader config to ensure the config-property "successProperty" matches the property in your server-response.  See the JsonReader docs.',
        'type-root-undefined-config': 'Your JsonReader was configured without a "typeRoot" property.  Please review your JsonReader config and make sure to define the root property.  See the JsonReader docs.',
        'object-root-undefined-config': 'Your JsonReader was configured without a "objectRoot" property.  Please review your JsonReader config and make sure to define the root property.  See the JsonReader docs.',
        'idProperty-undefined' : 'Your JsonReader was configured without an "idProperty"  Please review your JsonReader configuration and ensure the "idProperty" is set (e.g.: "id").  See the JsonReader docs.',
        'root-empty': 'Data was expected to be returned by the server in the "root" property of the response.  Please review your JsonReader configuration to ensure the "root" property matches that returned in the server-response.  See JsonReader docs.'
    }
});

// TODO: InfoMachineWriter
var InfoMachineWriter = Ext.extend(Ext.data.JsonWriter,{
  
});

var MasterSyncStore = Ext.extend(Ext.data.Store,{
  bind: function(slave) {
    // TODO: Find a way to prevent a master from notifying a slave about something that slave just did 
    slave.master = this;
    
    // attach event listeners to catch master updates and pass them on to slave
    // important: all listeners are executed in the scope of the *slave*
    
    // on master add
    this.on('add',function(store, records) {
      if (!this.ignoreNext) {
        this.suspendEvents();
        for (var record, i = 0, l = records.length; i < l; i++) {
          record = records[i];
          if (this.syncFilter(record)) {
            this.add(records);
          }
        }
        this.resumeEvents();
      } else {
        this.ignoreNext = false;
      }
    },slave);
    
    // on master update
    this.on('update',function(store,record,operation) {
      if (!this.ignoreNext) {
        this.suspendEvents();
        if (this.syncFilter(record)) {
          var slaveRecord = this.query(this.idField, record.get(this.idField));
          if (slaveRecord) {
            slaveRecord = slaveRecord.itemAt(0);
            
            // slaveRecord still might not be there if it hasn't been realized yet
            if (slaveRecord) {
              for (var param in record.data) {
                slaveRecord.set(param, record.data[param]);
              }
            }
          } else {
            this.loadData({
              success: true,
              rows: [record.data]
            }, true);
          }
        }
        this.resumeEvents();
      } else {
        this.ignoreNext = false;
      }
    },slave);
    
    // on master delete/remove
    this.on('remove',function(store,record) {
      if (!this.ignoreNext) {
        this.suspendEvents();
        if (this.syncFilter(record)) {
          var slaveRecord = this.query(this.idField, record.get(this.idField));
          if (slaveRecord) {
            slaveRecord = slaveRecord.itemAt(0);
            this.remove(slaveRecord);
          }
        }
        this.resumeEvents();
      } else {
        this.ignoreNext = false;
      }
    },slave);
    
  },
  createSlave: function(config) {
    // Copy some stuff from the master config
    config = Ext.applyIf(config,{
      idField: this.idField, 
      syncFilter: this.syncFilter,
      autoLoad: this.autoLoad,
      autoSave: this.autoSave,
      
      
      // TODO: change dummy reader to appropriately read InfoMachine JSON blobs
      reader: new Ext.data.JsonReader({   /* Add a dummy reader to realize records */
        idProperty: (this.reader.meta.idProperty=='id' ? this.idField : this.reader.meta.idProperty),
        root: 'rows'
      },this.recordType),
      
      /* Add a dummy writer since the store is too dumb to fire the right events
       * without one.
       * TODO: Create a DummyWriter class to serve this purpose
       */
      writer: new Ext.data.DataWriter(),     
      
      /* TODO: make sure this doesn't break shit
       * 
       * we're being dirty by specifying this as a config 
       * option, but since there's no reader configured, 
       * we have no other way of telling the store about
       * its meta
       */
      recordType: this.recordType,       
      
      ignoreNext: false
    });
    
    /* Save reference to the master store in the SyncingProxy
     */
    if(!config.proxy) {
      config.proxy = new SyncingProxy({master: this, 
        idField: config.idField, 
        syncFilter: config.syncFilter
      });
    } else {
      if(!config.proxy.master) {
        config.proxy.master = this;
      }
    }
    
    /* The syncData parameter of the master store allows certain properties to be passed
     * to the synchronizing proxy, since obnoxiously Ext doesn't allow a convenient way
     * for the proxy to know about its parent store. 
     * 
     * Each key in syncData will be copied from the slave config to the proxy object
     */
    if(this.syncData) {
      for (var p,i=0,l=this.syncData.length; i<l; i++) {
        p = this.syncData[i];
        if(config[p]) { config.proxy[p] = config[p]; }
      };
    }
    
    // Create slave store
    var slave = new Ext.data.Store(config);
    
    // Tell the proxy about its parent store
    slave.proxy.store = slave;
    
    
    // Bind to master change events
    this.bind(slave);
    
    return slave;
  },
  
  // I forget why this is necessary, but I think it's so the reader realizes the records
  onCreateRecords: function(success,rs,data) {
    MasterSyncStore.superclass.onCreateRecords.apply(this,arguments);
    if(success) {
      this.fireEvent('realize',rs,data);
    }
  },
  // override reMap so that record._phid isn't deleted; that way records in the slave stores can be realized
  reMap : function(record) {
        if (Ext.isArray(record)) {
            for (var i = 0, len = record.length; i < len; i++) {
                this.reMap(record[i]);
            }
        } else {
            delete this.data.map[record._phid];
            this.data.map[record.id] = record;
            var index = this.data.keys.indexOf(record._phid);
            this.data.keys.splice(index, 1, record.id);
            //delete record._phid;  // NO! Don't delete _phid! We need it to realize records in the slave store
        }
    },
  loadFrom: function(url,options) {
    this.proxy.setApi(Ext.data.Api.actions.read, url);
    this.load(Ext.apply({
      add: true
    },(options||{})));
  }
});



var SyncingProxy = function(config){
  var api = {};
  api[Ext.data.Api.actions.read] = true;
  api[Ext.data.Api.actions.create] = true;
  api[Ext.data.Api.actions.update] = true;
  api[Ext.data.Api.actions.destroy] = true;
  
  Ext.applyIf(config,{
    api: api,
    syncFilter: function() { return true; },
    idField: 'id',
    master: false,
    store: false
  });
  
  // The superclass constructor doesn't technically accept a config parameter 
  //  (it manually copies explicit properties), so we'll copy stuff here.
  Ext.applyIf(this,config);
    SyncingProxy.superclass.constructor.call(this, config);
}

Ext.extend(SyncingProxy,Ext.data.DataProxy,{
  doRequest : function(action, rs, params, reader, callback, scope, arg) {
        params = params || {};
        var result;
        try {
            switch(action) {
              case Ext.data.Api.actions['read']:
                var records = this.master.queryBy(this.syncFilter,this.store),
                  rs = Ext.pluck(records.items,'data');
                  
                // duplicate data
                rs = reader.extractData(rs,true);
                
                var result = {
                    success: true,
                    records: rs,
                    totalRecords: records.items.length
                  };
                break;
              case Ext.data.Api.actions['create']:
                
                /* remember that we were the ones to generate the insert so that we don't trigger an 
                 * infinite loop when the master store notifies the slaves of the create action
                 */
                this.store.ignoreNext = true;
                
                
                /* Build a listener function to watch for the 'realize' event we've bolted
                 * on to DataProxy and invoke the callback passed to this function when the master store's done 
                 * realizing the record through the *real* DataProxy 
                 */
                // TODO: rebuild this without the closure
                var listener = (function(callback,scope,arg,_rs,me) {
                  return function(rs,result){
                    if ((parseInt(_rs.id.split('-').pop())+1) == parseInt(rs._phid.split('-').pop())) {
                      callback.call(scope, [Ext.apply({},rs.data)], arg, true);
                      // hackity hack
                      // var listenerFunc = arguments.callee;
                      // Ext.TaskMgr.start({
                      //   run: function(lf,master) {
                      //     master.un('realize',lf);
                      //   },
                      //   args: [listenerFunc,me.master],
                      //   repeat: 1
                      // })
                    }
                  }
                })(callback, scope,arg,rs,this);
                
                this.master.on('realize',listener, null, {single: true });
                this.master.add(new this.master.recordType(rs.data));
                
                return; // Get out of here *without* invoking callback (it'll be called by listener, as described above)
                break;
              case Ext.data.Api.actions['update']:
                var masterRecords = [], 
                  record = rs,
                  masterRecord = this.master.query(this.idField,record.get(this.idField));
                if (masterRecord && masterRecord.length != 0) {
                  masterRecord = masterRecord.itemAt(0);
                  masterRecord.beginEdit();
                  for (var param in record.data) {
                    masterRecord.set(param, record.data[param]);
                  }
                  this.store.ignoreNext = true;
                  
                  masterRecord.endEdit();           
                  masterRecord.commit();
                  this.master.save();
                }
                break;
              case Ext.data.Api.actions['destroy']:
                var record = rs;
                masterRecords = this.master.query(this.idField,record.get(this.idField));
                this.store.ignoreNext = true;
                this.master.remove(masterRecords.items);
                break;
            }
        } catch(e){
            // @deprecated loadexception
            this.fireEvent("loadexception", this, null, arg, e);

            this.fireEvent('exception', this, 'response', action, arg, null, e);
            callback.call(scope, null, arg, false);
            return;
        }
        
        // invoke the passed callback for 'load', 'update', and 'destroy' events
        callback.call(scope, result, arg, true);
    }
})




InfoMachineGlue = function(config) {
	Ext.applyIf(config,{
		load: {},
		source: {},
		target: {}
	});
	Ext.applyIf(config.load,{loadEvent: '', options: {}})
	Ext.applyIf(config.source, { object: {}, changeEvent:'change', changeAction:function() {}, changeActionScope:{}, options: {} });
	Ext.applyIf(config.target, { object: {}, changeEvent:'change', changeAction:function() {}, changeActionScope:{}, options: {} });
	
	InfoMachineType.superclass.constructor.call(this, config,fields);
	
	this.source.object.on(this.source.changeEvent,this.target.changeAction,this.target.changeActionScope,this.target.options);
	this.target.object.on(this.target.changeEvent,this.source.changeAction,this.source.changeActionScope,this.source.options);	
}

Ext.extend(InfoMachineGlue,{
	destroy: function() {
		this.source.object.un(this.source.changeEvent,this.target.changeAction,this.target.changeActionScope,this.target.options);
		this.target.object.un(this.target.changeEvent,this.source.changeAction,this.source.changeActionScope,this.source.options);
	}
});

InfoMachineGlue.glue = function(mapping) {
	
	
};