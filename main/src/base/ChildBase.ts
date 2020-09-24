import type { Mongo } from 'meteor/mongo';

import type { MeteorPublicationContext } from '../PublicationContext';
import PublicationContext from '../PublicationContext';
import type { MongoDoc } from '../types';

import { LinkCommon } from './LinkCommon';
import type { LinkCommonOptions } from './LinkCommon';
import type { RootBase } from './RootBase';

export type ChildBaseOptions = {
  fields: LinkCommonOptions['fields'];
  skipPublication: boolean;
};

export class ChildBase<
  P extends MongoDoc = MongoDoc,
  T extends MongoDoc = MongoDoc
> extends LinkCommon<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly parent: RootBase<P> | ChildBase<any, any>;

  public readonly publicationContext: PublicationContext<T>;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parent: RootBase<P> | ChildBase<any, any>,
    options?: ChildBaseOptions | undefined
  ) {
    super(context, collection, { fields: options?.fields });
    this.parent = parent;

    const { collectionName } = collection.rawCollection();
    const existingForeignKeyRegistry = this.root().getNode(collectionName);
    this.publicationContext = new PublicationContext(
      context,
      collection.rawCollection().collectionName,
      {
        foreignKeyRegistry:
          existingForeignKeyRegistry?.publicationContext.foreignKeyRegistry,
        skipPublication: options?.skipPublication,
      }
    );
    this.root().setNode(this);
  }

  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public root = (): RootBase<any> => {
    return this.parent.root();
  };
}