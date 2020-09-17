import type { Meteor } from 'meteor/meteor';

import ForeignKeyRegistry from './ForeignKeyRegistry';
import { MongoDoc, WithoutId } from './types';

export interface MeteorPublicationContext<T extends MongoDoc = MongoDoc> {
  added(collection: string, id: string, doc: Partial<WithoutId<T>>): void;
  changed(collection: string, id: string, fields: Partial<WithoutId<T>>): void;
  connection: Meteor.Connection;
  error(error: Error): void;
  onStop(func: () => void): void;
  ready(): void;
  removed(collection: string, id: string): void;
  stop(): void;
  userId: string | undefined;
}

export type PublicationContextOptions = {
  skipPublication?: boolean;
  foreignKeyRegistry?: ForeignKeyRegistry;
};

class PublicationContext<T extends MongoDoc = MongoDoc> {
  public readonly foreignKeyRegistry: ForeignKeyRegistry;

  public readonly id: string;

  public readonly collectionName: string;

  private readonly context: MeteorPublicationContext<T>;

  private readonly skipPublication: boolean | undefined;

  constructor(
    context: MeteorPublicationContext<T>,
    collectionName: string,
    options?: PublicationContextOptions
  ) {
    this.foreignKeyRegistry =
      options?.foreignKeyRegistry || new ForeignKeyRegistry();
    this.context = context;
    this.id = Math.random().toString();
    this.collectionName = collectionName;
    this.skipPublication = options?.skipPublication;
  }

  public added = (foreignKey: string, doc: Partial<WithoutId<T>>): void => {
    if (!this.addedChildrenIds.has(foreignKey)) return;
    this.commitAdded(foreignKey);
    if (this.skipPublication) return;
    this.context.added(this.collectionName, foreignKey, doc);
  };

  public changed = (
    foreignKey: string,
    fields: Partial<WithoutId<T>>
  ): void => {
    if (Object.keys(fields).length === 0) return;
    if (!this.isPrimaryForChildId(foreignKey)) return;
    if (this.skipPublication) return;
    this.context.changed(this.collectionName, foreignKey, fields);
  };

  public replaced = (foreignKey: string, doc: Partial<WithoutId<T>>): void => {
    if (!this.isPrimaryForChildId(foreignKey)) return;
    if (this.skipPublication) return;
    // Todo request/implement replace in meteor publication
    this.context.removed(this.collectionName, foreignKey);
    this.context.added(this.collectionName, foreignKey, doc);
  };

  public removed = (foreignKey: string): void => {
    if (!this.removedChildrenIds.has(foreignKey)) return;
    this.commitRemoved(foreignKey);
    if (this.skipPublication) return;
    this.context.removed(this.collectionName, foreignKey);
  };

  public hasChildId(foreignKey: string): boolean {
    return this.foreignKeyRegistry.hasChildId(this.id, foreignKey);
  }

  public isPrimaryForChildId(foreignKey: string): boolean {
    return this.foreignKeyRegistry.isPrimaryForChildId(this.id, foreignKey);
  }

  public addToRegistry(sourceId: string, foreignKeys: Array<string>): void {
    this.foreignKeyRegistry.add(this.id, sourceId, foreignKeys);
  }

  public replaceFromRegistry(
    sourceId: string,
    foreignKeys: Array<string>
  ): void {
    this.foreignKeyRegistry.replace(this.id, sourceId, foreignKeys);
  }

  public removeFromRegistry(sourceId: string): void {
    this.foreignKeyRegistry.remove(this.id, sourceId);
  }

  public get addedChildrenIds(): Set<string> {
    return this.foreignKeyRegistry.added;
  }

  public get removedChildrenIds(): Set<string> {
    return this.foreignKeyRegistry.removed;
  }

  private commitAdded(foreignKey: string): void {
    this.foreignKeyRegistry.commitAdded(foreignKey);
  }

  private commitRemoved(foreignKey: string): void {
    this.foreignKeyRegistry.commitRemoved(foreignKey);
  }
}

export default PublicationContext;
