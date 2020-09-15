import { Meteor } from 'meteor/meteor';

import Threads from './collections/Threads';

console.log('Meteor client');

Meteor.subscribe('threads');

// simple (and flaky) foreign key relation check
const fsck = (): void => {
  const userIds = new Set(
    Meteor.users
      .find({})
      .fetch()
      .map(({ _id }) => _id)
  );
  Threads.find({}).forEach((t) => {
    t.userIds.forEach((userId) => userIds.delete(userId));
  });

  if (userIds.size) {
    setTimeout(() => {
      const count = Meteor.users.find({ _id: { $in: [...userIds] } }).count();
      if (count) {
        console.error(
          `found ${userIds.size}/${count} userIds not linked to threads!`
        );
        console.error(userIds);
        console.error(
          Meteor.users.find({ _id: { $in: [...userIds] } }).fetch()
        );
      }
    }, 500);
  }
};

Threads.find({}).observe({
  added(document) {
    fsck();
    console.log('added thread', document);
  },
  changed(newDocument, oldDocument) {
    fsck();
    console.log('changed thread', newDocument, oldDocument);
  },
  removed(oldDocument) {
    fsck();
    console.log('removed thread', oldDocument);
  },
});

Meteor.users.find({}).observe({
  added(document) {
    fsck();
    console.log('added user', document);
  },
  changed(newDocument, oldDocument) {
    fsck();
    console.log('changed user', newDocument, oldDocument);
  },
  removed(oldDocument) {
    fsck();
    console.log('removed user', oldDocument);
  },
});
