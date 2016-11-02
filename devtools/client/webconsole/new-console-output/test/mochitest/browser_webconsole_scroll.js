/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Test webconsole scrolling.

"use strict";

const TEST_URI = `data:text/html;charset=utf-8,Test scrolling
<script>
  for (let i = 0; i < 50; i++) {
    content.console.log("top message " + i);
  }

  content.console.log(Array(50).fill("LongWrappingMessage").join("\n"));
  content.console.log(Array(50).fill("LongNonwrappingMessage").join(""));

  for (let i = 0; i < 50; i++) {
    content.console.log("bottom message " + i);
  }
</script>`;

add_task(function* () {
  let hud = yield openNewTabAndConsole(TEST_URI);

  yield waitFor(() => findMessage(hud, "bottom message 49"));
  ok(!findMessage(hud, "top message"), "scroller is filled and scroll is at the bottom");

  yield scrollToTop(hud);

  // Test force scroll.
  hud.jsterm.execute("10000+10000");
  yield waitFor(() => findMessage(hud, "20000"));
  ok(true, "Execution result forces scroll to bottom");

  // Test autoscroll.
  ContentTask.spawn(gBrowser.selectedBrowser, {}, function* () {
    content.console.log("test autoscroll");
  });
  yield waitFor(() => findMessage(hud, "test autoscroll"));
  ok(true, "A new log message autoscrolls if the user is at the bottom.");

  // Test scroll position maintenance.
  yield scrollToTop(hud);
  ContentTask.spawn(gBrowser.selectedBrowser, {}, function* () {
    content.console.log("test new log");
  });
  // We have no predicate we can use waitFor on, so wait for the new-messages event.
  waitForMessages(hud, "test new log");
  ok(!findMessage(hud, "test new log"),
    "Scroll position maintained when a user is scrolled up and new log messages come in");
});

function* scrollToTop(hud) {
  EventUtils.synthesizeKey("VK_HOME", {});
  yield waitFor(() => findMessage(hud, "top message 1"));
  info("scroll is at top");
}
