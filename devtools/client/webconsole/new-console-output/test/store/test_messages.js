/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const actions = require("devtools/client/webconsole/new-console-output/actions/messages");
const packet = testPackets.get("console.log");

function run_test() {
  run_next_test();
}

add_task(function*() {
  const { getState, dispatch } = storeFactory();

  dispatch(actions.messageAdd(packet));
  const expectedPacket = Object.assign({}, packet);
  deepEqual(getState().messages, [expectedPacket],
    "MESSAGE_ADD action adds a message");
});

add_task(function*() {
  const { getRepeatId } = require("devtools/client/webconsole/new-console-output/reducers/messages");

  const clonedPacket = Object.assign({}, packet);
  equal(getRepeatId(packet), getRepeatId(clonedPacket),
    "getRepeatId() returns same repeat id for objects with the same values");

  const modifiedPacket = Object.assign({}, packet, { "from": "other actor" });
  notEqual(getRepeatId(packet), getRepeatId(modifiedPacket),
    "getRepeatId() returns different repeat ids for different values");
});
