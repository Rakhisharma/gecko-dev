/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.exports = class CellSizeCache {
  constructor() {
    this._cachedRowHeights = {};
    this._indexToIdMap = {};
    this._widestRowDimension = 0;
    this._isDirty = false;
  }

  clearAllRowHeights() {
    this._cachedRowHeights = {};
    this._indexToIdMap = {};
    this._widestRowDimension = 0;
    this._isDirty = true;
  }

  clearRowHeight(index) {
    const id = this.getIdFromIndex(index);
    delete this._cachedRowHeights[id];
    delete this._indexToIdMap[index];
    this._isDirty = true;
  }

  getRowHeight(index) {
    return this.hasRowHeight(index)
      ? this._cachedRowHeights[this.getIdFromIndex(index)]
      : 20;
  }

  getRowHeightById(id) {
    return this.hasRowHeightById(id) ? this._cachedRowHeights[id] : 20;
  }

  hasRowHeight(index) {
    return !!this._cachedRowHeights[this.getIdFromIndex(index)];
  }

  hasRowHeightById(id) {
    return !!this._cachedRowHeights[id];
  }

  setRowHeight(id, index, height) {
    this._indexToIdMap[index] = id;
    this._cachedRowHeights[id] = height;
    this._isDirty = true;
  }

  getIdFromIndex(index) {
    return this._indexToIdMap[index];
  }

  getIndexFromId(id) {
    return this._indexToIdMap.indexOf(id);
  }

  getWidestRowDimension() {
    return this._widestRowDimension;
  }

  setWidestRowDimension(width) {
    this._widestRowDimension = width;
    this._isDirty = true;
  }

  isDirty() {
    return this._isDirty;
  }

  clearIsDirty() {
    this._isDirty = false;
  }
};
