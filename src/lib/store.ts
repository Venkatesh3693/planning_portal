
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
    // Important: Revive date objects from their string representations
    if (parsedStore.scheduledProcesses) {
      parsedStore.scheduledProcesses.forEach((p: ScheduledProcess) => {
        p.startDateTime = new Date(p.startDateTime);
        p.endDateTime = new Date(p.endDateTime);
      });
    }
    return { ...defaultStore, ...parsedStore };
  } catch (err) {
    console.error("Could not load state from localStorage", err);
    return defaultStore;
  }
};

const setStore = (store: Partial<Store>) => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const currentStore = getStore();
        const newStore = { ...currentStore, ...store };
        const serializedState = JSON.stringify(newStore);
        localStorage.setItem('stitchplan_store', serializedState);
    } catch (err) {
        console.error("Could not save state to localStorage", err);
    }
}


export const setScheduledProcesses = (updater: (prev: ScheduledProcess[]) => ScheduledProcess[]) => {
  const currentStore = getStore();
  const newProcesses = updater(currentStore.scheduledProcesses);
  setStore({ scheduledProcesses: newProcesses });
};

export const getScheduledProcesses = (): ScheduledProcess[] => {
    return getStore().scheduledProcesses;
};

export const getOrders = (): Order[] => {
    return getStore().orders;
}
