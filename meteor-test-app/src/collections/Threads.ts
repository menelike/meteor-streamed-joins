import { Mongo } from 'meteor/mongo';

export type ThreadDocument = {
  _id: string;
  title: string;
  userIds: string[];
};

const Threads = new Mongo.Collection<ThreadDocument>('threads');

export default Threads;
