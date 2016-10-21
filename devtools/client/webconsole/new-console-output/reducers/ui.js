/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {
  FILTER_BAR_TOGGLE,
  FILTER_TOGGLE,
  FILTER_TEXT_SET,
  FILTERS_CLEAR,
  MESSAGES_CLEAR,
} = require("devtools/client/webconsole/new-console-output/constants");
const cellSizeCache = new (require("devtools/client/webconsole/new-console-output/components/cell-size-cache"))();
const Immutable = require("devtools/client/shared/vendor/immutable");

const UiState = Immutable.Record({
  cellSizeCache,
  filterBarVisible: false,
  filteredMessageVisible: false,
});

function ui(state = new UiState(), action) {
  switch (action.type) {
    case FILTER_BAR_TOGGLE:
      return state.set("filterBarVisible", !state.filterBarVisible);
    case FILTER_TOGGLE:
    case FILTER_TEXT_SET:
    case FILTERS_CLEAR:
    case MESSAGES_CLEAR:
      // This is a side effect. Reducers should not have side effects. However, this is
      // currently the only easy+clear way to ensure that stale row heights aren't used in
      // React Virtualized.
      // @TODO see if this can be rewritten to follow best practices. However, it may not
      // be worth the effort, especially if React Fiber progresses well.
      state.cellSizeCache.clearAllRowHeights();
  }

  return state;
}

module.exports = {
  UiState,
  ui,
};
