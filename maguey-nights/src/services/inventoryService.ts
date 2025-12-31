// Inventory management service for tickets and tables
// This handles real-time inventory tracking and updates

export interface InventoryItem {
  id: string;
  name: string;
  type: 'ticket' | 'table';
  price: number;
  totalAvailable: number;
  sold: number;
  reserved: number;
  available: number;
  maxPerOrder: number;
  eventId?: string;
  description: string;
  includes: string[];
  capacity?: number; // For tables
}

export interface InventoryUpdate {
  itemId: string;
  quantity: number;
  action: 'reserve' | 'sell' | 'release' | 'refund';
  orderId?: string;
  timestamp: string;
}

class InventoryService {
  private inventory: Map<string, InventoryItem> = new Map();
  private updateHistory: InventoryUpdate[] = [];

  constructor() {
    this.initializeInventory();
  }

  private initializeInventory() {
    // Initialize with default inventory items
    const defaultItems: InventoryItem[] = [
      {
        id: 'general-admission',
        name: 'General Admission',
        type: 'ticket',
        price: 30,
        totalAvailable: 200,
        sold: 45,
        reserved: 12,
        available: 143,
        maxPerOrder: 10,
        description: 'Entry to the event',
        includes: ['Event Access', 'Dance Floor', 'Bar Access']
      },
      {
        id: 'vip-ticket',
        name: 'VIP Ticket',
        type: 'ticket',
        price: 60,
        totalAvailable: 50,
        sold: 18,
        reserved: 5,
        available: 27,
        maxPerOrder: 6,
        description: 'Premium experience with perks',
        includes: ['VIP Area Access', 'Complimentary Drink', 'Priority Entry', 'Dance Floor']
      },
      {
        id: 'early-bird',
        name: 'Early Bird',
        type: 'ticket',
        price: 20,
        totalAvailable: 100,
        sold: 32,
        reserved: 8,
        available: 60,
        maxPerOrder: 8,
        description: 'Discounted entry before 10 PM',
        includes: ['Event Access', 'Dance Floor', 'Bar Access']
      },
      {
        id: 'standard-table',
        name: 'Standard Table',
        type: 'table',
        price: 200,
        totalAvailable: 15,
        sold: 6,
        reserved: 2,
        available: 7,
        maxPerOrder: 3,
        capacity: 4,
        description: 'Perfect for small groups',
        includes: ['Table Service', 'Bottle Service', 'VIP Area Access']
      },
      {
        id: 'premium-table',
        name: 'Premium Table',
        type: 'table',
        price: 400,
        totalAvailable: 8,
        sold: 3,
        reserved: 1,
        available: 4,
        maxPerOrder: 2,
        capacity: 6,
        description: 'Luxury experience with premium service',
        includes: ['Premium Table Service', 'Premium Bottle Service', 'VIP Area Access', 'Dedicated Server']
      },
      {
        id: 'owners-table',
        name: 'Owner\'s Table',
        type: 'table',
        price: 800,
        totalAvailable: 2,
        sold: 1,
        reserved: 0,
        available: 1,
        maxPerOrder: 1,
        capacity: 8,
        description: 'The ultimate VIP experience',
        includes: ['Exclusive Table Service', 'Premium Bottle Service', 'VIP Area Access', 'Dedicated Server', 'Complimentary Appetizers']
      }
    ];

    defaultItems.forEach(item => {
      this.inventory.set(item.id, item);
    });
  }

  // Get all inventory items
  getInventory(): InventoryItem[] {
    return Array.from(this.inventory.values());
  }

  // Get inventory for specific event
  getEventInventory(eventId: string): InventoryItem[] {
    return Array.from(this.inventory.values()).filter(item => 
      !item.eventId || item.eventId === eventId
    );
  }

  // Get specific item
  getItem(itemId: string): InventoryItem | undefined {
    return this.inventory.get(itemId);
  }

  // Check if items are available
  checkAvailability(items: {[key: string]: number}): {available: boolean, unavailable: string[]} {
    const unavailable: string[] = [];

    for (const [itemId, quantity] of Object.entries(items)) {
      const item = this.inventory.get(itemId);
      if (!item || item.available < quantity) {
        unavailable.push(itemId);
      }
    }

    return {
      available: unavailable.length === 0,
      unavailable
    };
  }

  // Reserve items (temporary hold during checkout)
  async reserveItems(items: {[key: string]: number}, orderId: string): Promise<boolean> {
    try {
      // Check availability first
      const availability = this.checkAvailability(items);
      if (!availability.available) {
        return false;
      }

      // Reserve items
      for (const [itemId, quantity] of Object.entries(items)) {
        const item = this.inventory.get(itemId);
        if (item) {
          item.reserved += quantity;
          item.available -= quantity;
          
          this.updateHistory.push({
            itemId,
            quantity,
            action: 'reserve',
            orderId,
            timestamp: new Date().toISOString()
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error reserving items:', error);
      return false;
    }
  }

  // Confirm sale (convert reserved to sold)
  async confirmSale(items: {[key: string]: number}, orderId: string): Promise<boolean> {
    try {
      for (const [itemId, quantity] of Object.entries(items)) {
        const item = this.inventory.get(itemId);
        if (item && item.reserved >= quantity) {
          item.reserved -= quantity;
          item.sold += quantity;
          
          this.updateHistory.push({
            itemId,
            quantity,
            action: 'sell',
            orderId,
            timestamp: new Date().toISOString()
          });
        } else {
          throw new Error(`Insufficient reserved quantity for item ${itemId}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error confirming sale:', error);
      return false;
    }
  }

  // Release reserved items (when checkout is cancelled)
  async releaseItems(items: {[key: string]: number}, orderId: string): Promise<boolean> {
    try {
      for (const [itemId, quantity] of Object.entries(items)) {
        const item = this.inventory.get(itemId);
        if (item && item.reserved >= quantity) {
          item.reserved -= quantity;
          item.available += quantity;
          
          this.updateHistory.push({
            itemId,
            quantity,
            action: 'release',
            orderId,
            timestamp: new Date().toISOString()
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error releasing items:', error);
      return false;
    }
  }

  // Process refund (convert sold back to available)
  async processRefund(items: {[key: string]: number}, orderId: string): Promise<boolean> {
    try {
      for (const [itemId, quantity] of Object.entries(items)) {
        const item = this.inventory.get(itemId);
        if (item && item.sold >= quantity) {
          item.sold -= quantity;
          item.available += quantity;
          
          this.updateHistory.push({
            itemId,
            quantity,
            action: 'refund',
            orderId,
            timestamp: new Date().toISOString()
          });
        } else {
          throw new Error(`Insufficient sold quantity for refund of item ${itemId}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error processing refund:', error);
      return false;
    }
  }

  // Update inventory for specific event
  updateEventInventory(eventId: string, updates: Partial<InventoryItem>[]): boolean {
    try {
      updates.forEach(update => {
        const item = this.inventory.get(update.id!);
        if (item) {
          Object.assign(item, update);
          item.eventId = eventId;
        }
      });
      return true;
    } catch (error) {
      console.error('Error updating event inventory:', error);
      return false;
    }
  }

  // Get inventory statistics
  getInventoryStats(): {
    totalItems: number;
    totalAvailable: number;
    totalSold: number;
    totalReserved: number;
    totalRevenue: number;
    lowStockItems: InventoryItem[];
  } {
    const items = Array.from(this.inventory.values());
    const totalItems = items.length;
    const totalAvailable = items.reduce((sum, item) => sum + item.available, 0);
    const totalSold = items.reduce((sum, item) => sum + item.sold, 0);
    const totalReserved = items.reduce((sum, item) => sum + item.reserved, 0);
    const totalRevenue = items.reduce((sum, item) => sum + (item.sold * item.price), 0);
    const lowStockItems = items.filter(item => item.available < 10);

    return {
      totalItems,
      totalAvailable,
      totalSold,
      totalReserved,
      totalRevenue,
      lowStockItems
    };
  }

  // Get update history
  getUpdateHistory(): InventoryUpdate[] {
    return [...this.updateHistory];
  }

  // Get low stock alerts
  getLowStockAlerts(): {item: InventoryItem, alertLevel: 'warning' | 'critical'}[] {
    const alerts: {item: InventoryItem, alertLevel: 'warning' | 'critical'}[] = [];
    
    this.inventory.forEach(item => {
      const stockPercentage = (item.available / item.totalAvailable) * 100;
      
      if (stockPercentage <= 5) {
        alerts.push({ item, alertLevel: 'critical' });
      } else if (stockPercentage <= 15) {
        alerts.push({ item, alertLevel: 'warning' });
      }
    });

    return alerts;
  }

  // Auto-release expired reservations (run this periodically)
  releaseExpiredReservations(): number {
    const now = new Date();
    const expiredTime = 15 * 60 * 1000; // 15 minutes
    let releasedCount = 0;

    this.updateHistory.forEach(update => {
      if (update.action === 'reserve') {
        const updateTime = new Date(update.timestamp);
        if (now.getTime() - updateTime.getTime() > expiredTime) {
          const item = this.inventory.get(update.itemId);
          if (item && item.reserved >= update.quantity) {
            item.reserved -= update.quantity;
            item.available += update.quantity;
            releasedCount += update.quantity;
          }
        }
      }
    });

    return releasedCount;
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();

// Auto-release expired reservations every 5 minutes
setInterval(() => {
  inventoryService.releaseExpiredReservations();
}, 5 * 60 * 1000);
