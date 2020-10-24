import type { Mongo } from 'meteor/mongo';

import type { LinkChild } from '../LinkChild';
import type { LinkChildSelector } from '../LinkChildSelector';
import PublicationContext from '../PublicationContext';
import type {
  MeteorPublicationContext,
  PublicationContextOptions,
} from '../PublicationContext';
import type { MongoDoc } from '../types';

import type { ChildBase } from './ChildBase';
import { LinkCommon } from './LinkCommon';
import type { LinkCommonOptions } from './LinkCommon';

export type RootBaseOptions = {
  fields: LinkCommonOptions['fields'];
  skipPublication: PublicationContextOptions['skipPublication'];
};

export class RootBase<T extends MongoDoc = MongoDoc> extends LinkCommon<T> {
  public readonly nodes: Set<
    | RootBase<T>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ChildBase<any, any>
  >;

  public readonly publicationContext: PublicationContext<T>;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    options?: RootBaseOptions | undefined
  ) {
    super(context, collection, { fields: options?.fields });
    this.publicationContext = new PublicationContext(
      context,
      this.collectionName,
      {
        skipPublication: options?.skipPublication,
      }
    );
    this.nodes = new Set([this]);
  }

  /** @internal */
  public setNode = (
    child: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | LinkChild<any, any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | LinkChildSelector<any, any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | ChildBase<any, any>
  ): void => {
    this.nodes.add(child);
  };

  /** @internal */
  public getNode = (
    collectionName: string
  ):
    | RootBase<T>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ChildBase<any, any>
    | undefined => {
    return [...this.nodes].find(
      (child) => child.publicationContext.collectionName === collectionName
    );
  };

  /** @internal */
  public root = (): RootBase<T> => {
    return this;
  };
}
