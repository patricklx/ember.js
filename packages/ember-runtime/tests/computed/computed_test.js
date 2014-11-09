import Ember from 'ember-metal/core';
import { map } from 'ember-metal/enumerable_utils';
import {
  get
} from 'ember-metal/property_get';
import { set } from 'ember-metal/property_set';
import run from 'ember-metal/run_loop';
import EmberObject from "ember-runtime/system/object";
import compare from 'ember-runtime/compare';
import computed from "ember-metal/computed";


import {
  sum,
  min,
  max,
  map,
  sort,
  setDiff,
  mapBy,
  filter,
  filterBy,
  uniq,
  intersect
  } from 'ember-runtime/computed/computed_macros';

var obj;

QUnit.module('computed_macros', {
  setup: function () {
    var TestObject = EmberObject.extend({
      _val: 1,
      valCP: computed('_val', function () {
        return this.get('_val') + 1;
      })
    });
    obj = EmberObject.createWithMixins({
      numbers: Ember.A([1, 2, 3, 4, 5, 6, -4, -50, 1, 2, 3]),
      otherNumbers: Ember.A([7, 8, 9, 3, 5]),
      moreNumber: Ember.A([3, 5, 9]),
      objects: Ember.A([
        TestObject.create(),
        TestObject.create({_val: 2}),
        TestObject.create({_val: -2}),
        TestObject.create({_val: -5}),
        TestObject.create({_val: 6})
      ]),

      sum: sum('numbers'),
      min: min('numbers'),
      max: max('numbers'),
      map: map('numbers', function (item) {
        return item + 1;
      }),
      sort: sort('number', compare),
      setDiff: setDiff('number', 'otherNumbers'),
      mapBy: mapBy('objects', 'valCP'),
      filter: filter('numbers', function (item) {
        return item < 0;
      }),
      filterBy: filterBy('objects', 'valCP', 2),
      uniq: uniq('numbers'),
      intersect2: intersect('numbers', 'otherNumbers'),
      intersect3: intersect('numbers', 'otherNumbers', 'moreNumber'),

      sumMap: sum('mapBy')
    });
  },

  teardown: function() {
    run(function() {
      obj.destroy();
    });
  }
});


test("test sum", function() {
  var result = get(obj, 'sum');
  equal(result, -27,  'sum compute correctly');

  run(function() {
    set(obj, 'numbers', Ember.A([1,2]));
  });

  result = get(obj, 'sum');
  equal(result, 3, "sum recompute correctly");
});


test("test min", function() {
  var result = get(obj, 'min');
  equal(result, -50,  'min compute correctly');

  run(function() {
    set(obj, 'numbers', Ember.A([1,2]));
  });

  result = get(obj, 'min correctly');
  equal(result, 1, "min recompute correctly");
});

test("test max", function() {
  var result = get(obj, 'max');
  equal(result, 6,  'max compute correctly');

  run(function() {
    set(obj, 'numbers', Ember.A([1,2]));
  });

  result = get(obj, 'max correctly');
  equal(result, 2, "max recompute correctly");
});

test("test map", function() {
  var result = get(obj, 'map');
  deepEqual(result, [2, 3, 4, 5, 6, 7, -3, -49, 2, 3, 4],  'map compute correctly');

  run(function() {
    set(obj, 'numbers', Ember.A([1,2]));
  });

  result = get(obj, 'map correctly');
  deepEqual(result, [2, 3], "map recompute correctly");
});
