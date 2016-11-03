/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {
  createClass,
  createElement,
  createFactory,
  DOM: dom,
  PropTypes
} = require("devtools/client/shared/vendor/react");
const { findDOMNode } = require("devtools/client/shared/vendor/react-dom");

const {
  AutoSizer,
  Grid,
} = require("devtools/client/shared/vendor/react-virtualized");
const { connect } = require("devtools/client/shared/vendor/react-redux");

const {KeyShortcuts} = require("devtools/client/shared/key-shortcuts");

const {
  getAllMessages,
  getAllMessagesUiById,
  getAllMessagesTableDataById,
  getAllGroupsById,
  getLastForceScrollMessageIndex,
} = require("devtools/client/webconsole/new-console-output/selectors/messages");
const MessageContainer = createFactory(require("devtools/client/webconsole/new-console-output/components/message-container").MessageContainer);

const { cellSizeCache } = require("devtools/client/webconsole/new-console-output/utils/caches");

/**
 * The container for the list of messages.
 *
 * This component is extremely stateful, managing its state outside of React's controled
 * props/state system. This is for performance reasons. If similar performance can be
 * achieved for tasks like bulk logging and scrolling with a less stateful approach, that
 * would be preferable.
 */
const ConsoleOutput = createClass({

  displayName: "ConsoleOutput",

  propTypes: {
    messages: PropTypes.object.isRequired,
    messagesUi: PropTypes.object.isRequired,
    serviceContainer: PropTypes.shape({
      attachRefToHud: PropTypes.func.isRequired,
      autocompletePopupIsOpen: PropTypes.func.isRequired,
    }),
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

    this._scrollState.scrollToRow = this.props.messages.size;
  },

  componentDidMount() {
    // For mochitests.
    this.props.serviceContainer.attachRefToHud("outputScroller", findDOMNode(this.grid));
  },

  componentWillReceiveProps(nextProps) {
    console.log(nextProps.messages.toJS())
    // If the old list of messages is not a subset of the new list of messages, any stored
    // scroll state would be invalid, so reset.
    if (isSubset(this.props.messages, nextProps.messages)) {
      this._scrollState = getInitialScrollState();
    }

    // Store the messages on state so that PageDown can access them in the shortcut
    // handler.
    // @TODO determine if this is really necessary.
    this.setState({
      messages: nextProps.messages,
    });
  },

  componentWillUpdate(nextProps, nextState) {
    // If a scrollToRow value is set at this point, it means that the user is scrolling
    // with the keyboard. Do not auto/force scroll.
    if (this._scrollState.scrollToRow !== false) {
      return;
    }

    // Figure out if the messages should be autoscrolled.
    if (this.props.messages.size == 0
      || this._scrollState.autoscrollOn
      // Certain kinds of messages force a scroll. If one of those has come in since we
      // last rendered, force scroll to the bottom.
      || nextProps.lastForceScrollMessageIndex > this.props.messages.size - 1
    ) {
      this._scrollState.scrollToRow = nextProps.messages.size - 1;
    }
  },

  componentDidUpdate() {
    // If changes have been made to the cached row heights, recompute the grid size
    // (which forces a rerender).
    if (cellSizeCache.isDirty()) {
      cellSizeCache.clearIsDirty();
      this.grid.recomputeGridSize();
      // Unfortunately calling this "private" method is required to position the scroll
      // top after cell heights have been changed.
      this.grid._updateScrollTopForScrollToRow();
    }

    // Clear out props/state used for imperative scrolling.
    this._scrollState.scrollToRow = false;
    this._scrollState.scrollToAlignment = null;
  },

  _onShortcut(name, event) {
    // Only respond to events where JSTerm is the target and the autocomplete is not open.
    if (!event.target.closest("textbox.jsterm-input-node")
        || this.props.serviceContainer.autocompletePopupIsOpen()) {
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
        this.scrollToRow = this.state.messages.size - 1;
        this._scrollState.scrollToAlignment = "end";
        break;
    }

    this.forceUpdate();
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

  _onSectionRendered({ rowStartIndex, rowStopIndex }) {
    // Default to autoscroll being truend on.
    this._scrollState.autoscrollOn = true;

    // Check whether autoscroll should be turned off. If the last message in the block
    // that we've just rendered isn't the last message in the messages list, then the
    // user has scrolled up. Turn off autoscrolling.
    // @TODO improve this logic. It breaks in the "lots of logs" case.
    if (rowStopIndex < this._scrollState.largestRowIndex) {
      this._scrollState.autoscrollOn = false;
    } else {
      this._scrollState.largestRowIndex = rowStopIndex;
    }

    // Store these values for use with PageUp / PageDown.
    this._scrollState.rowStartIndex = rowStartIndex;
    this._scrollState.rowStopIndex = rowStopIndex;
  },

  _updateRowHeight(id, index, node) {
    // If this row's height hasn't been cached, or its height has changed, update it in
    // the cache. Since this is called after the render cycle is complete (from the
    // message's componentDidMount or componentDidUpdate), we then have to force an update
    // to ensure the message's container is rerendered. When it is, the rowHeightGetter
    // will pull the new height from the cache.
    if (!cellSizeCache.hasRowHeightById(id)
      || cellSizeCache.getRowHeightById(id) !== node.scrollHeight) {
      cellSizeCache.setRowHeight(id, index, node.scrollHeight);
      this.forceUpdate();
    }
  },

  _renderRow({ rowIndex, style }) {
    let {
      dispatch,
      messages,
      messagesUi,
      messagesTableData,
      serviceContainer,
      groups,
    } = this.props;

    const message = messages.get(rowIndex);

    const parentGroups = message.groupId ? (
      (groups.get(message.groupId) || [])
        .concat([message.groupId])
    ) : [];

    return MessageContainer({
      dispatch,
      message,
      key: message.id,
      serviceContainer,
      open: messagesUi.includes(message.id),
      tableData: messagesTableData.get(message.id),
      indent: parentGroups.length,
      style,
      updateRowHeight: this._updateRowHeight,
      rowIndex,
    });
  },

  _renderGrid() {
    const { messages } = this.props;
    return createElement(AutoSizer,
      {
        onResize: this._onResize
      },
      ({ height, width }) => {
        let gridProps = {
          columnCount: 1,
          columnWidth: width,
          height,
          overscanRowCount: 5,
          cellRenderer: this._renderRow,
          rowCount: messages.size,
          rowHeight: getRowHeight,
          width,
          ref: ref => {
            this.grid = ref;
          },
          onSectionRendered: this._onSectionRendered,
          scrollToAlignment: this._scrollState.scrollToAlignment || "auto"
        };
        if (this._scrollState.scrollToRow !== false) {
          gridProps.scrollToRow = this._scrollState.scrollToRow;
        }
        return createElement(Grid, gridProps);
      }
    );
  },

  render() {
    return (
      dom.div({
        className: "webconsole-output",
      },
      this._renderGrid()
      )
    );
  }
});

function getInitialScrollState() {
  return {
    largestRowIndex: 0,
    rowStartIndex: 0,
    rowStopIndex: 0,
    autoscrollOn: true,
    scrollToRow: 0,
    scrollToAlignment: "auto",
    resizedWidth: null,
  };
}

function isSubset(prevList, nextList) {
  // Running List.isSubset() on large lists is a huge performance hit. Instead, we use a
  // heuristic to determine if the previous list is a subset of the next.
  return !(
    !prevList
    || prevList.size == 0
    || nextList.size == 0
    || nextList.size < prevList.size
    || prevList.get(0).id !== nextList.get(0).id
    || prevList.get(prevList.size - 1).id !== nextList.get(prevList.size - 1).id
  );
}

function getRowHeight({ index }) {
  return cellSizeCache.getRowHeight(index);
}

function mapStateToProps(state, props) {
  return {
    messages: getAllMessages(state),
    messagesUi: getAllMessagesUiById(state),
    messagesTableData: getAllMessagesTableDataById(state),
    lastForceScrollMessageIndex: getLastForceScrollMessageIndex(state),
    groups: getAllGroupsById(state),
  };
}

module.exports = connect(mapStateToProps)(ConsoleOutput);
