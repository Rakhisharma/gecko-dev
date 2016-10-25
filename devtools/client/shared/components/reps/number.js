/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Make this available to both AMD and CJS environments
define(function (require, exports, module) {
  // Dependencies
  const React = require("devtools/client/shared/vendor/react");

  // Shortcuts
  const { span } = React.DOM;

  /**
   * Renders a number
   */
  function Number(props) {
    let value = props.object;

    return (
      span({className: "objectBox objectBox-number"},
        stringify(value)
      )
    );
  }

  function stringify(object) {
    let isNegativeZero = Object.is(object, -0) ||
      (object.type && object.type == "-0");

    return (isNegativeZero ? "-0" : String(object));
  }

  function supportsObject(object, type) {
    return ["boolean", "number", "-0"].includes(type);
  }

  // Exports from this module

  exports.Number = {
    rep: Number,
    supportsObject: supportsObject
  };
});
