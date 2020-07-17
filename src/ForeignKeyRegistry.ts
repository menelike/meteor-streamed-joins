class ForeignKeyRegistry {
  private readonly sourceToDrain: Record<string, Set<string>>;

  private readonly drainToSource: Record<string, Set<string>>;

  public readonly added: Set<string>;

  public readonly removed: Set<string>;

  constructor() {
    this.sourceToDrain = {};
    this.drainToSource = {};
    this.added = new Set();
    this.removed = new Set();
  }

  public replace(from: string, to: Array<string>): void {
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
        if (this.added.has(foreignKey)) {
          this.added.delete(foreignKey);
        } else {
          this.removed.add(foreignKey);
        }
        delete this.drainToSource[foreignKey];
      } else {
        this.drainToSource[foreignKey].delete(foreignKey);
      }
    });
  }

  public add(from: string, to: Array<string>): void {
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
        if (this.removed.has(foreignKey)) {
          this.removed.delete(foreignKey);
        } else {
          this.added.add(foreignKey);
        }
      }

      if (foreignKey in this.drainToSource) {
        this.drainToSource[foreignKey].add(foreignKey);
      } else {
        this.drainToSource[foreignKey] = new Set([from]);
      }
    });
  }

  public remove(from: string): void {
    this._remove(from, [...this.sourceToDrain[from].values()]);
    delete this.sourceToDrain[from];
  }

  public hasForeignKey(foreignKey: string): boolean {
    return foreignKey in this.drainToSource;
  }

  public clear(): void {
    this.added.clear();
    this.removed.clear();
  }
}

export default ForeignKeyRegistry;
