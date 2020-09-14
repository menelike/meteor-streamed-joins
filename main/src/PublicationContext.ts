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

class PublicationContext<T extends MongoDoc = MongoDoc> {
  public readonly foreignKeyRegistry: ForeignKeyRegistry;

  public readonly id: string;

  public readonly collectionName: string;

  private readonly context: MeteorPublicationContext<T>;

  constructor(
    context: MeteorPublicationContext<T>,
    collectionName: string,
    foreignKeyRegistry?: ForeignKeyRegistry
  ) {
    this.foreignKeyRegistry = foreignKeyRegistry || new ForeignKeyRegistry();
    this.context = context;
    this.id = Math.random().toString();
    this.collectionName = collectionName;
  }

  public added = (foreignKey: string, doc: Partial<WithoutId<T>>): void => {
    if (!this.addedForeignKeys.has(foreignKey)) return;
    this.context.added(this.collectionName, foreignKey, doc);
  };

  public changed = (
    foreignKey: string,
    fields: Partial<WithoutId<T>>
  ): void => {
    if (Object.keys(fields).length === 0) return;
    if (!this.foreignKeyRegistry.isPrimaryForForeignKey(this.id, foreignKey))
      return;
    this.context.changed(this.collectionName, foreignKey, fields);
  };

  public replaced = (foreignKey: string, doc: Partial<WithoutId<T>>): void => {
    if (!this.foreignKeyRegistry.isPrimaryForForeignKey(this.id, foreignKey))
      return;
    // Todo request/implement replace in meteor publication
    this.context.removed(this.collectionName, foreignKey);
    this.context.added(this.collectionName, foreignKey, doc);
  };

  public removed = (foreignKey: string): void => {
    if (!this.removedForeignKeys.has(foreignKey)) return;
    this.context.removed(this.collectionName, foreignKey);
  };

  public hasForeignKey(foreignKey: string): boolean {
    return this.foreignKeyRegistry.hasForeignKey(this.id, foreignKey);
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

  public get addedForeignKeys(): Set<string> {
    return this.foreignKeyRegistry.added;
  }

  public get removedForeignKeys(): Set<string> {
    return this.foreignKeyRegistry.removed;
  }

  public clear(): void {
    return this.foreignKeyRegistry.clear();
  }
}

export default PublicationContext;
