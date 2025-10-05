
import { Order, ScheduledProcess } from './types';
import { ORDERS } from './data';

// In a real application, this would be a proper state management solution
// like Zustand, Redux, or React Context, and likely fetched from a server.

type Store = {
  orders: Order[];
  scheduledProcesses: ScheduledProcess[];
};

const defaultStore: Store = {
  orders: ORDERS,
  scheduledProcesses: [],
};

const getStore = (): Store => {
  if (typeof window === 'undefined') {
    return defaultStore;
  }
  try {
    const serializedState = localStorage.getItem('stitchplan_store');
    if (serializedState === null) {
      return defaultStore;
    }
    const parsedStore = JSON.parse(serializedState);
    return { ...defaultStore, ...parsedStore };
  } catch (err) {
    console.error("Could not load state from localStorage", err);
    return defaultStore;
  }
};

export const getScheduledProcesses = (): ScheduledProcess[] => {
    const store = getStore();
    // Important: Revive date objects from their string representations
    if (store.scheduledProcesses) {
      store.scheduledProcesses.forEach((p: ScheduledProcess) => {
        p.startDateTime = new Date(p.startDateTime);
        p.endDateTime = new Date(p.endDateTime);
      });
    }
    return store.scheduledProcesses || [];
};
