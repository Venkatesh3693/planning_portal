
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
    parsedStore.scheduledProcesses.forEach((p: ScheduledProcess) => {
      p.startDateTime = new Date(p.startDateTime);
      p.endDateTime = new Date(p.endDateTime);
    });
    return parsedStore;
  } catch (err) {
    console.error("Could not load state from localStorage", err);
    return defaultStore;
  }
};

const setStore = (store: Store) => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const serializedState = JSON.stringify(store);
        localStorage.setItem('stitchplan_store', serializedState);
    } catch (err) {
        console.error("Could not save state to localStorage", err);
    }
}


export const setScheduledProcesses = (updater: (prev: ScheduledProcess[]) => ScheduledProcess[]) => {
  const currentStore = getStore();
  const newProcesses = updater(currentStore.scheduledProcesses);
  setStore({ ...currentStore, scheduledProcesses: newProcesses });
};

export const getScheduledProcesses = () => {
    return getStore().scheduledProcesses;
};

export const setOrders = (updater: (prev: Order[]) => Order[]) => {
    const currentStore = getStore();
    const newOrders = updater(currentStore.orders);
    setStore({ ...currentStore, orders: newOrders });
};

export const getOrders = () => {
    return getStore().orders;
}
