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

  private assembleKey = (id: string, sourceId: string): string => {
    return `${id}:${sourceId}`;
  };

  private disAssembleKey = (key: string): [string, string] => {
    const s = key.split(':');
    /* istanbul ignore next */
    if (s.length !== 2) throw Error(`invalid key format: ${key}`);
    return [s[0], s[1]];
  };

  public replace(id: string, sourceId: string, to: Array<string>): void {
    const key = this.assembleKey(id, sourceId);

    const added = to.filter(
      (foreignKey) => !this.sourceToDrain[key]?.has(foreignKey)
    );
    this.add(id, sourceId, added);

    const removed = [...(this.sourceToDrain[key]?.values() || [])].filter(
      (foreignKey) => !to.includes(foreignKey)
    );
    removed.forEach((foreignKey) => {
      this.sourceToDrain[key].delete(foreignKey);
    });
    this._remove(id, sourceId, removed);
  }

  private _remove(id: string, sourceId: string, to: Array<string>): void {
    if (!to.length) return;
    const key = this.assembleKey(id, sourceId);

    to.forEach((foreignKey) => {
      if (this.drainToSource[foreignKey].size === 1) {
        if (this.added.has(foreignKey)) {
          this.added.delete(foreignKey);
        } else {
          this.removed.add(foreignKey);
        }
        delete this.drainToSource[foreignKey];
      } else {
        this.drainToSource[foreignKey].delete(key);
      }
    });
  }

  public add(id: string, sourceId: string, to: Array<string>): void {
    if (!to.length) return;
    const key = this.assembleKey(id, sourceId);

    if (key in this.sourceToDrain) {
      to.forEach((foreignKey) => {
        this.sourceToDrain[key].add(foreignKey);
      });
    } else {
      this.sourceToDrain[key] = new Set(to);
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
        this.drainToSource[foreignKey].add(key);
      } else {
        this.drainToSource[foreignKey] = new Set([key]);
      }
    });
  }

  public remove(id: string, sourceId: string): void {
    const key = this.assembleKey(id, sourceId);
    this._remove(id, sourceId, [...this.sourceToDrain[key]]);
    delete this.sourceToDrain[key];
  }

  public isPrimaryForForeignKey(id: string, foreignKey: string): boolean {
    if (!(foreignKey in this.drainToSource)) return false;
    const firstKey = [...this.drainToSource[foreignKey]][0];
    const [_id] = this.disAssembleKey(firstKey);

    return _id === id;
  }

  public hasForeignKey(id: string, foreignKey: string): boolean {
    return (
      foreignKey in this.drainToSource &&
      [...this.drainToSource[foreignKey]].some((key) => {
        const [_id] = this.disAssembleKey(key);
        return _id === id;
      })
    );
  }

  public clear(): void {
    this.added.clear();
    this.removed.clear();
  }
}

export default ForeignKeyRegistry;
