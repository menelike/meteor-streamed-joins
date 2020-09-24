import ChangeStreamDeMultiplexer from './ChangeStreamDeMultiplexer';

const ChangeStreamRegistry = new ChangeStreamDeMultiplexer();

export default ChangeStreamRegistry;
