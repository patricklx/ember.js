import { get } from 'ember-metal/property_get';
import {
  guidFor
  } from 'ember-metal/utils';
import {
  addObserver,
  removeObserver
  } from 'ember-metal/observer';
import { forEach } from 'ember-metal/enumerable_utils';
import run from 'ember-metal/run_loop';


function ItemPropertyObserverContext (dependentArray, index) {
  this.dependentArray = dependentArray;
  this.index = index;
  this.item = dependentArray.objectAt(index);
  this.observer = null;
  this.destroyed = false;
}


function ChangeMeta(dependentArray, item, index, propertyName, property, changedCount){
  this.arrayChanged = dependentArray;
  this.index = index;
  this.item = item;
  this.propertyName = propertyName;
  this.property = property;
  this.changedCount = changedCount;
}

/*
 Tracks changes to dependent arrays, as well as to properties of items in
 dependent arrays.

 @class DependentArraysObserver
 */
function DependentArraysObserver(callbacks, cp, instanceMeta, context, propertyName, sugarMeta) {
  // user specified callbacks for `addedItem` and `removedItem`
  this.callbacks = callbacks;

  // the computed property: remember these are shared across instances
  this.cp = cp;
  this.needIndex = cp.options.needIndex;

  // the ReduceComputedPropertyInstanceMeta this DependentArraysObserver is
  // associated with
  this.instanceMeta = instanceMeta;

  // A map of array guids to dependentKeys, for the given context.  We track
  // this because we want to set up the computed property potentially before the
  // dependent array even exists, but when the array observer fires, we lack
  // enough context to know what to update: we can recover that context by
  // getting the dependentKey.
  this.dependentKeysByGuid = {};

  // We suspend observers to ignore replacements from `reset` when totally
  // recomputing.  Unfortunately we cannot properly suspend the observers
  // because we only have the key; instead we make the observers no-ops
  this.suspended = false;

  // This is used to coalesce item changes from property observers within a
  // single item.
  this.changedItems = {};

  this.observersContextByGuid = {};
}

DependentArraysObserver.prototype = {
  addItems: function(dependentArray, callbacks, cp, propertyName, meta) {
    var changeMeta = {};
    forEach(dependentArray, function (item, index) {
      ChangeMeta.call(changeMeta, dependentArray, item, index, propertyName, cp, dependentArray.length);
      meta.setValue( callbacks.addedItem.call(
        this, meta.getValue(), item, changeMeta, meta.sugarMeta));
    }, this);
    callbacks.flushedChanges.call(this, meta.getValue(), meta.sugarMeta);
  },

  setValue: function (newValue) {
    this.instanceMeta.setValue(newValue, true);
  },

  getValue: function () {
    return this.instanceMeta.getValue();
  },

  notifyPropertyChangeIfRequired: function () {
    this.instanceMeta.notifyPropertyChangeIfRequired();
  },

  setupObservers: function (dependentArray, dependentKey) {
    this.dependentKeysByGuid[guidFor(dependentArray)] = dependentKey;

    dependentArray.addArrayObserver(this, {
      willChange: 'dependentArrayWillChange',
      didChange: 'dependentArrayDidChange'
    });

    if (this.cp._itemPropertyKeys[dependentKey]) {
      this.setupPropertyObservers(dependentKey, this.cp._itemPropertyKeys[dependentKey]);
    }
  },

  teardownObservers: function (dependentArray, dependentKey) {
    var itemPropertyKeys = this.cp._itemPropertyKeys[dependentKey] || [];

    delete this.dependentKeysByGuid[guidFor(dependentArray)];

    this.teardownPropertyObservers(dependentArray, dependentKey, itemPropertyKeys);

    dependentArray.removeArrayObserver(this, {
      willChange: 'dependentArrayWillChange',
      didChange: 'dependentArrayDidChange'
    });
  },

  suspendArrayObservers: function (callback, binding) {
    var oldSuspended = this.suspended;
    this.suspended = true;
    callback.call(binding);
    this.suspended = oldSuspended;
  },

  setupPropertyObservers: function (dependentKey, itemPropertyKeys) {
    run.next(this, function () {
      var dependentArray = get(this.instanceMeta.context, dependentKey);
      var length = get(dependentArray, 'length');
      var observerContexts;

      this.observersContextByGuid[guidFor(dependentArray)] = observerContexts = new Array(length);

      forEach(dependentArray, function (item, index) {
        var observerContext = this.createPropertyObserverContext(dependentArray, index);
        observerContexts[index] = observerContext;

        forEach(itemPropertyKeys, function (propertyKey) {
          addObserver(item, propertyKey, this, observerContext.observer);
        }, this);
      }, this);
    });
  },

  teardownPropertyObservers: function (dependentArray, dependentKey, itemPropertyKeys) {
    var dependentArrayObserver = this;
    var observerContexts = this.observersContextByGuid[guidFor(dependentArray)];
    var observer, item;

    if(this.observersContextByGuid[guidFor(dependentArray)]){
      delete this.observersContextByGuid[guidFor(dependentArray)];
    }


    forEach(observerContexts, function (observerContext) {
      observerContext.destroyed = true;
      observer = observerContext.observer;
      item = observerContext.item;

      forEach(itemPropertyKeys, function (propertyKey) {
        removeObserver(item, propertyKey, dependentArrayObserver, observer);
      });
    });
  },

  createPropertyObserverContext: function (dependentArray, index) {
    var observerContext = new ItemPropertyObserverContext(dependentArray, index);

    this.createPropertyObserver(observerContext);

    return observerContext;
  },

  createPropertyObserver: function (observerContext) {
    var dependentArrayObserver = this;

    observerContext.observer = function (obj, keyName) {
      return dependentArrayObserver.itemPropertyDidChange(obj, keyName, observerContext.dependentArray, observerContext);
    };
  },

  dependentArrayWillChange: function (dependentArray, index, removedCount, addedCount) {
    if (this.suspended) { return; }

    var removedItem = this.callbacks.removedItem;
    var changeMeta = {};
    var guid = guidFor(dependentArray);
    var dependentKey = this.dependentKeysByGuid[guid];
    var itemPropertyKeys = this.cp._itemPropertyKeys[dependentKey] || [];
    var item, itemIndex, observerContexts;
    var maxIndex = index + removedCount;
    var len = get(dependentArray, 'length');
    if(maxIndex >= len){
      maxIndex = len;
    }

    //e.g. replace(0,1,[object]) in empty array
    if(!(index in dependentArray)){
      return;
    }

    if(itemPropertyKeys.length){
      observerContexts = this.observersContextByGuid[guid];
    }

    function removeObservers(propertyKey) {
      observerContexts[itemIndex].destroyed = true;
      removeObserver(item, propertyKey, this, observerContexts[itemIndex].observer);
    }

    for (itemIndex = index; itemIndex < maxIndex; itemIndex++) {

      item = dependentArray.objectAt(itemIndex);

      forEach(itemPropertyKeys, removeObservers, this);

      ChangeMeta.call(changeMeta, dependentArray, item, itemIndex, this.instanceMeta.propertyName, this.cp, removedCount);
      this.setValue(removedItem.call(
        this.instanceMeta.context, this.getValue(), item, changeMeta, this.instanceMeta.sugarMeta));
    }

    if( observerContexts && this.needIndex ){
      observerContexts.splice(index, removedCount);
      for(itemIndex = index; itemIndex < observerContexts.length; itemIndex++){
        observerContexts[itemIndex].index = itemIndex;
      }
    }
  },

  dependentArrayDidChange: function (dependentArray, index, removedCount, addedCount) {
    if (this.suspended) { return; }

    var addedItem = this.callbacks.addedItem;
    var guid = guidFor(dependentArray);
    var dependentKey = this.dependentKeysByGuid[guid];
    var observerContexts = this.observersContextByGuid[guid];
    var observerContextsToAdd = [];
    var itemPropertyKeys = this.cp._itemPropertyKeys[dependentKey];
    var changeMeta = {}, observerContext, itemIndex, item;
    var maxIndex = index + addedCount;
    var len = get(dependentArray, 'length');
    if(maxIndex >= len){
      maxIndex = len;
    }

    for (itemIndex = index; itemIndex < maxIndex; itemIndex++) {

      item = dependentArray.objectAt(itemIndex);

      if (itemPropertyKeys) {
        observerContext = this.createPropertyObserverContext(dependentArray, itemIndex);
        observerContextsToAdd.push(observerContext);
        forEach(itemPropertyKeys, function (propertyKey) {
          addObserver(item, propertyKey, this, observerContext.observer);
        }, this);
      }

      ChangeMeta.call(changeMeta, dependentArray, item, itemIndex, this.instanceMeta.propertyName, this.cp, addedCount);
      this.setValue(addedItem.call(
        this.instanceMeta.context, this.getValue(), item, changeMeta, this.instanceMeta.sugarMeta));
    }
    if( observerContexts && this.needIndex ){
      Array.splice.apply(observerContexts, [0].concat(observerContextsToAdd));
      for(itemIndex = index; itemIndex < observerContexts.length; itemIndex++){
        observerContexts[itemIndex].index = itemIndex;
      }
    }
    this.setValue( this.callbacks.flushedChanges.call(
        this.instanceMeta.context, this.getValue(), this.instanceMeta.sugarMeta)
    );
    this.notifyPropertyChangeIfRequired();
  },

  itemPropertyDidChange: function (obj, keyName, array, observerContext) {
    var guid = guidFor(obj);

    if (!this.changedItems[guid]) {
      this.changedItems[guid] = {
        array: array,
        observerContext: observerContext,
        obj: obj
      };
    }
    this.update = run.once(this, this._flushChanges);
  },

  _flushChanges: function () {
    var changedItems = this.changedItems;
    var key, c, changeMeta = {};
    var callback;

    if(this.callbacks.propertyChanged){
      callback = function(){
        this.setValue(
          this.callbacks.propertyChanged.call(this.instanceMeta.context, this.getValue(), c.obj, changeMeta, this.instanceMeta.sugarMeta));
      };
    }else{
      callback = function(){
        this.setValue(
          this.callbacks.removedItem.call(this.instanceMeta.context, this.getValue(), c.obj, changeMeta, this.instanceMeta.sugarMeta));
        this.setValue(
          this.callbacks.addedItem.call(this.instanceMeta.context, this.getValue(), c.obj, changeMeta, this.instanceMeta.sugarMeta));
      };
    }

    for (key in changedItems) {
      c = changedItems[key];

      ChangeMeta.call(changeMeta, c.array, c.obj, c.observerContext.index, this.instanceMeta.propertyName, this.cp, changedItems.length);
      callback.call(this);

    }

    this.changedItems = {};
    this.callbacks.flushedChanges.call(this.instanceMeta.context, this.getValue(), this.instanceMeta.sugarMeta);
    this.notifyPropertyChangeIfRequired();
  }
};



export default DependentArraysObserver;
