
import { Order, ScheduledProcess } from './types';
import { ORDERS } from './data';

// In a real application, this would be a proper state management solution
// like Zustand, Redux, or React Context, and likely fetched from a server.
// For this example, we'll use a simple in-memory store.

type Store = {
  orders: Order[];
  scheduledProcesses: ScheduledProcess[];
};

const store: Store = {
  orders: ORDERS,
  scheduledProcesses: [],
};

// We'll export functions to interact with the store,
// mimicking a state management library's interface.

export const getStore = () => {
  return { ...store };
};

export const setScheduledProcesses = (processes: ScheduledProcess[] | ((prev: ScheduledProcess[]) => ScheduledProcess[])) => {
  if (typeof processes === 'function') {
    store.scheduledProcesses = processes(store.scheduledProcesses);
  } else {
    store.scheduledProcesses = processes;
  }
  // In a real app, you would notify subscribers of the change here.
};

export const getScheduledProcesses = () => {
    return store.scheduledProcesses;
};

export const setOrders = (orders: Order[] | ((prev: Order[]) => Order[])) => {
    if (typeof orders === 'function') {
        store.orders = orders(store.orders);
    } else {
        store.orders = orders;
    }
};

export const getOrders = () => {
    return store.orders;
}
