class ForeignKeyRegistry {
  private readonly parentToChildren: Record<string, Set<string>>;

  private readonly childrenToParent: Record<string, Set<string>>;

  public readonly added: Set<string>;

  public readonly removed: Set<string>;

  constructor() {
    this.parentToChildren = {};
    this.childrenToParent = {};
    this.added = new Set();
    this.removed = new Set();
  }

  private assembleKey = (id: string, parentId: string): string => {
    return `${id}:${parentId}`;
  };

  private disAssembleKey = (key: string): [string, string] => {
    const s = key.split(':');
    /* istanbul ignore next */
    if (s.length !== 2) throw Error(`invalid key format: ${key}`);
    return [s[0], s[1]];
  };

  public replace(
    id: string,
    parentId: string,
    childrenIds: Array<string>
  ): void {
    const key = this.assembleKey(id, parentId);

    const added = childrenIds.filter(
      (childId) => !this.parentToChildren[key]?.has(childId)
    );
    this.add(id, parentId, added);

    const removed = [...(this.parentToChildren[key]?.values() || [])].filter(
      (childId) => !childrenIds.includes(childId)
    );
    removed.forEach((foreignKey) => {
      this.parentToChildren[key].delete(foreignKey);
    });
    this._remove(id, parentId, removed);
  }

  private _remove(
    id: string,
    parentId: string,
    childrenIds: Array<string>
  ): void {
    if (!childrenIds.length) return;
    const key = this.assembleKey(id, parentId);

    childrenIds.forEach((childId) => {
      if (this.childrenToParent[childId].size === 1) {
        if (this.added.has(childId)) {
          this.added.delete(childId);
        } else {
          this.removed.add(childId);
        }
        delete this.childrenToParent[childId];
      } else {
        this.childrenToParent[childId].delete(key);
      }
    });
  }

  public add(id: string, parentId: string, childrenIds: Array<string>): void {
    if (!childrenIds.length) return;
    const key = this.assembleKey(id, parentId);

    if (key in this.parentToChildren) {
      childrenIds.forEach((childId) => {
        this.parentToChildren[key].add(childId);
      });
    } else {
      this.parentToChildren[key] = new Set(childrenIds);
    }

    childrenIds.forEach((childId) => {
      if (!(childId in this.childrenToParent)) {
        if (this.removed.has(childId)) {
          this.removed.delete(childId);
        } else {
          this.added.add(childId);
        }
      }

      if (childId in this.childrenToParent) {
        this.childrenToParent[childId].add(key);
      } else {
        this.childrenToParent[childId] = new Set([key]);
      }
    });
  }

  public remove(id: string, parentId: string): void {
    const key = this.assembleKey(id, parentId);
    this._remove(id, parentId, [...this.parentToChildren[key]]);
    delete this.parentToChildren[key];
  }

  public isPrimaryForChildId(id: string, childId: string): boolean {
    if (!(childId in this.childrenToParent)) return false;
    const firstKey = [...this.childrenToParent[childId]][0];
    const [_id] = this.disAssembleKey(firstKey);

    return _id === id;
  }

  public hasChildId(id: string, childId: string): boolean {
    return (
      childId in this.childrenToParent &&
      [...this.childrenToParent[childId]].some((key) => {
        const [_id] = this.disAssembleKey(key);
        return _id === id;
      })
    );
  }

  public commitAdded(foreignKey: string): void {
    this.added.delete(foreignKey);
  }

  public commitRemoved(foreignKey: string): void {
    this.removed.delete(foreignKey);
  }
}

export default ForeignKeyRegistry;
