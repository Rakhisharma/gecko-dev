/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Check that basic keyboard shortcuts work in the web console.

"use strict";

const TEST_URI =
  `data:text/html;charset=utf-8,<p>Test keyboard accessibility</p>
  <script>
    for (let i = 1; i <= 99; i++) {
      console.log("console message " + i);
    }
  </script>
  `;

add_task(function* () {
  let hud = yield openNewTabAndConsole(TEST_URI);
  info("Web Console opened");

  yield waitFor(() => findMessage(hud, "console message 99"));
  ok(!findMessage(hud, "console message 1"), "output is scrolled to bottom");

  EventUtils.sendMouseEvent({type: "click"}, hud.jsterm.inputNode);

  // Page up.
  EventUtils.synthesizeKey("VK_PAGE_UP", {});
  ok(!findMessage(hud, "console message 99"), "scroll position changed after page up");

  // Page down.
  EventUtils.synthesizeKey("VK_PAGE_DOWN", {});
  ok(findMessage(hud, "console message 99"), "scroll position changed after page down");

  // Home
  EventUtils.synthesizeKey("VK_HOME", {});
  ok(findMessage(hud, "console message 1"), "scroll position at top after home");

  // End
  EventUtils.synthesizeKey("VK_END", {});
  ok(findMessage(hud, "console message 99"), "scroll position at bottom after end");

  // Clear output
  info("try ctrl-l to clear output");
  let clearShortcut;
  if (Services.appinfo.OS === "Darwin") {
    clearShortcut = WCUL10n.getStr("webconsole.clear.keyOSX");
  } else {
    clearShortcut = WCUL10n.getStr("webconsole.clear.key");
  }
  synthesizeKeyShortcut(clearShortcut);
  yield waitFor(() => findMessages(hud, "").length == 0);
  is(hud.jsterm.inputNode.getAttribute("focused"), "true", "jsterm input is focused");

  // Focus filter
  info("try ctrl-f to focus filter");
  synthesizeKeyShortcut(WCUL10n.getStr("webconsole.find.key"));
  ok(!hud.jsterm.inputNode.getAttribute("focused"), "jsterm input is not focused");
  is(hud.ui.filterBox, hud.jsterm.inputNode.ownerDocument.activeElement,
    "filter input is focused");
});
