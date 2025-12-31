/**
 * Real-time Dashboard Load Test
 * 
 * Tests WebSocket connections for real-time dashboard updates.
 * Simulates multiple admin dashboards open during event.
 */

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { getConfig } from '../config/environments.js';
import { checkWebSocketConnection } from '../helpers/assertions.js';

const config = getConfig();

// Custom metrics
const wsConnectionsSuccessful = new Counter('ws_connections_successful');
const wsConnectionsFailed = new Counter('ws_connections_failed');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsConnectionDuration = new Trend('ws_connection_duration');
const wsReconnectCount = new Counter('ws_reconnects');

export const options = {
  vus: 20,  // 20 admin dashboards
  duration: '10m',
  thresholds: {
    'ws_connections_successful': ['count>18'], // At least 18/20 should connect
    'ws_messages_received': ['count>100'],    // Should receive messages
    'ws_connection_duration': ['p(95)<5000'], // Connection should be fast
  },
};

export default function () {
  // Supabase Realtime WebSocket URL
  // Format: wss://[project-ref].supabase.co/realtime/v1/websocket
  const supabaseUrl = config.supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  const wsUrl = `${supabaseUrl}/realtime/v1/websocket?apikey=${config.supabaseAnonKey}`;
  
  const connectionStartTime = Date.now();
  
  // Connect to WebSocket
  const response = ws.connect(wsUrl, {}, function (socket) {
    wsConnectionsSuccessful.add(1);
    
    // Subscribe to scan_logs table changes
    const subscribeMessage = JSON.stringify({
      topic: 'realtime:scan_logs',
      event: 'phx_join',
      payload: {},
      ref: `ref_${__VU}_${Date.now()}`,
    });
    
    socket.send(subscribeMessage);
    
    // Also subscribe to tickets table for status updates
    const ticketsSubscribe = JSON.stringify({
      topic: 'realtime:tickets',
      event: 'phx_join',
      payload: {
        config: {
          filter: 'status=eq.scanned',
        },
      },
      ref: `ref_tickets_${__VU}_${Date.now()}`,
    });
    
    socket.send(ticketsSubscribe);
    
    // Listen for messages
    socket.on('message', function (data) {
      wsMessagesReceived.add(1);
      
      try {
        const message = JSON.parse(data);
        
        // Check for scan updates
        if (message.event === 'UPDATE' || message.event === 'INSERT') {
          // Scan log or ticket update received
        }
      } catch (e) {
        // Non-JSON message (heartbeat, etc.)
      }
    });
    
    // Handle errors
    socket.on('error', function (error) {
      console.error(`WebSocket error for VU ${__VU}:`, error);
    });
    
    // Handle close
    socket.on('close', function () {
      // Connection closed - might reconnect
      wsReconnectCount.add(1);
    });
    
    // Keep connection alive for duration of test
    // Send heartbeat every 30 seconds
    socket.setInterval(function () {
      const heartbeat = JSON.stringify({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: `heartbeat_${Date.now()}`,
      });
      socket.send(heartbeat);
    }, 30000);
    
    // Close after test duration
    socket.setTimeout(function () {
      socket.close();
    }, 600000); // 10 minutes
  });
  
  const connectionEndTime = Date.now();
  const connectionDuration = connectionEndTime - connectionStartTime;
  wsConnectionDuration.add(connectionDuration);
  
  // Check connection
  const connectionSuccess = check(response, {
    'websocket connection established': (r) => r && r.status === 101,
    'websocket connection time acceptable': (r) => connectionDuration < 5000,
  });
  
  if (!connectionSuccess) {
    wsConnectionsFailed.add(1);
  }
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
