import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  // Test with different scenarios
  scenarios: {
    // Smoke test - quick check that the system is up
    smoke: {
      executor: 'constant-vus',
      vus: 1, // 1 user
      duration: '1m', // for 1 minute
    },
    // Load test - normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 }, // Ramp up to 100 users over 5 minutes
        { duration: '10m', target: 100 }, // Stay at 100 users for 10 minutes
        { duration: '5m', target: 0 }, // Ramp down to 0 users over 5 minutes
      ],
      gracefulRampDown: '30s',
    },
    // Stress test - beyond normal load
    stress: {
      executor: 'ramping-arrival-rate',
      preAllocatedVUs: 100,
      timeUnit: '1s',
      stages: [
        { duration: '10m', target: 1000 }, // Ramp up to 1000 requests per second
      ],
    },
  },
  // Thresholds for pass/fail criteria
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'], // Less than 10% of requests should fail
  },
};

// Base URL from environment variable or default to localhost
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testReservation = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+5491123456789',
  date: '2023-12-31',
  time: '20:00',
  guests: 4,
  specialRequests: 'Test reservation',
};

// Shared variables
let authToken = '';
let reservationId = '';

// Main test function
export default function () {
  // Test the home page
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'home page returns 200': (r) => r.status === 200,
  });

  // Test the availability endpoint
  const availabilityRes = http.get(
    `${BASE_URL}/api/availability?date=2023-12-31&guests=4`
  );
  check(availabilityRes, {
    'availability returns 200': (r) => r.status === 200,
    'availability returns slots': (r) => {
      const data = JSON.parse(r.body);
      return Array.isArray(data.availableSlots);
    },
  });

  // Test creating a reservation (only run for a subset of VUs)
  if (__VU % 3 === 0) {
    const createRes = http.post(
      `${BASE_URL}/api/reservations`,
      JSON.stringify(testReservation),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(createRes, {
      'create reservation returns 201': (r) => r.status === 201,
    });

    if (createRes.status === 201) {
      const data = JSON.parse(createRes.body);
      reservationId = data.id;
      authToken = data.token;
    }
  }

  // Test getting reservation details (if we have a valid ID)
  if (reservationId) {
    const detailsRes = http.get(
      `${BASE_URL}/api/reservations/${reservationId}?token=${authToken}`
    );
    check(detailsRes, {
      'get reservation returns 200': (r) => r.status === 200,
    });
  }

  // Add a small sleep between iterations
  sleep(1);
}
