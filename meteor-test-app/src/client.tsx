import { Meteor } from 'meteor/meteor';

import Threads from './collections/Threads';

console.log('Meteor client');

Meteor.subscribe('threads');

Threads.find({}).observe({
  added(document) {
    console.debug('added', document);
  },
  changed(newDocument, oldDocument) {
    console.debug('changed', newDocument, oldDocument);
  },
  removed(oldDocument) {
    console.debug('removed', oldDocument);
  },
});

Meteor.users.find({}).observe({
  added(document) {
    console.log('added', document);
  },
  changed(newDocument, oldDocument) {
    console.log('changed', newDocument, oldDocument);
  },
  removed(oldDocument) {
    console.log('removed', oldDocument);
  },
});
