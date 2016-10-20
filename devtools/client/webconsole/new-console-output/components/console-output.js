/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {
  createClass,
  createElement,
  createFactory,
  DOM: dom,
  findDOMNode,
  PropTypes
} = require("devtools/client/shared/vendor/react");
const {
  AutoSizer,
  Grid,
} = require("devtools/client/shared/vendor/react-virtualized");
const CellMeasurer = require("devtools/client/webconsole/new-console-output/components/cell-measurer");
const cellSizeCache = new (require("devtools/client/webconsole/new-console-output/components/cell-size-cache"))();
const { connect } = require("devtools/client/shared/vendor/react-redux");

const {
  getAllMessages,
  getAllMessagesUiById,
  getAllMessagesTableDataById,
  getAllGroupsById,
  getLastForceScrollMessageIndex,
} = require("devtools/client/webconsole/new-console-output/selectors/messages");
const MessageContainer = createFactory(require("devtools/client/webconsole/new-console-output/components/message-container").MessageContainer);

const ConsoleOutput = createClass({

  displayName: "ConsoleOutput",

  propTypes: {
    messages: PropTypes.object.isRequired,
    messagesUi: PropTypes.object.isRequired,
    serviceContainer: PropTypes.shape({
      attachRefToHud: PropTypes.func.isRequired,
    }),
    autoscrollToRow: PropTypes.number,
  },

  componentDidMount() {
    this._largestRowIndex = 0;
  },

  componentWillUpdate(nextProps, nextState) {
    this.scrollToRow = false;
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
  },

  _onResize() {
    cellSizeCache.clearAllRowHeights();
    this.changedHeights = true;
    this.forceUpdate();
  },

  _onSectionRendered({ rowStopIndex }) {
    this.stopScrolling = false;
    if (rowStopIndex > this._largestRowIndex) {
      this._largestRowIndex = rowStopIndex;
    } else if (rowStopIndex < this._largestRowIndex) {
      this.stopScrolling = true;
    }
  },

  _updateRowHeight(id, index, height) {
    if (!cellSizeCache.hasRowHeightById(id)
      || cellSizeCache.getRowHeightById(id) !== height) {
      cellSizeCache.setRowHeight(id, index, height);
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
    });
  },

  _prepareChildren() {
    const { messages } = this.props;
    return createElement(AutoSizer,
      {
        onResize: this._onResize
      },
      ({ height, width }) => {
        console.log("width", width);
        return createElement(CellMeasurer,
          {
            cellRenderer: this._rowRenderer,
            columnCount: 1,
            width,
            rowCount: messages.size,
            container: this.outputNode ? this.outputNode : document.firstElementChild,
            cellSizeCache,
          },
          ({ getRowHeight }) => {
            let gridProps = {
              columnCount: 1,
              columnWidth: width,
              height,
              overscanColumnCount: 0,
              overscanRowCount: 5,
              cellRenderer: this._rowRenderer,
              rowCount: messages.size,
              rowHeight: getRowHeight,
              width,
              onScroll: () => {},
              ref: ref => {
                this.grid = ref;
              },
              onSectionRendered: this._onSectionRendered,
            };
            if (this.scrollToRow) {
              gridProps.scrollToRow = this.scrollToRow;
            }
            return createElement(Grid, gridProps);
          }
        );
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
    test: Math.random()
  };
}

module.exports = connect(mapStateToProps)(ConsoleOutput);
