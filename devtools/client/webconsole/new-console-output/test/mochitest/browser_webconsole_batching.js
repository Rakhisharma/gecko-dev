/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Check adding console calls as batch keep the order of the message.

const TEST_URI = "http://example.com/browser/devtools/client/webconsole/new-console-output/test/mochitest/test-batching.html";
const { l10n } = require("devtools/client/webconsole/new-console-output/utils/messages");
const { getAllMessages } = require("devtools/client/webconsole/new-console-output/selectors/messages");

add_task(function* () {
  let hud = yield openNewTabAndConsole(TEST_URI);

  yield testBatchMessageOrder(hud);
  yield testBatchLoggingAndClear(hud);
});

function* testBatchMessageOrder(hud) {
  yield ContentTask.spawn(gBrowser.selectedBrowser, {}, () => {
    for (let i = 0; i < 10000; i++) {
      content.console.log(i);
    }
  });
  yield waitFor(() => findMessage(hud, "9999"));

  const store = hud.ui.newConsoleOutput.getStore();
  const messages = getAllMessages(store.getState());
  const values = messages.toArray().map(message => message.parameters[0]);
  ok(values.every((value, index) => value === index), "messages are in expected order");
}

function* testBatchLoggingAndClear(hud) {
  yield ContentTask.spawn(gBrowser.selectedBrowser, {}, () => {
    content.wrappedJSObject.batchLogAndClear(100);
  });
  yield waitFor(() => findMessage(hud, l10n.getStr("consoleCleared")));
  ok(true, "console cleared message is displayed");

  // Passing the text argument as an empty string will returns all the message,
  // whatever their content is.
  const messages = findMessages(hud, "");
  is(messages.length, 1, "console was cleared as expected");
}
