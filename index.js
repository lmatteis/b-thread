/**
 * License to:
 * Ashrov, A., Marron, A., Weiss, G., & Wiener, G. (2015). A use-case for behavioral programming: an architecture in JavaScript and Blockly for interactive applications with cross-cutting scenarios. Science of Computer Programming, 98, 268-292.
 * BP implementation for Javascript 1.7 (Mozilla)
 */

const isEmpty = function(arr) {
  return arr.length == 0;
};

const notEmpty = function(arr) {
  return arr.length > 0;
};

function compareBids(a, b) {
  return a.priority - b.priority;
}

function BProgram() {
  this.running = [];
  this.pending = [];
  this.lastEvent = undefined;
  this.disabled = []; // List of currently disabled elements
}

BProgram.prototype.addBThread = function(name, prio, fun) {
  var bound = fun.bind({
    lastEvent: () => this.lastEvent
  });
  var bt = bound(); // Activate the generator
  var bid = {
    name: name,
    priority: prio,
    bthread: bt
  };
  this.running.push(bid);
};

BProgram.prototype.addAll = function(bthreads, priorities) {
  for (var name in bthreads) {
    var fun = bthreads[name];
    var prio = priorities[name];
    this.addBThread(name, prio, fun);
  }
};

BProgram.prototype.request = function(e) {
  var name = 'request ' + e;
  var bt = function*() {
    yield {
      request: [e],
      wait: [
        function(x) {
          return true;
        }
      ]
    };
  };
  // XXX should be lowest priority (1 is highest)
  this.addBThread(name, 1, bt);
  this.run(); // Initiate super-step
};

BProgram.prototype.run = function() {
  if (isEmpty(this.running)) {
    return; // TODO: Test end-case of empty current list
  }
  while (notEmpty(this.running)) {
    var bid = this.running.shift();
    var bt = bid.bthread;
    var next = bt.next(this.lastEvent);
    if (!next.done) {
      var newbid = next.value; // Run an iteration of the generator
      newbid.bthread = bt; // Bind the bthread to the bid for running later
      newbid.priority = bid.priority; // Keep copying the prio
      newbid.name = bid.name; // Keep copying the name
      this.pending.push(newbid);
    } else {
      // This is normal - the bthread has finished.
    }
  }
  // End of current step
  this.selectNextEvent();
  if (this.lastEvent) {
    // There is an actual last event selected
    var temp = [];
    while (notEmpty(this.pending)) {
      bid = this.pending.shift();
      var r = bid.request ? bid.request : [];
      // Always convert `request: 'FOO'` into `request: ['FOO']`
      if (!Array.isArray(r)) {
        r = [r];
      }
      var w = bid.wait ? bid.wait : [];
      if (!Array.isArray(w)) {
        w = [w];
      }
      var waitlist = r.concat(w);
      var cur = false;
      for (var i = 0; i < waitlist.length; i++) {
        var waiting = waitlist[i];
        // Convert string `request|wait: 'FOO'` into `request|wait: { type: 'FOO'}`
        if (typeof waiting === 'string') {
          waiting = { type: waiting };
        }
        if (
          waiting.type === this.lastEvent.type ||
          (typeof waiting === 'function' && waiting(this.lastEvent))
        ) {
          cur = true;
        }
      }
      if (cur && bid.bthread) {
        this.running.push(bid);
      } else {
        temp.push(bid);
      }
    }
    this.pending = temp;
    this.run();
  } else {
    // Nothing was selected - end of super-step
    this.lastEvent = undefined; // Gotcha: null is not the same as undefined
  }
};

BProgram.prototype.selectNextEvent = function() {
  var i, j, k;
  var candidates = [];
  var events = [];
  for (i = 0; i < this.pending.length; i++) {
    var bid = this.pending[i];
    if (bid.request) {
      // Always convert `request: 'FOO'` into `request: ['FOO']`
      if (!Array.isArray(bid.request)) {
        bid.request = [bid.request];
      }
      for (j = 0; j < bid.request.length; j++) {
        var e = bid.request[j];
        // Convert string `request: 'FOO'` into `request: { type: 'FOO'}`
        if (typeof e === 'string') {
          e = { type: e };
        }
        var c = {
          priority: bid.priority,
          event: e
        };
        candidates.push(c);
      }
    }
  }
  for (i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var ok = true;
    for (j = 0; j < this.pending.length; j++) {
      bid = this.pending[j];
      if (bid.block) {
        // Always convert `block: 'FOO'` into `block: ['FOO']`
        if (!Array.isArray(bid.block)) {
          bid.block = [bid.block];
        }
        for (k = 0; k < bid.block.length; k++) {
          var blocked = bid.block[k];
          e = candidate.event;

          // Convert string `block: 'FOO'` into `block: { type: 'FOO'}`
          if (typeof blocked === 'string') {
            blocked = { type: blocked };
          }

          if (
            e.type === blocked.type ||
            (typeof blocked === 'function' && blocked(e))
          ) {
            ok = false;
          }
        }
      }
    }
    if (ok) {
      events.push(candidate);
    }
  }
  if (events.length > 0) {
    events.sort(compareBids);
    this.lastEvent = events[0].event;
    this.lastEvent.priority = events[0].priority;
  } else {
    this.lastEvent = null;
  }
};

export default BProgram;
