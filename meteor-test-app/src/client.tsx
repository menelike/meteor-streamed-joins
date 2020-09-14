import { Meteor } from 'meteor/meteor';

import Threads from './collections/Threads';

console.log('Meteor client');

Meteor.subscribe('threads');

Threads.find({}).observe({
  added(document) {
    console.log('added thread', document);
  },
  changed(newDocument, oldDocument) {
    console.log('changed thread', newDocument, oldDocument);
  },
  removed(oldDocument) {
    console.log('removed thread', oldDocument);
  },
});

Meteor.users.find({}).observe({
  added(document) {
    console.log('added user', document);
  },
  changed(newDocument, oldDocument) {
    console.log('changed user', newDocument, oldDocument);
  },
  removed(oldDocument) {
    console.log('removed user', oldDocument);
  },
});
