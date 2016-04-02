/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Immutable = require("devtools/client/shared/vendor/immutable");

const constants = require("devtools/client/webconsole/new-console-output/constants");

function messages(state = [], action) {
  switch (action.type) {
    case constants.MESSAGE_ADD:
      let newMessage = action.message;
      if (newMessage.allowRepeating) {
        newMessage.repeatId = getRepeatId(newMessage);
        console.log(newMessage.repeatId)
        if (state.length > 0) {
          let lastMessage = state[state.length - 1];

          // If the incoming message and the last message printed have the same
          // repeatId, that means the last message printed needs to be updated.
          // Because this is immutable, we need to clone the array and the last
          // printed message.
          if (lastMessage.repeatId === newMessage.repeatId) {
            let repeats = lastMessage.repeats ? lastMessage.repeats + 1 : 2;
            let newLast = Object.assign({}, state[state.length - 1], { repeats });
            return state.slice(0, state.length-1).concat(newLast);
          }
        }
      }
      return state.concat([ newMessage ]);
    case constants.MESSAGES_CLEAR:
      return [];
  }

  return state;
}

function getRepeatId(message) {
  let clonedMessage = JSON.parse(JSON.stringify(message));
  delete clonedMessage.data.timeStamp;
  delete clonedMessage.data.uniqueID;
  delete clonedMessage.repeatId;
  return JSON.stringify(clonedMessage);
}

exports.messages = messages;
// Export so it can be unit tested.
exports.getRepeatId = getRepeatId;
