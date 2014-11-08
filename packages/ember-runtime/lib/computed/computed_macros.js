/**
@module ember
@submodule ember-runtime
*/

import { get } from 'ember-metal/property_get';
import {
  isArray,
  guidFor
} from 'ember-metal/utils';
import EmberError from 'ember-metal/error';
import {
  forEach
} from 'ember-metal/enumerable_utils';
import run from 'ember-metal/run_loop';
import SubArray from 'ember-runtime/system/subarray';
import keys from 'ember-metal/keys';
import compare from 'ember-runtime/compare';

var a_slice = [].slice;

/**
 A computed property that returns the sum of the value
 in the dependent array.

 @method computed.sum
 @for Ember
 @param {String} dependentKey
 @return {Ember.ComputedProperty} computes the sum of all values in the dependentKey's array
 @since 1.4.0
*/

export function sum(dependentKey){
  return computed(dependentKey+'.[]', function () {
    var srcArray = get(this, dependentKey);
    if(!srcArray) return 0;

    return srcArray.reduce(function (previousValue, item) {
      return previousValue + item;
    }, 0)
  });
}

/**
  A computed property that calculates the maximum value in the
  dependent array. This will return `-Infinity` when the dependent
  array is empty.

  ```javascript
  var Person = Ember.Object.extend({
    childAges: Ember.computed.mapBy('children', 'age'),
    maxChildAge: Ember.computed.max('childAges')
  });

  var lordByron = Person.create({ children: [] });

  lordByron.get('maxChildAge'); // -Infinity
  lordByron.get('children').pushObject({
    name: 'Augusta Ada Byron', age: 7
  });
  lordByron.get('maxChildAge'); // 7
  lordByron.get('children').pushObjects([{
    name: 'Allegra Byron',
    age: 5
  }, {
    name: 'Elizabeth Medora Leigh',
    age: 8
  }]);
  lordByron.get('maxChildAge'); // 8
  ```

  @method computed.max
  @for Ember
  @param {String} dependentKey
  @return {Ember.ComputedProperty} computes the largest value in the dependentKey's array
*/
export function max(dependentKey) {
  return computed(dependentKey+'.[]', function(){
    var srcArray = get(this, dependentKey);
    if(!srcArray) return -Infinity;

    return get(this, dependentKey).reduce(function (previousValue, item) {
      return Math.max(previousValue, item);
    }, -Infinity)
  })
}

/**
  A computed property that calculates the minimum value in the
  dependent array. This will return `Infinity` when the dependent
  array is empty.

  ```javascript
  var Person = Ember.Object.extend({
    childAges: Ember.computed.mapBy('children', 'age'),
    minChildAge: Ember.computed.min('childAges')
  });

  var lordByron = Person.create({ children: [] });

  lordByron.get('minChildAge'); // Infinity
  lordByron.get('children').pushObject({
    name: 'Augusta Ada Byron', age: 7
  });
  lordByron.get('minChildAge'); // 7
  lordByron.get('children').pushObjects([{
    name: 'Allegra Byron',
    age: 5
  }, {
    name: 'Elizabeth Medora Leigh',
    age: 8
  }]);
  lordByron.get('minChildAge'); // 5
  ```

  @method computed.min
  @for Ember
  @param {String} dependentKey
  @return {Ember.ComputedProperty} computes the smallest value in the dependentKey's array
*/
export function min(dependentKey) {
  return computed(dependentKey+'.[]', function(){
    var srcArray = get(this, dependentKey);
    if(!srcArray) return +Infinity;

    return get(this, dependentKey).reduce(function (previousValue, item) {
      return Math.min(previousValue, item);
    }, +Infinity)
  })
}

/**
  Returns an array mapped via the callback

  The callback method you provide should have the following signature.
  `item` is the current item in the iteration.
  `index` is the integer index of the current item in the iteration.

  ```javascript
  function(item, index);
  ```

  Example

  ```javascript
  var Hamster = Ember.Object.extend({
    excitingChores: Ember.computed.map('chores', function(chore, index) {
      return chore.toUpperCase() + '!';
    })
  });

  var hamster = Hamster.create({
    chores: ['clean', 'write more unit tests']
  });

  hamster.get('excitingChores'); // ['CLEAN!', 'WRITE MORE UNIT TESTS!']
  ```

  @method computed.map
  @for Ember
  @param {String} dependentKey
  @param {Function} callback
  @return {Ember.ComputedProperty} an array mapped via the callback
*/
export function map(dependentKey, callback) {
  var depArray = dependentKey;
  if(dependentKey.indexOf('.@each') !== -1){
    depArray = dependentKey.split('.')[0];
  }else{
    dependentKey += '.[]';
  }
  return computed(dependentKey, function(property){
    var sourceArray, mappedArray, i;

    sourceArray = get(this, depArray);

    mappedArray = this.__ember_meta__.cacheMeta[property];

    if (mappedArray === undefined) {
      mappedArray = this.__ember_meta__.cacheMeta[property] = [];
    }

    if(!sourceArray) return mappedArray;
    for (i = 0; i < sourceArray.length; i++) {
      mappedArray[i] = callback(sourceArray[i], i);
    }

    mappedArray.notifyPropertyChange('[]');

    return mappedArray;
  })
}

/**
  Returns an array mapped to the specified key.

  ```javascript
  var Person = Ember.Object.extend({
    childAges: Ember.computed.mapBy('children', 'age')
  });

  var lordByron = Person.create({ children: [] });

  lordByron.get('childAges'); // []
  lordByron.get('children').pushObject({ name: 'Augusta Ada Byron', age: 7 });
  lordByron.get('childAges'); // [7]
  lordByron.get('children').pushObjects([{
    name: 'Allegra Byron',
    age: 5
  }, {
    name: 'Elizabeth Medora Leigh',
    age: 8
  }]);
  lordByron.get('childAges'); // [7, 5, 8]
  ```

  @method computed.mapBy
  @for Ember
  @param {String} dependentKey
  @param {String} propertyKey
  @return {Ember.ComputedProperty} an array mapped to the specified key
*/
export function mapBy (dependentKey, propertyKey) {
  var callback = function(item) { return get(item, propertyKey); };
  return map(dependentKey + '.@each.' + propertyKey, callback)
}

/**
  @method computed.mapProperty
  @for Ember
  @deprecated Use `Ember.computed.mapBy` instead
  @param dependentKey
  @param propertyKey
*/
export var mapProperty = mapBy;

/**
  Filters the array by the callback.

  The callback method you provide should have the following signature.
  `item` is the current item in the iteration.
  `index` is the integer index of the current item in the iteration.

  ```javascript
  function(item, index);
  ```

  ```javascript
  var Hamster = Ember.Object.extend({
    remainingChores: Ember.computed.filter('chores', function(chore, index) {
      return !chore.done;
    })
  });

  var hamster = Hamster.create({
    chores: [
      { name: 'cook', done: true },
      { name: 'clean', done: true },
      { name: 'write more unit tests', done: false }
    ]
  });

  hamster.get('remainingChores'); // [{name: 'write more unit tests', done: false}]
  ```

  @method computed.filter
  @for Ember
  @param {String} dependentKey
  @param {Function} callback
  @return {Ember.ComputedProperty} the filtered array
*/
export function filter(dependentKey, callback) {
  var depArray = dependentKey;
  if(dependentKey.indexOf('.@each') !== -1){
    depArray = dependentKey.split('.')[0];
  }else{
    dependentKey += '.[]';
  }
  return computed(dependentKey, function(property) {
    var sourceArray, filteredArray, i,
      newLength = 0;

    sourceArray = this.get(depArray);

    filteredArray = this.__ember_meta__.cacheMeta[property];

    if (filteredArray === undefined) {
      filteredArray = this.__ember_meta__.cacheMeta[property] = [];
    }

    for (i = 0; i < sourceArray.length; i++) {
      if (callback(sourceArray[i])){
        filteredArray[newLength++] = sourceArray[i];
      }
    }

    filteredArray.length = newLength;
    filteredArray.notifyPropertyChange('[]');

    return filteredArray;
  });
}

/**
  Filters the array by the property and value

  ```javascript
  var Hamster = Ember.Object.extend({
    remainingChores: Ember.computed.filterBy('chores', 'done', false)
  });

  var hamster = Hamster.create({
    chores: [
      { name: 'cook', done: true },
      { name: 'clean', done: true },
      { name: 'write more unit tests', done: false }
    ]
  });

  hamster.get('remainingChores'); // [{ name: 'write more unit tests', done: false }]
  ```

  @method computed.filterBy
  @for Ember
  @param {String} dependentKey
  @param {String} propertyKey
  @param {*} value
  @return {Ember.ComputedProperty} the filtered array
*/
export function filterBy (dependentKey, propertyKey, value) {
  var callback = function(item){return get(item, propertyKey) === value;};
  return filter(dependentKey + '.@each.' + propertyKey, callback);
}

/**
  @method computed.filterProperty
  @for Ember
  @param dependentKey
  @param propertyKey
  @param value
  @deprecated Use `Ember.computed.filterBy` instead
*/
export var filterProperty = filterBy;

/**
  A computed property which returns a new array with all the unique
  elements from one or more dependent arrays.

  Example

  ```javascript
  var Hamster = Ember.Object.extend({
    uniqueFruits: Ember.computed.uniq('fruits')
  });

  var hamster = Hamster.create({
    fruits: [
      'banana',
      'grape',
      'kale',
      'banana'
    ]
  });

  hamster.get('uniqueFruits'); // ['banana', 'grape', 'kale']
  ```

  @method computed.uniq
  @for Ember
  @param {String} propertyKey*
  @return {Ember.ComputedProperty} computes a new array with all the
  unique elements from the dependent array
*/
export function uniq() {
  //TODO
  return computed(arguments, function(property) {
    var sourceArray, filteredArray, i,
      newLength = 0;

    sourceArray = this.get(dependentKey);

    filteredArray = this.__ember_meta__.cacheMeta[property];

    if (filteredArray === undefined) {
      filteredArray = this.__ember_meta__.cacheMeta[property] = [];
    }

    for (i = 0; i < sourceArray.length; i++) {
      if (get(sourceArray[i], propertyKey) == value){
        filteredArray[newLength++] = sourceArray[i];
      }
    }

    filteredArray.length = newLength;
    filteredArray.notifyPropertyChange('[]');

    return filteredArray;
  });
}

/**
  Alias for [Ember.computed.uniq](/api/#method_computed_uniq).

  @method computed.union
  @for Ember
  @param {String} propertyKey*
  @return {Ember.ComputedProperty} computes a new array with all the
  unique elements from the dependent array
*/
export var union = uniq;

/**
  A computed property which returns a new array with all the duplicated
  elements from two or more dependent arrays.

  Example

  ```javascript
  var obj = Ember.Object.createWithMixins({
    adaFriends: ['Charles Babbage', 'John Hobhouse', 'William King', 'Mary Somerville'],
    charlesFriends: ['William King', 'Mary Somerville', 'Ada Lovelace', 'George Peacock'],
    friendsInCommon: Ember.computed.intersect('adaFriends', 'charlesFriends')
  });

  obj.get('friendsInCommon'); // ['William King', 'Mary Somerville']
  ```

  @method computed.intersect
  @for Ember
  @param {String} propertyKey*
  @return {Ember.ComputedProperty} computes a new array with all the
  duplicated elements from the dependent arrays
*/
export function intersect() {
  var args = a_slice.call(arguments);

  args.push({
    initialize: function ( changeMeta, instanceMeta) {
      instanceMeta.itemCounts = {};
    },

    addedItem: function(array, item, changeMeta, instanceMeta) {
      var itemGuid = guidFor(item);
      var dependentGuid = guidFor(changeMeta.arrayChanged);
      var numberOfDependentArrays = changeMeta.property._dependentKeys.length;
      var itemCounts = instanceMeta.itemCounts;

      if (!itemCounts[itemGuid]) {
        itemCounts[itemGuid] = {};
      }

      if (itemCounts[itemGuid][dependentGuid] === undefined) {
        itemCounts[itemGuid][dependentGuid] = 0;
      }

      if (++itemCounts[itemGuid][dependentGuid] === 1 &&
          numberOfDependentArrays === keys(itemCounts[itemGuid]).length) {
        array.addObject(item);
      }

      return array;
    },

    removedItem: function(array, item, changeMeta, instanceMeta) {
      var itemGuid = guidFor(item);
      var dependentGuid = guidFor(changeMeta.arrayChanged);
      var numberOfArraysItemAppearsIn;
      var itemCounts = instanceMeta.itemCounts;

      if (itemCounts[itemGuid][dependentGuid] === undefined) {
        itemCounts[itemGuid][dependentGuid] = 0;
      }

      if (--itemCounts[itemGuid][dependentGuid] === 0) {
        delete itemCounts[itemGuid][dependentGuid];
        numberOfArraysItemAppearsIn = keys(itemCounts[itemGuid]).length;

        if (numberOfArraysItemAppearsIn === 0) {
          delete itemCounts[itemGuid];
        }

        array.removeObject(item);
      }

      return array;
    }
  });

  return arrayComputed.apply(null, args);
}

/**
  A computed property which returns a new array with all the
  properties from the first dependent array that are not in the second
  dependent array.

  Example

  ```javascript
  var Hamster = Ember.Object.extend({
    likes: ['banana', 'grape', 'kale'],
    wants: Ember.computed.setDiff('likes', 'fruits')
  });

  var hamster = Hamster.create({
    fruits: [
      'grape',
      'kale',
    ]
  });

  hamster.get('wants'); // ['banana']
  ```

  @method computed.setDiff
  @for Ember
  @param {String} setAProperty
  @param {String} setBProperty
  @return {Ember.ComputedProperty} computes a new array with all the
  items from the first dependent array that are not in the second
  dependent array
*/
export function setDiff(setAProperty, setBProperty) {
  if (arguments.length !== 2) {
    throw new EmberError('setDiff requires exactly two dependent arrays.');
  }

  return arrayComputed(setAProperty, setBProperty, {
    addedItem: function (array, item, changeMeta, instanceMeta) {
      var setA = get(this, setAProperty);
      var setB = get(this, setBProperty);

      if (changeMeta.arrayChanged === setA) {
        if (!setB.contains(item)) {
          array.addObject(item);
        }
      } else {
        array.removeObject(item);
      }

      return array;
    },

    removedItem: function (array, item, changeMeta, instanceMeta) {
      var setA = get(this, setAProperty);
      var setB = get(this, setBProperty);

      if (changeMeta.arrayChanged === setB) {
        if (setA.contains(item)) {
          array.addObject(item);
        }
      } else {
        array.removeObject(item);
      }

      return array;
    }
  });
}



/**
  A computed property which returns a new array with all the
  properties from the first dependent array sorted based on a property
  or sort function.

  The callback method you provide should have the following signature:

  ```javascript
  function(itemA, itemB);
  ```

  - `itemA` the first item to compare.
  - `itemB` the second item to compare.

  This function should return negative number (e.g. `-1`) when `itemA` should come before
  `itemB`. It should return positive number (e.g. `1`) when `itemA` should come after
  `itemB`. If the `itemA` and `itemB` are equal this function should return `0`.

  Therefore, if this function is comparing some numeric values, simple `itemA - itemB` or
  `itemA.get( 'foo' ) - itemB.get( 'foo' )` can be used instead of series of `if`.

  Example

  ```javascript
  var ToDoList = Ember.Object.extend({
    // using standard ascending sort
    todosSorting: ['name'],
    sortedTodos: Ember.computed.sort('todos', 'todosSorting'),

    // using descending sort
    todosSortingDesc: ['name:desc'],
    sortedTodosDesc: Ember.computed.sort('todos', 'todosSortingDesc'),

    // using a custom sort function
    priorityTodos: Ember.computed.sort('todos', function(a, b){
      if (a.priority > b.priority) {
        return 1;
      } else if (a.priority < b.priority) {
        return -1;
      }

      return 0;
    })
  });

  var todoList = ToDoList.create({todos: [
    { name: 'Unit Test', priority: 2 },
    { name: 'Documentation', priority: 3 },
    { name: 'Release', priority: 1 }
  ]});

  todoList.get('sortedTodos');      // [{ name:'Documentation', priority:3 }, { name:'Release', priority:1 }, { name:'Unit Test', priority:2 }]
  todoList.get('sortedTodosDesc');  // [{ name:'Unit Test', priority:2 }, { name:'Release', priority:1 }, { name:'Documentation', priority:3 }]
  todoList.get('priorityTodos');    // [{ name:'Release', priority:1 }, { name:'Unit Test', priority:2 }, { name:'Documentation', priority:3 }]
  ```

  @method computed.sort
  @for Ember
  @param {String} dependentKey
  @param {String or Function} sortDefinition a dependent key to an
  array of sort properties (add `:desc` to the arrays sort properties to sort descending) or a function to use when sorting
  @return {Ember.ComputedProperty} computes a new sorted array based
  on the sort property array or callback function
*/
export function sort(itemsKey, sortDefinition) {
  var append, callback, sortings,
    setSorting = function(){};

  if (typeof sortDefinition == 'function'){

    append = '.[]';
    callback = sortDefinition;

  }else{

    append = '.@each.{' + sortDefinition.join(',') + '}';

    setSorting = function(){
      sortings.length = 0;
      forEach(sortDefinition, function (sortPropertyDefinition, i) {
        var s = sortings[i] = {}, idx;

        if ((idx = sortPropertyDefinition.indexOf(':')) !== -1) {
          s['sortProperty'] = sortPropertyDefinition.substring(0, idx);
          s['asc'] = sortPropertyDefinition.substring(idx + 1).toLowerCase() !== 'desc';
        } else {
          s['sortProperty'] = sortPropertyDefinition;
          s['asc'] = true;
        }
      });
    };

    callback = function(itemA, itemB){
      var keyA, keyB, i, sortProperty, asc, result;

      for ( i = 0; i < sortings.length; ++i) {
        sortProperty = sortings[i]['sortProperty'];
        keyA = get(itemA, sortProperty);
        keyB = get(itemB, sortProperty);

        asc = sortings[i]['asc'];

        result = compare(keyA, keyB);

        if (result !== 0) {
          return asc ? result : (-1 * result);
        }
      }
      return 0;
    }
  }
  return computed(itemsKey+append, function(property) {
    var sourceArray, sortedArray, i;
    setSorting();

    sourceArray = this.get(itemsKey);

    sortedArray = this.__ember_meta__.cacheMeta[property];

    if (sortedArray === undefined) {
      sortedArray = this.__ember_meta__.cacheMeta[property] = [];
    }

    for (i = 0; i < sourceArray.length; i++) {
      sortedArray[i] = sourceArray[i];
    }

    sortedArray.sort(callback);

    sortedArray.notifyPropertyChange('[]');

    return sortedArray;
  });
}
