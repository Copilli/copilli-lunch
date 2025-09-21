// End-to-end API tests for /movements endpoints (happy and negative paths)
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');

let testMovementId;

// You may need to create a person/lunch before these tests

describe('/movements API Endpoints', () => {
  afterAll(async () => {
    // Optionally delete the test movement record here
    await mongoose.connection.close();
  });

  describe('POST /movements', () => {
    it('should create a movement (happy path)', async () => {
      // You may need to provide a valid entityId
      // const res = await request(app)
      //   .post('/movements')
      //   .send({ entityId: ..., change: 1, reason: 'test' })
      //   .expect(201);
      // expect(res.body).toHaveProperty('_id');
      // testMovementId = res.body._id;
    });
    it('should fail with missing fields (negative)', async () => {
      await request(app)
        .post('/movements')
        .send({})
        .expect(400);
    });
  });

  describe('GET /movements', () => {
    it('should list movements (happy path)', async () => {
      const res = await request(app).get('/movements').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
