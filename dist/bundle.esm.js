var forEach = function forEach(operation) {
  return function (source) {
    var talkback = void 0;
    source(0, function (t, d) {
      if (t === 0) talkback = d;
      if (t === 1) operation(d);
      if (t === 1 || t === 0) talkback(1);
    });
  };
};

var fromObs = function fromObs(observable) {
  return function (start, sink) {
    if (start !== 0) return;
    var dispose = void 0;
    sink(0, function (t) {
      if (t === 2 && dispose) {
        dispose();
      }
    });
    dispose = observable.subscribe({
      next: function next(x) {
        return sink(1, x);
      },
      error: function error(e) {
        return sink(2, e);
      },
      complete: function complete() {
        return sink(2);
      }
    });
  };
};

var fromIter = function fromIter(iter) {
  return function (start, sink) {
    if (start !== 0) return;
    var iterator = typeof Symbol !== 'undefined' && iter[Symbol.iterator] ? iter[Symbol.iterator]() : iter;
    var inloop = false;
    var got1 = false;
    var res = void 0;
    function loop() {
      inloop = true;
      while (got1) {
        got1 = false;
        res = iterator.next();
        if (res.done) sink(2);else sink(1, res.value);
      }
      inloop = false;
    }
    sink(0, function (t) {
      if (t === 1) {
        got1 = true;
        if (!inloop && !(res && res.done)) loop();
      }
    });
  };
};

var fromEvent = function fromEvent(node, name) {
  return function (start, sink) {
    if (start !== 0) return;
    var handler = function handler(ev) {
      return sink(1, ev);
    };
    sink(0, function (t) {
      if (t === 2) node.removeEventListener(name, handler);
    });
    node.addEventListener(name, handler);
  };
};

var fromPromise = function fromPromise(promise) {
  return function (start, sink) {
    if (start !== 0) return;
    var ended = false;
    var onfulfilled = function onfulfilled(val) {
      if (ended) return;
      sink(1, val);
      sink(2);
    };
    var onrejected = function onrejected(err) {
      if (ended) return;
      sink(2, err);
    };
    promise.then(onfulfilled, onrejected);
    sink(0, function (t) {
      if (t === 2) ended = true;
    });
  };
};

var interval = function interval(period) {
  return function (start, sink) {
    if (start !== 0) return;
    var i = 0;
    var id = setInterval(function () {
      sink(1, i++);
    }, period);
    sink(0, function (t) {
      if (t === 2) clearInterval(id);
    });
  };
};

var map = function map(f) {
  return function (source) {
    return function (start, sink) {
      if (start !== 0) return;
      source(0, function (t, d) {
        sink(t, t === 1 ? f(d) : d);
      });
    };
  };
};

function scan(reducer, seed) {
  var hasAcc = arguments.length === 2;
  return function (source) {
    return function (start, sink) {
      if (start !== 0) return;
      var acc = seed;
      source(0, function (t, d) {
        if (t === 1) {
          acc = hasAcc ? reducer(acc, d) : (hasAcc = true, d);
          sink(1, acc);
        } else sink(t, d);
      });
    };
  };
}

var flatten = function flatten(source) {
  return function (start, sink) {
    if (start !== 0) return;
    var exists = function exists(x) {
      return typeof x !== 'undefined';
    };
    var absent = function absent(x) {
      return typeof x === 'undefined';
    };
    var noop = function noop() {};
    var outerEnded = false;
    var outerTalkback = void 0;
    var innerTalkback = void 0;
    function talkback(t) {
      if (t === 1) (innerTalkback || outerTalkback || noop)(1);
      if (t === 2) {
        innerTalkback && innerTalkback(2);
        outerTalkback && outerTalkback(2);
      }
    }
    source(0, function (T, D) {
      if (T === 0) {
        outerTalkback = D;
        sink(0, talkback);
      } else if (T === 1) {
        var innerSource = D;
        if (innerTalkback) innerTalkback(2);
        innerSource(0, function (t, d) {
          if (t === 0) {
            innerTalkback = d;
            innerTalkback(1);
          } else if (t === 1) sink(1, d);else if (t === 2 && absent(d)) {
            if (outerEnded) sink(2);else {
              innerTalkback = void 0;
              outerTalkback(1);
            }
          } else if (t === 2 && exists(d)) sink(2, d);
        });
      } else if (T === 2 && absent(D)) {
        if (!innerTalkback) sink(2);else outerEnded = true;
      } else if (T === 2 && exists(D)) sink(2, D);
    });
  };
};

var take = function take(max) {
  return function (source) {
    return function (start, sink) {
      if (start !== 0) return;
      var taken = 0;
      var sourceTalkback = void 0;
      function talkback(t, d) {
        if (taken < max) sourceTalkback(t, d);
      }
      source(0, function (t, d) {
        if (t === 0) {
          sourceTalkback = d;
          sink(0, talkback);
        } else if (t === 1) {
          if (taken < max) {
            taken++;
            sink(t, d);
            if (taken === max) {
              sink(2);
              sourceTalkback(2);
            }
          }
        } else {
          sink(t, d);
        }
      });
    };
  };
};

var skip = function skip(max) {
  return function (source) {
    return function (start, sink) {
      if (start !== 0) return;
      var skipped = 0;
      var talkback = void 0;
      source(0, function (t, d) {
        if (t === 0) {
          talkback = d;
          sink(t, d);
        } else if (t === 1) {
          if (skipped < max) {
            skipped++;
            talkback(1);
          } else sink(t, d);
        } else {
          sink(t, d);
        }
      });
    };
  };
};

var filter = function filter(condition) {
  return function (source) {
    return function (start, sink) {
      if (start !== 0) return;
      var talkback = void 0;
      source(0, function (t, d) {
        if (t === 0) {
          talkback = d;
          sink(t, d);
        } else if (t === 1) {
          if (condition(d)) sink(t, d);else talkback(1);
        } else sink(t, d);
      });
    };
  };
};

function merge() {
  for (var _len = arguments.length, sources = Array(_len), _key = 0; _key < _len; _key++) {
    sources[_key] = arguments[_key];
  }

  return function (start, sink) {
    if (start !== 0) return;
    var n = sources.length;
    var sourceTalkbacks = Array(n);
    var startCount = 0;
    var endCount = 0;
    var talkback = function talkback(t) {
      if (t !== 2) return;
      for (var i = 0; i < n; i++) {
        sourceTalkbacks[i](2);
      }
    };

    var _loop = function _loop(i) {
      sources[i](0, function (t, d) {
        if (t === 0) {
          sourceTalkbacks[i] = d;
          if (++startCount === n) sink(0, talkback);
        } else if (t === 2) {
          if (++endCount === n) sink(2);
        } else sink(t, d);
      });
    };

    for (var i = 0; i < n; i++) {
      _loop(i);
    }
  };
}

var concat = function concat() {
  for (var _len = arguments.length, sources = Array(_len), _key = 0; _key < _len; _key++) {
    sources[_key] = arguments[_key];
  }

  return function (start, sink) {
    if (start !== 0) return;
    var n = sources.length;
    if (n === 0) {
      sink(0, function () {});
      sink(2);
      return;
    }
    var i = 0;
    var sourceTalkback = void 0;
    var talkback = function talkback(t, d) {
      if (t === 1 || t === 2) {
        sourceTalkback(t, d);
      }
    };
    (function next() {
      if (i === n) {
        sink(2);
        return;
      }
      sources[i](0, function (t, d) {
        if (t === 0) {
          sourceTalkback = d;
          if (i === 0) sink(0, talkback);else sourceTalkback(1);
        } else if (t === 1) {
          sink(1, d);
        } else if (t === 2) {
          i++;
          next();
        }
      });
    })();
  };
};

var EMPTY = {};

var combine = function combine() {
  for (var _len = arguments.length, sources = Array(_len), _key = 0; _key < _len; _key++) {
    sources[_key] = arguments[_key];
  }

  return function (start, sink) {
    if (start !== 0) return;
    var n = sources.length;
    if (n === 0) {
      sink(0, function () {});
      sink(1, []);
      sink(2);
      return;
    }
    var Ns = n; // start counter
    var Nd = n; // data counter
    var Ne = n; // end counter
    var vals = Array(n);
    var sourceTalkbacks = Array(n);
    var talkback = function talkback(t, d) {
      if (t !== 2) return;
      for (var i = 0; i < n; i++) {
        sourceTalkbacks[i](2);
      }
    };
    sources.forEach(function (source, i) {
      vals[i] = EMPTY;
      source(0, function (t, d) {
        if (t === 0) {
          sourceTalkbacks[i] = d;
          if (--Ns === 0) sink(0, talkback);
        } else if (t === 1) {
          var _Nd = !Nd ? 0 : vals[i] === EMPTY ? --Nd : Nd;
          vals[i] = d;
          if (_Nd === 0) {
            var arr = Array(n);
            for (var j = 0; j < n; ++j) {
              arr[j] = vals[j];
            }sink(1, arr);
          }
        } else if (t === 2) {
          if (--Ne === 0) sink(2);
        } else {
          sink(t, d);
        }
      });
    });
  };
};

var share = function share(source) {
  var sinks = [];
  var sourceTalkback = void 0;
  return function shared(start, sink) {
    if (start !== 0) return;
    sinks.push(sink);
    if (sinks.length === 1) {
      source(0, function (t, d) {
        if (t === 0) sourceTalkback = d;else {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = sinks.slice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var s = _step.value;
              s(t, d);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }if (t === 2) sinks = [];
      });
    }
    sink(0, function (t, d) {
      if (t === 0) return;
      if (t === 2) {
        var i = sinks.indexOf(sink);
        if (i > -1) sinks.splice(i, 1);
        if (!sinks.length) sourceTalkback(2);
      } else {
        sourceTalkback(t, d);
      }
    });
  };
};

function pipe() {
  for (var _len = arguments.length, cbs = Array(_len), _key = 0; _key < _len; _key++) {
    cbs[_key] = arguments[_key];
  }

  var res = cbs[0];
  for (var i = 1, n = cbs.length; i < n; i++) {
    res = cbs[i](res);
  }return res;
}

export { forEach, fromObs, fromIter, fromEvent, fromPromise, interval, map, scan, flatten, take, skip, filter, merge, concat, combine, share, pipe };
