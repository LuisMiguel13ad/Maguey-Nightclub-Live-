import { sendNotification } from "./notification-service";
import type { TriggerType, NotificationSeverity } from "./notification-service";

/**
 * Trigger notification for capacity threshold
 */
export async function triggerCapacityNotification(
  eventName: string,
  currentCapacity: number,
  maxCapacity: number,
  threshold: number = 90
): Promise<void> {
  const percentage = (currentCapacity / maxCapacity) * 100;
  
  if (percentage >= threshold) {
    const severity: NotificationSeverity = 
      percentage >= 100 ? 'critical' :
      percentage >= 95 ? 'high' :
      'medium';

    await sendNotification(
      {
        type: 'capacity_threshold',
        eventId: eventName,
        metadata: {
          event_name: eventName,
          current_capacity: currentCapacity,
          max_capacity: maxCapacity,
          percentage: percentage.toFixed(1),
          threshold,
        },
      },
      {
        title: `Capacity Alert: ${percentage.toFixed(1)}%`,
        message: `Event "${eventName}" is at ${currentCapacity}/${maxCapacity} capacity (${percentage.toFixed(1)}%)`,
        severity,
        metadata: {
          event_name: eventName,
          current_capacity: currentCapacity,
          max_capacity: maxCapacity,
          percentage: percentage.toFixed(1),
        },
      }
    );
  }
}

/**
 * Trigger notification for battery low
 */
export async function triggerBatteryNotification(
  deviceId: string,
  deviceName: string,
  batteryLevel: number,
  threshold: number = 20
): Promise<void> {
  if (batteryLevel <= threshold) {
    const severity: NotificationSeverity = 
      batteryLevel <= 10 ? 'critical' :
      batteryLevel <= 15 ? 'high' :
      'medium';

    await sendNotification(
      {
        type: 'battery_low',
        eventId: deviceId,
        metadata: {
          device_id: deviceId,
          device_name: deviceName,
          battery_level: batteryLevel,
        },
      },
      {
        title: `Battery Low: ${deviceName}`,
        message: `Scanner device "${deviceName}" battery is at ${batteryLevel}%`,
        severity,
        metadata: {
          device_id: deviceId,
          device_name: deviceName,
          battery_level: batteryLevel,
        },
      }
    );
  }
}

/**
 * Trigger notification for device offline
 */
export async function triggerDeviceOfflineNotification(
  deviceId: string,
  deviceName: string,
  lastSeen: Date
): Promise<void> {
  const minutesOffline = Math.floor((Date.now() - lastSeen.getTime()) / 60000);
  
  // Only notify if offline for more than 5 minutes
  if (minutesOffline > 5) {
    await sendNotification(
      {
        type: 'device_offline',
        eventId: deviceId,
        metadata: {
          device_id: deviceId,
          device_name: deviceName,
          minutes_offline: minutesOffline,
          last_seen: lastSeen.toISOString(),
        },
      },
      {
        title: `Device Offline: ${deviceName}`,
        message: `Scanner device "${deviceName}" has been offline for ${minutesOffline} minutes`,
        severity: minutesOffline > 30 ? 'high' : 'medium',
        metadata: {
          device_id: deviceId,
          device_name: deviceName,
          minutes_offline: minutesOffline,
        },
      }
    );
  }
}

/**
 * Trigger notification for entry rate drop
 */
export async function triggerEntryRateDropNotification(
  eventName: string,
  currentRate: number,
  averageRate: number,
  thresholdPercent: number = 50
): Promise<void> {
  const dropPercent = ((averageRate - currentRate) / averageRate) * 100;
  
  if (dropPercent >= thresholdPercent && currentRate > 0) {
    await sendNotification(
      {
        type: 'entry_rate_drop',
        eventId: eventName,
        metadata: {
          event_name: eventName,
          current_rate: currentRate,
          average_rate: averageRate,
          drop_percent: dropPercent.toFixed(1),
        },
      },
      {
        title: `Entry Rate Drop: ${eventName}`,
        message: `Entry rate has dropped ${dropPercent.toFixed(1)}% (${currentRate.toFixed(1)} vs ${averageRate.toFixed(1)} scans/min)`,
        severity: dropPercent >= 70 ? 'high' : 'medium',
        metadata: {
          event_name: eventName,
          current_rate: currentRate,
          average_rate: averageRate,
          drop_percent: dropPercent.toFixed(1),
        },
      }
    );
  }
}

/**
 * Trigger notification for unusual wait times
 */
export async function triggerWaitTimeNotification(
  eventName: string,
  predictedWaitMinutes: number,
  thresholdMinutes: number = 30
): Promise<void> {
  if (predictedWaitMinutes >= thresholdMinutes) {
    await sendNotification(
      {
        type: 'wait_time_unusual',
        eventId: eventName,
        metadata: {
          event_name: eventName,
          predicted_wait_minutes: predictedWaitMinutes,
        },
      },
      {
        title: `Long Wait Time: ${eventName}`,
        message: `Predicted wait time is ${predictedWaitMinutes} minutes`,
        severity: predictedWaitMinutes >= 60 ? 'high' : 'medium',
        metadata: {
          event_name: eventName,
          predicted_wait_minutes: predictedWaitMinutes,
        },
      }
    );
  }
}

/**
 * Trigger notification for fraud alert
 */
export async function triggerFraudAlertNotification(
  ticketId: string,
  fraudType: string,
  details: Record<string, any>
): Promise<void> {
  await sendNotification(
    {
      type: 'fraud_alert',
      eventId: ticketId,
      metadata: {
        ticket_id: ticketId,
        fraud_type: fraudType,
        ...details,
      },
    },
    {
      title: `Fraud Alert: ${fraudType}`,
      message: `Fraud detected for ticket ${ticketId}: ${fraudType}`,
      severity: 'high',
      metadata: {
        ticket_id: ticketId,
        fraud_type: fraudType,
        ...details,
      },
    }
  );
}

/**
 * Trigger notification for revenue milestone
 */
export async function triggerRevenueMilestoneNotification(
  eventName: string,
  revenue: number,
  milestone: number
): Promise<void> {
  await sendNotification(
    {
      type: 'revenue_milestone',
      eventId: eventName,
      metadata: {
        event_name: eventName,
        revenue,
        milestone,
      },
    },
    {
      title: `Revenue Milestone: $${milestone.toLocaleString()}`,
      message: `Event "${eventName}" has reached $${revenue.toLocaleString()} in revenue`,
      severity: 'low',
      metadata: {
        event_name: eventName,
        revenue,
        milestone,
      },
    }
  );
}

/**
 * Trigger notification for VIP ticket scanned
 */
export async function triggerVIPTicketNotification(
  ticketId: string,
  guestName: string,
  eventName: string
): Promise<void> {
  await sendNotification(
    {
      type: 'vip_ticket',
      eventId: ticketId,
      metadata: {
        ticket_id: ticketId,
        guest_name: guestName,
        event_name: eventName,
      },
    },
    {
      title: `VIP Entry: ${guestName}`,
      message: `VIP ticket scanned for ${guestName} at ${eventName}`,
      severity: 'medium',
      metadata: {
        ticket_id: ticketId,
        guest_name: guestName,
        event_name: eventName,
      },
    }
  );
}

/**
 * Trigger notification for emergency situations
 */
export async function triggerEmergencyNotification(
  eventName: string,
  emergencyType: string,
  details: Record<string, any>
): Promise<void> {
  await sendNotification(
    {
      type: 'emergency',
      eventId: eventName,
      metadata: {
        event_name: eventName,
        emergency_type: emergencyType,
        ...details,
      },
    },
    {
      title: `Emergency: ${emergencyType}`,
      message: `Emergency situation at ${eventName}: ${emergencyType}`,
      severity: 'critical',
      metadata: {
        event_name: eventName,
        emergency_type: emergencyType,
        ...details,
      },
    }
  );
}

