export interface VIPTable {
  id: string;
  tableNumber: string;
  table_name: string;
  tier: 'premium' | 'standard' | 'regular' | 'front_row' | string;
  price: number;
  guest_capacity: number;
  bottle_service_description?: string;
  floor_section?: string;
  position_description?: string;
  is_available: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

