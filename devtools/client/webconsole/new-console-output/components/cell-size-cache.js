module.exports = class CellSizeCache {
  constructor() {
    this._cachedRowHeights = {};
    this._indexToIdMap = {};
  }

  clearAllRowHeights() {
    this._cachedRowHeights = {};
    this._indexToIdMap = {};
  }

  clearRowHeight(index) {
    const id = this.getIdFromIndex(index);
    delete this._cachedRowHeights[id];
    delete this._indexToIdMap[index];
  }

  getRowHeight(index) {
    return this.hasRowHeight(index) ? this._cachedRowHeights[this.getIdFromIndex(index)] : 20;
  }

  getRowHeightById(id) {
    return this.hasRowHeightById(id) ? this._cachedRowHeights[id] : 20;
  }

  hasRowHeight(index) {
    return !!this._cachedRowHeights[this.getIdFromIndex(index)];
  }

  hasRowHeightById(id) {
    return !!this._cachedRowHeights[this.getIdFromIndex(id)];
  }

  setRowHeight(id, index, height) {
    this._indexToIdMap[index] = id;
    this._cachedRowHeights[id] = height;
  }

  getIdFromIndex(index) {
    return this._indexToIdMap[index];
  }

  getIndexFromId(id) {
    return this._indexToIdMap.indexOf(id);
  }
};
