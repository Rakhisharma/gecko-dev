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

const {
  getAllMessages,
  getAllMessagesUiById,
  getAllMessagesTableDataById,
  getAllGroupsById,
  getLastForceScrollMessageIndex,
} = require("devtools/client/webconsole/new-console-output/selectors/messages");
const MessageContainer = createFactory(require("devtools/client/webconsole/new-console-output/components/message-container").MessageContainer);
const KeyboardPager = require("devtools/client/webconsole/new-console-output/components/keyboard-pager");
const ScrollPositionManager = require("devtools/client/webconsole/new-console-output/components/scroll-position-manager");

const { cellSizeCache } = require("devtools/client/webconsole/new-console-output/utils/caches");

/**
 * The container for the list of messages.
 *
 * This component is extremely stateful, managing its state outside of React's controled
 * props/state system. So are it's helpers, ScrollPositionManager and KeyboardPager.
 * This is for performance reasons. If similar performance can be achieved for tasks like
 * bulk logging and scrolling with a less stateful approach, that would be preferable.
 * However, many of these problems will be addressed with React Fiber, so the cost of
 * refactoring may not be worth it.
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

  componentDidMount() {
    // For mochitests.
    this.props.serviceContainer.attachRefToHud("outputScroller", findDOMNode(this.grid));
  },

  _updateRowHeight(id, index, node) {
    // If this row's height hasn't been cached, or its height has changed, update it in
    // the cache.
    if (!cellSizeCache.hasRowHeightById(id)
      || cellSizeCache.getRowHeightById(id) !== node.scrollHeight) {
      cellSizeCache.setRowHeight(id, index, node.scrollHeight);
      // If this is the widest row, update the cache.
      if (cellSizeCache.getWidestRowDimension() < node.scrollWidth) {
        cellSizeCache.setWidestRowDimension(node.scrollWidth);
      }
      // Since this is called after the render cycle is complete (from the message's
      // componentDidMount or componentDidUpdate), we then have to force an update
      // to ensure the message's container is rerendered. At that point, the Grid will
      // pull the new heights from the cache using the getRowHeight function.
      this.forceUpdate();
    }
  },

  _recomputeGrid() {
    this.grid.recomputeGridSize();
    // Unfortunately calling this "private" method is required to position the scroll
    // top after cell heights have been changed.
    this.grid._updateScrollTopForScrollToRow();
  },

  _allowKeyboardPaging(event) {
    // Only respond to events where JSTerm is the target and the autocomplete is not open.
    return event.target.closest("textbox.jsterm-input-node")
        && !this.props.serviceContainer.autocompletePopupIsOpen();
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
    const { lastForceScrollMessageIndex, messages } = this.props;
    const keyboardPagerProps = {
      allowKeyboardPaging: this._allowKeyboardPaging,
      list: messages,
    };
    return createElement(KeyboardPager,
      keyboardPagerProps,
      ({
        onSectionRendered,
        scrollToRow: parentScrollToRow,
        scrollToAlignment: parentScrollToAlignment
      }) => {
        const scrollPositionManagerProps = {
          lastForceScrollIndex: lastForceScrollMessageIndex,
          list: messages,
          recomputeGrid: this._recomputeGrid,
        };
        return createElement(ScrollPositionManager,
          scrollPositionManagerProps,
          ({ onResize, onScroll, getScrollState }) => {
            const autosizerProps = { onResize };
            return createElement(AutoSizer,
              autosizerProps,
              ({ height, width }) => {
                const widestRow = cellSizeCache.getWidestRowDimension();
                let gridProps = {
                  columnCount: 1,
                  columnWidth: widestRow > width ? widestRow : width,
                  // Make sure the inner container overflow is visible for scroller at
                  // the bottom.
                  containerStyle: {
                    overflow: "visible",
                  },
                  height,
                  overscanRowCount: 5,
                  cellRenderer: this._renderRow,
                  rowCount: messages.size,
                  rowHeight: getRowHeight,
                  width,
                  ref: ref => {
                    this.grid = ref;
                  },
                  onSectionRendered,
                  onScroll,
                  // Grid has a shouldComponentUpdate which does a shallow compare. We want to
                  // update whenever there is a change in the message UI state, or when table data
                  // comes in. Even though the grid doesn't use these props, we pass them in to
                  // trigger a rerender if they have changed.
                  //
                  // @TODO consider making MessageContainer a connected component which pulls
                  // these properties in directly. This could have an unpredictable effect on
                  // performance, so be sure to test.
                  uiUpdate: this.props.messagesUi,
                  tableUpdate: this.props.messagesTableData,
                };
                const { scrollToRow, scrollToAlignment } = getScrollState();
                if (scrollToRow !== false) {
                  gridProps.scrollToRow = scrollToRow;
                  gridProps.scrollToAlignment = scrollToAlignment || "auto";
                }
                return createElement(Grid, gridProps);
              }
            );
          }
        );
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
