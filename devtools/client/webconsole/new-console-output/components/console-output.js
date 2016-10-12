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
const {
  Cell,
  Column,
  Table
} = require("devtools/client/shared/vendor/fixed-data-table");
const { connect } = require("devtools/client/shared/vendor/react-redux");

const {
  getAllMessages,
  getAllMessagesUiById,
  getAllMessagesTableDataById,
  getAllGroupsById,
} = require("devtools/client/webconsole/new-console-output/selectors/messages");
const { getScrollSetting } = require("devtools/client/webconsole/new-console-output/selectors/ui");
const MessageContainer = createFactory(require("devtools/client/webconsole/new-console-output/components/message-container").MessageContainer);

const ConsoleOutput = createClass({

  displayName: "ConsoleOutput",

  propTypes: {
    messages: PropTypes.object.isRequired,
    messagesUi: PropTypes.object.isRequired,
    serviceContainer: PropTypes.shape({
      attachRefToHud: PropTypes.func.isRequired,
    }),
    autoscroll: PropTypes.bool.isRequired,
  },

  componentDidMount() {
    scrollToBottom(this.outputNode);
    this.props.serviceContainer.attachRefToHud("outputWrapper", this.outputNode);
  },

  componentWillUpdate(nextProps, nextState) {
    if (!this.outputNode) {
      return;
    }

    const outputNode = this.outputNode;

    // Figure out if we are at the bottom. If so, then any new message should be scrolled
    // into view.
    if (this.props.autoscroll && outputNode.lastChild) {
      this.shouldScrollBottom = isScrolledToBottom(outputNode.lastChild, outputNode);
    }
  },

  componentDidUpdate() {
    if (this.shouldScrollBottom) {
      scrollToBottom(this.outputNode);
    }
  },

  _getRow(index) {
    let {
      dispatch,
      autoscroll,
      messages,
      messagesUi,
      messagesTableData,
      serviceContainer,
      groups,
    } = this.props;

    const message = messages.get(index);

    const parentGroups = message.groupId ? (
      (groups.get(message.groupId) || [])
        .concat([message.groupId])
    ) : [];

    return (
      MessageContainer({
        dispatch,
        message,
        key: message.id,
        serviceContainer,
        open: messagesUi.includes(message.id),
        tableData: messagesTableData.get(message.id),
        autoscroll,
        indent: parentGroups.length,
      })
    );
  },

  render() {
    let { messages } = this.props;
    return (
      dom.div({
        className: "webconsole-output",
        ref: node => {
          this.outputNode = node;
        },
      },
        createElement(Table,
          {
            width: 1200,
            maxHeight: 200,
            rowsCount: messages.size,
            rowHeight: 50,
            scrollToRow: messages.size - 1,
          },
          createElement(Column,
            {
              cell: (props) => {
                return createElement(Cell, {}, this._getRow(props.rowIndex));
              },
              width: 1200,
            },
            null
          )
        )
      )
    );
  }
});

function scrollToBottom(node) {
  node.scrollTop = node.scrollHeight;
}

function isScrolledToBottom(outputNode, scrollNode) {
  let lastNodeHeight = outputNode.lastChild ?
                       outputNode.lastChild.clientHeight : 0;
  return scrollNode.scrollTop + scrollNode.clientHeight >=
         scrollNode.scrollHeight - lastNodeHeight / 2;
}

function mapStateToProps(state, props) {
  return {
    messages: getAllMessages(state),
    messagesUi: getAllMessagesUiById(state),
    messagesTableData: getAllMessagesTableDataById(state),
    autoscroll: getScrollSetting(state),
    groups: getAllGroupsById(state),
  };
}

module.exports = connect(mapStateToProps)(ConsoleOutput);
