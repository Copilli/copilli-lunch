// End-to-end API tests for /persons endpoints (happy and negative paths)
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index'); // assumes Express app is exported from index.js

// Example test data (adjust as needed)
const testPerson = {
  name: 'Test User',
  email: 'testuser@example.com',
  level: 'primaria',
  group: '1A'
};

let createdPersonId;

describe('/persons API Endpoints', () => {
  afterAll(async () => {
    if (createdPersonId) {
      try {
        await request(app).delete(`/persons/${createdPersonId}`);
      } catch (e) {
        // ignore errors
      }
    }
    await mongoose.connection.close();
  });

  describe('POST /persons', () => {
    it('should create a new person (happy path)', async () => {
      const res = await request(app)
        .post('/persons')
        .send(testPerson)
        .expect(201);
      expect(res.body).toHaveProperty('entityId');
      createdPersonId = res.body.entityId;
    });
    it('should fail to create with missing fields (negative)', async () => {
      await request(app)
        .post('/persons')
        .send({})
        .expect(400);
    });
  });

  describe('GET /persons', () => {
    it('should list persons (happy path)', async () => {
      const res = await request(app).get('/persons').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /persons/:id', () => {
    it('should get a person by id (happy path)', async () => {
      const res = await request(app).get(`/persons/${createdPersonId}`).expect(200);
      expect(res.body).toHaveProperty('entityId', createdPersonId);
    });
    it('should 404 for non-existent id (negative)', async () => {
      await request(app).get('/persons/invalidid').expect(404);
    });
  });

  describe('POST /persons/import-bulk', () => {
    it('should import persons in bulk (happy path)', async () => {
      const res = await request(app)
        .post('/persons/import-bulk')
        .send({ persons: [testPerson] })
        .expect(200);
      expect(res.body).toHaveProperty('created');
    });
    it('should fail with invalid payload (negative)', async () => {
      await request(app)
        .post('/persons/import-bulk')
        .send({})
        .expect(400);
    });
  });
});
