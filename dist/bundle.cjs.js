'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * callbag-for-each
 * ----------------
 *
 * Callbag sink that consume both pullable and listenable sources. When called
 * on a pullable source, it will iterate through its data. When called on a
 * listenable source, it will observe its data.
 *
 * `npm install callbag-for-each`
 *
 * Examples
 * --------
 *
 * Consume a pullable source:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const forEach = require('callbag-for-each');
 *
 *     const source = fromIter([10,20,30,40])
 *
 *     forEach(x => console.log(x))(source); // 10
 *                                           // 20
 *                                           // 30
 *                                           // 40
 *
 * Consume a listenable source:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *
 *     const source = interval(1000);
 *
 *     forEach(x => console.log(x))(source); // 0
 *                                           // 1
 *                                           // 2
 *                                           // 3
 *                                           // ...
 */

const forEach = operation => source => {
  let talkback;
  source(0, (t, d) => {
    if (t === 0) talkback = d;
    if (t === 1) operation(d);
    if (t === 1 || t === 0) talkback(1);
  });
};

function symbolObservablePonyfill(root) {
	var result;
	var Symbol = root.Symbol;

	if (typeof Symbol === 'function') {
		if (Symbol.observable) {
			result = Symbol.observable;
		} else {
			result = Symbol('observable');
			Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
}

/* global window */
var root;

if (typeof self !== 'undefined') {
  root = self;
} else if (typeof window !== 'undefined') {
  root = window;
} else if (typeof global !== 'undefined') {
  root = global;
} else if (typeof module !== 'undefined') {
  root = module;
} else {
  root = Function('return this')();
}

var result = symbolObservablePonyfill(root);

/**
 * callbag-from-obs
 * --------------
 *
 * Convert an observable (or subscribable) to a callbag listenable source.
 *
 * `npm install callbag-from-obs`
 *
 * Example:
 *
 * Convert an RxJS Observable:
 *
 *     const Rx = require('rxjs');
 *     const fromObs = require('callbag-from-obs');
 *     const observe = require('callbag-observe');
 *
 *     const source = fromObs(Rx.Observable.interval(1000).take(4));
 *
 *     observe(x => console.log(x)(source); // 0
 *                                          // 1
 *                                          // 2
 *                                          // 3
 *
 * Convert anything that has the `.subscribe` method:
 *
 *     const fromObs = require('callbag-from-obs');
 *     const observe = require('callbag-observe');
 *
 *     const subscribable = {
 *       subscribe: (observer) => {
 *         let i = 0;
 *         setInterval(() => observer.next(i++), 1000);
 *       }
 *     };
 *
 *     const source = fromObs(subscribable);
 *
 *     observe(x => console.log(x))(source); // 0
 *                                           // 1
 *                                           // 2
 *                                           // 3
 *                                           // ...
 */

const fromObs = observable => (start, sink) => {
  if (start !== 0) return;
  let dispose;
  sink(0, t => {
    if (t === 2 && dispose) {
      if (dispose.unsubscribe) dispose.unsubscribe();
      else dispose();
    }
  });
  observable = observable[result] ? observable[result]() : observable;
  dispose = observable.subscribe({
    next: x => sink(1, x),
    error: e => sink(2, e),
    complete: () => sink(2)
  });
};

const fromIter = iter => (start, sink) => {
  if (start !== 0) return;
  const iterator =
    typeof Symbol !== 'undefined' && iter[Symbol.iterator]
      ? iter[Symbol.iterator]()
      : iter;
  let inloop = false;
  let got1 = false;
  let completed = false;
  let res;
  function loop() {
    inloop = true;
    while (got1 && !completed) {
      got1 = false;
      res = iterator.next();
      if (res.done) {
        sink(2);
        break;
      }
      else sink(1, res.value);
    }
    inloop = false;
  }
  sink(0, t => {
    if (completed) return

    if (t === 1) {
      got1 = true;
      if (!inloop && !(res && res.done)) loop();
    } else if (t === 2) {
      completed = true;
    }
  });
};

const fromEvent = (node, name) => (start, sink) => {
  if (start !== 0) return;
  const handler = ev => sink(1, ev);
  sink(0, t => {
    if (t === 2) node.removeEventListener(name, handler);
  });
  node.addEventListener(name, handler);
};

const fromPromise = promise => (start, sink) => {
  if (start !== 0) return;
  let ended = false;
  const onfulfilled = val => {
    if (ended) return;
    sink(1, val);
    sink(2);
  };
  const onrejected = err => {
    if (ended) return;
    sink(2, err);
  };
  promise.then(onfulfilled, onrejected);
  sink(0, t => {
    if (t === 2) ended = true;
  });
};

const interval = period => (start, sink) => {
  if (start !== 0) return;
  let i = 0;
  const id = setInterval(() => {
    sink(1, i++);
  }, period);
  sink(0, t => {
    if (t === 2) clearInterval(id);
  });
};

const map = f => source => (start, sink) => {
  if (start !== 0) return;
  source(0, (t, d) => {
    sink(t, t === 1 ? f(d) : d);
  });
};

function scan(reducer, seed) {
  let hasAcc = arguments.length === 2;
  return source => (start, sink) => {
    if (start !== 0) return;
    let acc = seed;
    source(0, (t, d) => {
      if (t === 1) {
        acc = hasAcc ? reducer(acc, d) : (hasAcc = true, d);
        sink(1, acc);
      } else sink(t, d);
    });
  };
}

const flatten = source => (start, sink) => {
  if (start !== 0) return;
  const exists = x => typeof x !== 'undefined';
  const absent = x => typeof x === 'undefined';
  let outerEnded = false;
  let outerTalkback;
  let innerTalkback;
  function talkback(t,d) {
    if (t === 1) (innerTalkback || outerTalkback)(1,d);
    if (t === 2) {
      innerTalkback && innerTalkback(2);
      outerTalkback && outerTalkback(2);
    }
  }
  source(0, (T, D) => {
    if (T === 0) {
      outerTalkback = D;
      sink(0, talkback);
    } else if (T === 1) {
      const innerSource = D;
      if (innerTalkback) innerTalkback(2);
      innerSource(0, (t, d) => {
        if (t === 0) {
          innerTalkback = d;
          innerTalkback(1);
        } else if (t === 1) sink(1, d);
        else if (t === 2 && absent(d)) {
          if (outerEnded) sink(2);
          else {
            innerTalkback = void 0;
            outerTalkback(1);
          }
        }
        else if (t === 2 && exists(d)) sink(2, d);
      });
    } else if (T === 2 && absent(D)) {
      if (!innerTalkback) sink(2);
      else outerEnded = true;
    } else if (T === 2 && exists(D)) sink(2, D);
  });
};

const take = max => source => (start, sink) => {
  if (start !== 0) return;
  let taken = 0;
  let sourceTalkback;
  function talkback(t, d) {
    if (taken < max) sourceTalkback(t, d);
  }
  source(0, (t, d) => {
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

const skip = max => source => (start, sink) => {
  if (start !== 0) return;
  let skipped = 0;
  let talkback;
  source(0, (t, d) => {
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

const filter = condition => source => (start, sink) => {
  if (start !== 0) return;
  let talkback;
  source(0, (t, d) => {
    if (t === 0) {
      talkback = d;
      sink(t, d);
    } else if (t === 1) {
      if (condition(d)) sink(t, d);
      else talkback(1);
    }
    else sink(t, d);
  });
};

/**
 * callbag-merge
 * -------------
 *
 * Callbag factory that merges data from multiple callbag sources. Works well
 * with listenable sources, and while it may work for some pullable sources,
 * it is only designed for listenable sources.
 *
 * `npm install callbag-merge`
 *
 * Example:
 *
 *     const interval = require('callbag-interval');
 *     const forEach = require('callbag-for-each');
 *     const merge = require('callbag-merge');
 *
 *     const source = merge(interval(100), interval(350));
 *
 *     forEach(x => console.log(x))(source); // 0
 *                                           // 1
 *                                           // 2
 *                                           // 0
 *                                           // 3
 *                                           // 4
 *                                           // 5
 *                                           // ...
 */

function merge(...sources) {
  return (start, sink) => {
    if (start !== 0) return;
    const n = sources.length;
    const sourceTalkbacks = new Array(n);
    let startCount = 0;
    let endCount = 0;
    let ended = false;
    const talkback = (t, d) => {
      if (t === 2) ended = true;
      for (let i = 0; i < n; i++) sourceTalkbacks[i] && sourceTalkbacks[i](t, d);
    };
    for (let i = 0; i < n; i++) {
      if (ended) return;
      sources[i](0, (t, d) => {
        if (t === 0) {
          sourceTalkbacks[i] = d;
          if (++startCount === 1) sink(0, talkback);
        } else if (t === 2 && d) {
          ended = true;
          for (let j = 0; j < n; j++) {
            if (j !== i) sourceTalkbacks[j] && sourceTalkbacks[j](2);
          }
          sink(2, d);
        } else if (t === 2) {
          sourceTalkbacks[i] = void 0;
          if (++endCount === n) sink(2);
        } else sink(t, d);
      });
    }
  };
}

/**
 * callbag-concat
 * --------------
 *
 * Callbag factory that concatenates the data from multiple (2 or more)
 * callbag sources. It starts each source at a time: waits for the previous
 * source to end before starting the next source. Works with both pullable
 * and listenable sources.
 *
 * `npm install callbag-concat`
 *
 * Example:
 *
 *     const fromIter = require('callbag-from-iter');
 *     const iterate = require('callbag-iterate');
 *     const concat = require('callbag-concat');
 *
 *     const source = concat(fromIter([10,20,30]), fromIter(['a','b']));
 *
 *     iterate(x => console.log(x))(source); // 10
 *                                           // 20
 *                                           // 30
 *                                           // a
 *                                           // b
 */

const concat = (...sources) => (start, sink) => {
  if (start !== 0) return;
  const n = sources.length;
  if (n === 0) {
    sink(0, () => {});
    sink(2);
    return;
  }
  let i = 0;
  let sourceTalkback;
  const talkback = (t, d) => {
    sourceTalkback(t, d);
  };
  (function next() {
    if (i === n) {
      sink(2);
      return;
    }
    sources[i](0, (t, d) => {
      if (t === 0) {
        sourceTalkback = d;
        if (i === 0) sink(0, talkback);
        else sourceTalkback(1);
      } else if (t === 2 && d) {
        sink(2, d);
      } else if (t === 2) {
        i++;
        next();
      } else {
        sink(t, d);
      }
    });
  })();
};

/**
 * callbag-combine
 * ---------------
 *
 * Callbag factory that combines the latest data points from multiple (2 or
 * more) callbag sources. It delivers those latest values as an array. Works
 * with both pullable and listenable sources.
 *
 * `npm install callbag-combine`
 *
 * Example:
 *
 *     const interval = require('callbag-interval');
 *     const observe = require('callbag-observe');
 *     const combine = require('callbag-combine');
 *
 *     const source = combine(interval(100), interval(350));
 *
 *     observe(x => console.log(x))(source); // [2,0]
 *                                           // [3,0]
 *                                           // [4,0]
 *                                           // [5,0]
 *                                           // [6,0]
 *                                           // [6,1]
 *                                           // [7,1]
 *                                           // [8,1]
 *                                           // ...
 */

const EMPTY = {};

const combine = (...sources) => (start, sink) => {
  if (start !== 0) return;
  const n = sources.length;
  if (n === 0) {
    sink(0, () => {});
    sink(1, []);
    sink(2);
    return;
  }
  let Ns = n; // start counter
  let Nd = n; // data counter
  let Ne = n; // end counter
  const vals = new Array(n);
  const sourceTalkbacks = new Array(n);
  const talkback = (t, d) => {
    if (t === 0) return;
    for (let i = 0; i < n; i++) sourceTalkbacks[i](t, d);
  };
  sources.forEach((source, i) => {
    vals[i] = EMPTY;
    source(0, (t, d) => {
      if (t === 0) {
        sourceTalkbacks[i] = d;
        if (--Ns === 0) sink(0, talkback);
      } else if (t === 1) {
        const _Nd = !Nd ? 0 : vals[i] === EMPTY ? --Nd : Nd;
        vals[i] = d;
        if (_Nd === 0) {
          const arr = new Array(n);
          for (let j = 0; j < n; ++j) arr[j] = vals[j];
          sink(1, arr);
        }
      } else if (t === 2) {
        if (--Ne === 0) sink(2);
      } else {
        sink(t, d);
      }
    });
  });
};

const share = source => {
  let sinks = [];
  let sourceTalkback;

  return function shared(start, sink) {
    if (start !== 0) return;
    sinks.push(sink);

    const talkback = (t, d) => {
      if (t === 2) {
        const i = sinks.indexOf(sink);
        if (i > -1) sinks.splice(i, 1);
        if (!sinks.length) sourceTalkback(2);
      } else {
        sourceTalkback(t, d);
      }
    };

    if (sinks.length === 1) {
      source(0, (t, d) => {
        if (t === 0) {
          sourceTalkback = d;
          sink(0, talkback);
        } else for (let s of sinks.slice(0)) s(t, d);
        if (t === 2) sinks = [];
      });
      return
    }

    sink(0, talkback);
  }
};

function pipe(...cbs) {
  let res = cbs[0];
  for (let i = 1, n = cbs.length; i < n; i++) res = cbs[i](res);
  return res;
}

exports.forEach = forEach;
exports.fromObs = fromObs;
exports.fromIter = fromIter;
exports.fromEvent = fromEvent;
exports.fromPromise = fromPromise;
exports.interval = interval;
exports.map = map;
exports.scan = scan;
exports.flatten = flatten;
exports.take = take;
exports.skip = skip;
exports.filter = filter;
exports.merge = merge;
exports.concat = concat;
exports.combine = combine;
exports.share = share;
exports.pipe = pipe;
