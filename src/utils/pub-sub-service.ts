import { defineEnum } from "./enums";

type PubSubEvent = defineEnum<typeof PubSubEvent>;
export const PubSubEvent = defineEnum({
  GAME_START: 0,
  GAME_END: 1,
  MUTE_MUSIC: 2,
  UNMUTE_MUSIC: 3,
  CLOSE_DIALOG: 4,
  STAR_COLLECT: 5,
});

type EventDataTypes = {
  [PubSubEvent.GAME_START]: undefined;
  [PubSubEvent.GAME_END]: { isWon: boolean };
  [PubSubEvent.MUTE_MUSIC]: undefined;
  [PubSubEvent.UNMUTE_MUSIC]: undefined;
  [PubSubEvent.CLOSE_DIALOG]: boolean;
  [PubSubEvent.STAR_COLLECT]: undefined;
};

type PubSubEventWithData = typeof PubSubEvent.GAME_END | typeof PubSubEvent.CLOSE_DIALOG;

type Callback<Event extends PubSubEvent> = (data: EventDataTypes[Event]) => void;

/**
 * A service that allows components to subscribe to events and publish events.
 */
export class PubSubService {
  _subscriptions: {
    [event in PubSubEvent]?: Callback<event>[];
  } = {};

  /**
   * Subscribes to an event.
   */
  subscribe<Event extends PubSubEvent>(event: Event, callback: Callback<Event>) {
    if (!this._subscriptions[event]) {
      this._subscriptions[event] = [];
    }

    this._subscriptions[event].push(callback);
  }

  /**
   * Unsubscribes from an event.
   */
  unsubscribe<Event extends PubSubEvent>(event: Event, callback: Callback<Event>) {
    if (!this._subscriptions[event]) {
      return;
    }

    const index = this._subscriptions[event].indexOf(callback);
    if (index >= 0) {
      this._subscriptions[event].splice(index, 1);
    }
  }

  /**
   * Publishes an event.
   */
  publish<Event extends Exclude<PubSubEvent, PubSubEventWithData>>(event: Event): void;
  publish<Event extends PubSubEventWithData>(event: Event, data: EventDataTypes[Event]): void;
  publish<Event extends PubSubEvent>(event: Event, data?: EventDataTypes[Event]): void {
    if (!this._subscriptions[event]) {
      return;
    }

    this._subscriptions[event].forEach((cb) => cb(data as EventDataTypes[Event]));
  }
}

export const pubSubService = new PubSubService();
