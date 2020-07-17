class ForeignKeyRegistry {
  sourceToDrain: Record<string, Set<string>>;

  drainToSource: Record<string, Set<string>>;

  added: Set<string>;

  removed: Set<string>;

  constructor() {
    this.sourceToDrain = {};
    this.drainToSource = {};
    this.added = new Set();
    this.removed = new Set();
  }

  replace(from: string, to: Array<string>): void {
    const added = to.filter(
      (foreignKey) => !this.sourceToDrain[from].has(foreignKey)
    );
    this.add(from, added);

    const removed = [...this.sourceToDrain[from].values()].filter(
      (foreignKey) => !to.includes(foreignKey)
    );
    removed.forEach((foreignKey) => {
      this.sourceToDrain[from].delete(foreignKey);
    });
    this._remove(from, removed);
  }

  private _remove(from: string, to: Array<string>): void {
    if (!to.length) return;

    to.forEach((foreignKey) => {
      if (this.drainToSource[foreignKey].size === 1) {
        this.added.delete(foreignKey);
        this.removed.add(foreignKey);
        delete this.drainToSource[foreignKey];
      } else {
        this.drainToSource[foreignKey].delete(foreignKey);
      }
    });
  }

  add(from: string, to: Array<string>): void {
    if (!to.length) return;

    if (from in this.sourceToDrain) {
      to.forEach((foreignKey) => {
        this.sourceToDrain[from].add(foreignKey);
      });
    } else {
      this.sourceToDrain[from] = new Set(to);
    }

    to.forEach((foreignKey) => {
      if (!(foreignKey in this.drainToSource)) {
        this.removed.delete(foreignKey);
        this.added.add(foreignKey);
      }

      if (foreignKey in this.drainToSource) {
        this.drainToSource[foreignKey].add(foreignKey);
      } else {
        this.drainToSource[foreignKey] = new Set([from]);
      }
    });
  }

  remove(from: string): void {
    this._remove(from, [...this.sourceToDrain[from].values()]);
    delete this.sourceToDrain[from];
  }

  hasForeignKey(foreignKey: string): boolean {
    return foreignKey in this.drainToSource;
  }

  clear(): void {
    this.added.clear();
    this.removed.clear();
  }
}

export default ForeignKeyRegistry;
