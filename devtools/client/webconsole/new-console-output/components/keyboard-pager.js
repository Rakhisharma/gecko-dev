/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {
  createClass,
  PropTypes
} = require("devtools/client/shared/vendor/react");

const {KeyShortcuts} = require("devtools/client/shared/key-shortcuts");

const KeyboardPager = createClass({
  propTypes: {
    allowKeyboardPaging: PropTypes.func.isRequired,
    list: PropTypes.object.isRequired,
  },

  componentWillMount() {
    // Scroll state is handled outside of controlled props/state for performance reasons.
    this._scrollState = getInitialScrollState();

    // Set handler for keyboard accessibility.
    this.shortcuts = new KeyShortcuts({ window });
    [
      "Home",
      "End",
      "PageDown",
      "PageUp"
    ].forEach((key) => this.shortcuts.on(key, this._onShortcut));
  },

  componentWillReceiveProps(nextProps) {
    // If the old list of messages is not a subset of the new list of messages, any stored
    // scroll state would be invalid, so reset.
    // @TODO Move rowStartIndex and rowStopIndex to an external cache. Then clear the
    // cache when certain actions are fired.
    if (!isSubset(this.props.list, nextProps.list)) {
      this._scrollState = getInitialScrollState();
    }
  },

  componentDidUpdate() {
    // Clear out props/state used for imperative scrolling.
    this._scrollState.scrollToRow = false;
    this._scrollState.scrollToAlignment = null;
  },

  _onSectionRendered({ rowStartIndex, rowStopIndex }) {
    // Store these values for use with PageUp / PageDown.
    this._scrollState.rowStartIndex = rowStartIndex;
    this._scrollState.rowStopIndex = rowStopIndex;
  },

  _onShortcut(name, event) {
    // Only respond to events where JSTerm is the target and the autocomplete is not open.
    if (!this.props.allowKeyboardPaging(event)) {
      return;
    }

    switch (name) {
      case "PageDown":
        this._scrollState.scrollToRow = this._scrollState.rowStopIndex;
        this._scrollState.scrollToAlignment = "start";
        break;
      case "PageUp":
        this._scrollState.scrollToRow = this._scrollState.rowStartIndex;
        this._scrollState.scrollToAlignment = "end";
        break;
      case "Home":
        this._scrollState.scrollToRow = 0;
        this._scrollState.scrollToAlignment = "start";
        break;
      case "End":
        this.scrollToRow = this.props.list.size - 1;
        this._scrollState.scrollToAlignment = "end";
        break;
    }

    this.forceUpdate();
  },

  render() {
    const { children } = this.props;
    return children({
      scrollToRow: this._scrollState.scrollToRow,
      scrollToAlignment: this._scrollState.scrollToAlignment,
      onSectionRendered: this._onSectionRendered,
    });
  },
});

function getInitialScrollState() {
  return {
    rowStartIndex: 0,
    rowStopIndex: 0,
    scrollToRow: false,
    scrollToAlignment: "auto",
  };
}

function isSubset(prevList, nextList) {
  // Running List.isSubset() on large lists is a huge performance hit. Instead, we use a
  // heuristic to determine if the previous list is a subset of the next.
  // There is a (very unlikely, maybe impossible) edge case here.
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=1308216#c23 for an explanation.
  // We dont' care about this use case because this is only used to determine whether we
  // should clear the rowStartIndex and rowStopIndex. The contents of the messages
  // displayed isn't espcially important for those.
  return !(
    !prevList
    || prevList.size == 0
    || nextList.size == 0
    || nextList.size < prevList.size
    || prevList.get(0).id !== nextList.get(0).id
    || prevList.get(prevList.size - 1).id !== nextList.get(prevList.size - 1).id
  );
}

module.exports = KeyboardPager;
