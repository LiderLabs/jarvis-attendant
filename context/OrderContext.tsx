'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OrderStatus } from '@/types';

export interface OrderItem {
  category: string;
  quantity: number;
}

export type PaymentMethod = 'cash' | 'hubtel' | 'momo' | 'pending';

export interface Order {
  id: string;
  code: string;
  customerPhone: string;
  customerName: string;
  hall: string;
  room: string;
  status: OrderStatus;
  serviceType?: string;
  bagCardNumber: string | null;
  items: OrderItem[];
  totalPrice: number | null;
  weight: number | null;
  loads: number | null;
  hasWhites?: boolean;
  washSeparately?: boolean;
  notes?: string;
  createdAt: Date;
  // Payment tracking
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid';
  paidAt?: Date;
  paidAmount?: number;
  // Staff tracking
  checkedInBy?: string;
  processedBy?: string;
  // Order type
  orderType: 'online' | 'walkin';
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Order;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  getOrderByCode: (code: string) => Order | undefined;
  getOrderByPhone: (phone: string) => Order | undefined;
  getPendingOrders: () => Order[];
  getActiveOrders: () => Order[];
  getReadyOrders: () => Order[];
  getCompletedOrders: () => Order[];
  // Revenue tracking for admin
  getTotalRevenue: () => number;
  getCashRevenue: () => number;
  getOnlineRevenue: () => number;
  getRevenueByDate: (date: Date) => { cash: number; online: number; total: number };
  getOrdersByDateRange: (startDate: Date, endDate: Date) => Order[];
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const STORAGE_KEY = 'rapidwash_orders';

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((o: any) => ({
          ...o,
          createdAt: new Date(o.createdAt),
          paidAt: o.paidAt ? new Date(o.paidAt) : undefined,
          // Ensure defaults for older orders
          paymentMethod: o.paymentMethod || 'pending',
          paymentStatus: o.paymentStatus || 'pending',
          orderType: o.orderType || 'online',
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }
  }, [orders]);

  const addOrder = (orderData: Omit<Order, 'id' | 'createdAt'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}`,
      createdAt: new Date(),
    };
    setOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updateOrder = (id: string, updates: Partial<Order>) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === id ? { ...order, ...updates } : order
      )
    );
  };

  const getOrderByCode = (code: string) => {
    return orders.find(o => o.code.toLowerCase() === code.toLowerCase());
  };

  const getOrderByPhone = (phone: string) => {
    return orders.find(o => o.customerPhone === phone);
  };

  const getPendingOrders = () => {
    return orders.filter(o => o.status === 'pending_dropoff');
  };

  const getActiveOrders = () => {
    return orders.filter(o => !['pending_dropoff', 'completed'].includes(o.status));
  };

  const getReadyOrders = () => {
    return orders.filter(o => o.status === 'ready');
  };

  const getCompletedOrders = () => {
    return orders.filter(o => o.status === 'completed');
  };

  // Revenue tracking functions
  const getTotalRevenue = () => {
    return orders
      .filter(o => o.paymentStatus === 'paid' && o.paidAmount)
      .reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  };

  const getCashRevenue = () => {
    return orders
      .filter(o => o.paymentStatus === 'paid' && o.paymentMethod === 'cash' && o.paidAmount)
      .reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  };

  const getOnlineRevenue = () => {
    return orders
      .filter(o => o.paymentStatus === 'paid' && ['hubtel', 'momo'].includes(o.paymentMethod) && o.paidAmount)
      .reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  };

  const getRevenueByDate = (date: Date) => {
    const dayOrders = orders.filter(o => {
      if (!o.paidAt || o.paymentStatus !== 'paid') return false;
      const orderDate = new Date(o.paidAt);
      return orderDate.toDateString() === date.toDateString();
    });

    const cash = dayOrders
      .filter(o => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (o.paidAmount || 0), 0);

    const online = dayOrders
      .filter(o => ['hubtel', 'momo'].includes(o.paymentMethod))
      .reduce((sum, o) => sum + (o.paidAmount || 0), 0);

    return { cash, online, total: cash + online };
  };

  const getOrdersByDateRange = (startDate: Date, endDate: Date) => {
    return orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
  };

  return (
    <OrderContext.Provider value={{
      orders,
      addOrder,
      updateOrder,
      getOrderByCode,
      getOrderByPhone,
      getPendingOrders,
      getActiveOrders,
      getReadyOrders,
      getCompletedOrders,
      getTotalRevenue,
      getCashRevenue,
      getOnlineRevenue,
      getRevenueByDate,
      getOrdersByDateRange,
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
