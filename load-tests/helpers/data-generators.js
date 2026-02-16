// Test data factories for k6 load tests

export function generateTicketPayload(vuId, iter) {
  const uniqueId = `${Date.now()}_${vuId}_${iter}`;
  const eventId = __ENV.TEST_EVENT_ID || 'test-event-id';

  return {
    eventId,
    tickets: [{
      ticketTypeId: 'general-admission',
      quantity: 1,
      unitPrice: 2500,
      unitFee: 500,
      displayName: 'General Admission',
    }],
    customerEmail: `loadtest_${uniqueId}@test.maguey.com`,
    customerName: `Load Test ${uniqueId}`,
    totalAmount: 3000,
    successUrl: 'https://test.maguey.com/success',
    cancelUrl: 'https://test.maguey.com/cancel',
  };
}

export function generateWebhookEvent(vuId, iter) {
  const uniqueId = `${Date.now()}_${vuId}_${iter}`;
  const eventId = __ENV.TEST_EVENT_ID || 'test-event-id';

  return {
    id: `evt_loadtest_${uniqueId}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_${uniqueId}`,
        payment_intent: `pi_test_${uniqueId}`,
        payment_status: 'paid',
        amount_total: 3000,
        currency: 'usd',
        customer_email: `loadtest_${uniqueId}@test.maguey.com`,
        metadata: {
          orderId: `order_${uniqueId}`,
          eventId,
          customerEmail: `loadtest_${uniqueId}@test.maguey.com`,
          customerName: `Load Test ${uniqueId}`,
          tickets: JSON.stringify([{
            ticketTypeId: 'general-admission',
            quantity: 1,
            unitPrice: 2500,
            displayName: 'GA',
          }]),
        },
      },
    },
  };
}

export function generateScanPayload(ticketId, scannerId) {
  return {
    p_ticket_id: ticketId,
    p_scanned_by: scannerId || __ENV.TEST_SCANNER_ID || '00000000-0000-0000-0000-000000000001',
    p_device_id: `loadtest_device_${__VU}`,
    p_scan_method: 'qr',
  };
}
