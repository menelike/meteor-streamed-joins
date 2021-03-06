import type { LinkChild } from './LinkChild';
import type { LinkChildSelector } from './LinkChildSelector';
import type { MongoDoc, StringOrObjectID } from './types';

class ChildDeMultiplexer<P extends MongoDoc = MongoDoc> {
  private readonly children: Set<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LinkChild<P, any> | LinkChildSelector<P, any>
  > = new Set();

  public link = <T extends MongoDoc = MongoDoc>(
    linkChild: LinkChild<P, T> | LinkChildSelector<P, T>
  ): void => {
    this.children.add(linkChild);
  };

  public parentAdded = (parentId: StringOrObjectID, parentDoc: P): void => {
    this.children.forEach((child) => {
      child.parentAdded(parentId, parentDoc);
    });
  };

  public parentChanged = (_id: StringOrObjectID, doc: P): void => {
    this.children.forEach((child) => {
      child.parentChanged(_id, doc);
    });
  };

  public parentRemoved = (parentId: StringOrObjectID): void => {
    this.children.forEach((child) => {
      child.parentRemoved(parentId);
    });
  };

  public commit = (): void => {
    this.children.forEach((child) => {
      child.commit();
    });
    this.children.forEach((child) => {
      child.flush();
    });
  };

  public observe = (): void => {
    this.children.forEach((child) => {
      child.observe();
    });
  };

  public stop = async (): Promise<void> => {
    await Promise.all([...this.children].map((child) => child.stop()));
  };
}

export default ChildDeMultiplexer;
