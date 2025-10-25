import { TRecordedEvent, TGetEventsOptions } from './kl-event-types';

/**
 * Interface for event storage providers
 * Defines the contract for storing and retrieving recorded events
 */
export interface IEventStorageProvider {
    /**
     * Store a single event
     */
    storeEvent(event: TRecordedEvent): Promise<void>;

    /**
     * Retrieve events with optional filtering
     */
    getEvents(options?: TGetEventsOptions): Promise<TRecordedEvent[]>;

    /**
     * Clear all events for a project
     */
    clearEvents(): Promise<void>;
}

/**
 * Browser storage implementation using localStorage, keyed to a projectId
 */
export class BrowserEventStorageProvider implements IEventStorageProvider {
    private readonly projectId: string;
    private readonly storageKey: string;
    private cachedEvents: TRecordedEvent[] | null = null;

    constructor(projectId: string) {
        this.projectId = projectId;
        this.storageKey = `kl-rec-${projectId}`;
    }

    async storeEvent(event: TRecordedEvent): Promise<void> {
        try {
            const existingEvents = this.cachedEvents ?? await this.getEvents();
            existingEvents.push(event);
            await this.commit(existingEvents);
        } catch (error) {
            console.error('Failed to store event:', error);
            throw error;
        }
    }

    async getEvents(options?: TGetEventsOptions): Promise<TRecordedEvent[]> {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (!storedData) {
                return [];
            }

            let allEvents = JSON.parse(storedData) as TRecordedEvent[];
            this.cachedEvents = allEvents;

            // Apply filters if provided
            if (options) {
                if (options.fromSequence !== undefined) {
                    allEvents = allEvents.filter(event => event.sequenceNumber >= options.fromSequence!);
                }
                if (options.toSequence !== undefined) {
                    allEvents = allEvents.filter(event => event.sequenceNumber <= options.toSequence!);
                }
                if (options.includeTypes && options.includeTypes.length > 0) {
                    allEvents = allEvents.filter(event => options.includeTypes!.includes(event.type));
                }
            }

            return allEvents;
        } catch (error) {
            console.error('Failed to retrieve events:', error);
            return [];
        }
    }

    async clearEvents(): Promise<void> {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Failed to clear events:', error);
            throw error;
        }
    }

    private async commit(events: TRecordedEvent[]): Promise<void> {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(events));

            // Log storage info for debugging
            const storageSize = new Blob([JSON.stringify(events)]).size;
            console.log('Event Storage: n=', events.length, ' -> ', (storageSize / 1024).toFixed(3), 'KB');
        } catch (error) {
            console.error('Failed to save events to browser storage:', error);
            throw error;
        }
    }
}
