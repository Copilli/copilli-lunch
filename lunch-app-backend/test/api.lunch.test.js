// End-to-end API tests for /lunch endpoints (happy and negative paths)
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');

// You may need to create a person and lunch record before these tests
let testLunchId;

// Example: create a lunch record before tests (adjust as needed)
beforeAll(async () => {
  // You may need to create a person and then a lunch for that person
  // For now, assume a lunch with a known ID exists or create one here
  // testLunchId = ...
});

describe('/lunch API Endpoints', () => {
  afterAll(async () => {
    // Optionally delete the test lunch record here
    await mongoose.connection.close();
  });

  describe('POST /lunch/:id/add-tokens', () => {
    it('should add tokens to lunch (happy path)', async () => {
      if (!testLunchId) return;
      const res = await request(app)
        .post(`/lunch/${testLunchId}/add-tokens`)
        .send({ amount: 5 })
        .expect(201);
      expect(res.body).toHaveProperty('tokens');
    });
    it('should fail with invalid amount (negative)', async () => {
      if (!testLunchId) return;
      await request(app)
        .post(`/lunch/${testLunchId}/add-tokens`)
        .send({ amount: 'not-a-number' })
        .expect(400);
    });
  });

  // Add similar tests for PATCH /lunch/:id/tokens, POST /lunch/:id/use, etc.
});
