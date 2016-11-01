/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {
  createClass,
  PropTypes
} = require("devtools/client/shared/vendor/react");

const { cellSizeCache } = require("devtools/client/webconsole/new-console-output/utils/caches");

const ScrollPositionManager = createClass({
  propTypes: {
    lastForceScrollIndex: PropTypes.number.isRequired,
    list: PropTypes.object.isRequired,
    recomputeGrid: PropTypes.func.isRequired,
  },

  componentWillMount() {
    // Scroll state is handled outside of controlled props/state for performance reasons.
    this._scrollState = getInitialScrollState();
    this._scrollState.scrollToRow = this.props.list.size;
  },

  componentWillUpdate(nextProps, nextState) {
    if (nextProps.scrollToRow) {
      this._scrollState.scrollToRow = nextProps.scrollToRow;
      this._scrollState.scrollToAlignment = nextProps.scrollToAlignment;
    }

    // If a scrollToRow value is set at this point, it means that the user is scrolling
    // with the keyboard. Do not auto/force scroll.
    if (this._scrollState.scrollToRow !== false) {
      return;
    }

    // Figure out if the messages should be autoscrolled.
    if (nextProps.lastForceScrollIndex > this.props.list.size - 1
      || this.props.list.size == 0
      || shouldAutoscroll(this._scrollState.scrollTop,
          this._scrollState.clientHeight, this._scrollState.scrollHeight)
    ) {
      this._scrollState.scrollToRow = nextProps.list.size - 1;
    }
  },

  componentDidUpdate() {
    if (cellSizeCache.isDirty()) {
      cellSizeCache.clearIsDirty();
      this.props.recomputeGrid();
    }
    // Clear out props/state used for imperative scrolling.
    this._scrollState.scrollToRow = false;
    this._scrollState.scrollToAlignment = null;
  },

  _onResize({width}) {
    // If the container width has changed, the heights of cells may have changed. Clear
    // the cache so they can be recalculated.
    if (this._scrollState.resizedWidth !== width) {
      this._scrollState.resizedWidth = width;
      cellSizeCache.clearAllRowHeights();
    }
    this.forceUpdate();
  },

  _onScroll({ clientHeight, scrollHeight, scrollTop}) {
    this._scrollState.clientHeight = clientHeight;
    this._scrollState.scrollTop = scrollTop;
    this._scrollState.scrollHeight = scrollHeight;
  },

  _getScrollState() {
    return this._scrollState;
  },

  render() {
    const { children } = this.props;
    return children({
      onResize: this._onResize,
      onScroll: this._onScroll,
      // We have to use a getter here because AutoSizer is a child of this component and
      // thus can be rerendered without calling rerender on this component. This means it
      // will use the previous values and force a scroll even when it shouldn't.
      //
      // @TODO Make this less stateful. See comment on ConsoleOutput.
      getScrollState: this._getScrollState,
    });
  },
});

function getInitialScrollState() {
  return {
    scrollToRow: false,
    scrollToAlignment: "auto",
    resizedWidth: null,
  };
}

function shouldAutoscroll(scrollTop, clientHeight, scrollHeight) {
  return !scrollHeight
    || scrollHeight < clientHeight
    || Math.abs(scrollTop + clientHeight - scrollHeight) < 20;
}

module.exports = ScrollPositionManager;
