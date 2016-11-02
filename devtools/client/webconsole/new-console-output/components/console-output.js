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

const { cellSizeCache, messageBodyCache } = require("devtools/client/webconsole/new-console-output/utils/caches");

const ConsoleOutput = createClass({

  displayName: "ConsoleOutput",

  propTypes: {
    messages: PropTypes.object.isRequired,
    messagesUi: PropTypes.object.isRequired,
    serviceContainer: PropTypes.shape({
      attachRefToHud: PropTypes.func.isRequired,
      autocompletePopupIsOpen: PropTypes.func.isRequired,
    }),
    autoscrollToRow: PropTypes.number,
  },

  componentDidMount() {
    this._largestRowIndex = 0;

    this.shortcuts = new KeyShortcuts({ window });
    [
      "Home",
      "End",
      "PageDown",
      "PageUp"
    ].forEach((key) => this.shortcuts.on(key, this._onShortcut));

    // Used in mochitests.
    this.props.serviceContainer.attachRefToHud("outputScroller", findDOMNode(this.grid));
  },

  componentWillReceiveProps(nextProps) {
    this.setState({
      messages: nextProps.messages,
    });
  },

  componentWillUpdate(nextProps, nextState) {
    if (this.scrollToRow !== false) {
      return;
    }

    // Figure out if the messages should be autoscrolled.
    if (this.props.messages.size == 0
      || !this.stopScrolling
      || nextProps.lastForceScrollMessageIndex > this.props.messages.size
    ) {
      this.scrollToRow = nextProps.messages.size - 1;
    }
  },

  componentDidUpdate() {
    if (this.changedHeights) {
      this.changedHeights = false;
      this.grid.recomputeGridSize();
      this.grid._updateScrollTopForScrollToRow();
    }

    // Clear out props/state used for imperative scrolling.
    this.scrollToRow = false;
    this._scrollToAlignment = null;
  },

  _onShortcut(name, event) {
    // Only respond to events where JSTerm is the target and the autocomplete is not open.
    if (!event.target.closest("textbox.jsterm-input-node")
        || this.props.serviceContainer.autocompletePopupIsOpen()) {
      return;
    }

    switch (name) {
      case "PageDown":
        this.scrollToRow = this.rowStopIndex;
        this._scrollToAlignment = "start";
        break;
      case "PageUp":
        this.scrollToRow = this.rowStartIndex;
        this._scrollToAlignment = "end";
        break;
      case "Home":
        this.scrollToRow = 0;
        this._scrollToAlignment = "start";
        break;
      case "End":
        this.scrollToRow = this.state.messages.size - 1;
        this._scrollToAlignment = "end";
        break;
    }

    this.forceUpdate();
  },

  _onResize() {
    cellSizeCache.clearAllRowHeights();
    this.changedHeights = true;
    this.forceUpdate();
  },

  _onSectionRendered({ rowStartIndex, rowStopIndex }) {
    this.stopScrolling = false;

    this.rowStartIndex = rowStartIndex;
    this.rowStopIndex = rowStopIndex;
    if (rowStopIndex > this._largestRowIndex) {
      this._largestRowIndex = rowStopIndex;
    } else if (rowStopIndex < this._largestRowIndex) {
      this.stopScrolling = true;
    }
  },

  _updateRowHeight(id, index, node) {
    if (!cellSizeCache.hasRowHeightById(id)
      || cellSizeCache.getRowHeightById(id) !== node.scrollHeight) {
      cellSizeCache.setRowHeight(id, index, node.scrollHeight);
      this.changedHeights = true;
      this.forceUpdate();
    }
  },

  _rowRenderer({ rowIndex, style }) {
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
      messageBodyCache,
    });
  },

  getRowHeight({ index }) {
    return cellSizeCache.getRowHeight(index);
  },

  _prepareChildren() {
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
          cellRenderer: this._rowRenderer,
          rowCount: messages.size,
          rowHeight: this.getRowHeight,
          width,
          ref: ref => {
            this.grid = ref;
          },
          onSectionRendered: this._onSectionRendered,
          scrollToAlignment: this._scrollToAlignment || "auto"
        };
        if (this.scrollToRow !== false) {
          gridProps.scrollToRow = this.scrollToRow;
        }
        return createElement(Grid, gridProps);
      }
    );
  },

  render() {
    return (
      dom.div({
        className: "webconsole-output",
        ref: ref => {
          this.outputNode = ref;
        }
      },
      this._prepareChildren()
      )
    );
  }
});

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
