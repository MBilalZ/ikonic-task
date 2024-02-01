# Distributed Task Processing System with RabbitMQ, Express, and Redis

## Overview

This project implements a distributed task processing system using RabbitMQ as the message queue, Express for creating HTTP APIs, and Redis for result caching. The system consists of three main components:

1. **Producer**: Generates tasks with varying complexities and sends them to a RabbitMQ queue for processing.

2. **Worker Nodes**: Multiple worker nodes listen for tasks in the RabbitMQ queue, simulate time-consuming processing, and return the results to another RabbitMQ queue.

3. **Supervisor**: Manages the tasks, distributes them among available workers, and collects the results. It uses Redis for result caching to optimize and avoid redundant processing for similar tasks.

## Code Description

### Producer (`producer.js`)

- **Endpoint**: `/produce` (HTTP POST)
- **Functionality**: Receives a task from an external source, logs the received data, and then sends the task to the supervisor for distribution among workers.
- **Dependencies**: Express, Axios, uuid

```javascript
// Relevant Code
app.post("/produce", async (req, res) => {
  // ... [Receive and log task data]

  try {
    await axios.post(supervisorEndpoint, data);
    // ... [Log and respond]
  } catch (error) {
    // ... [Handle errors]
  }
});
```

### Worker Nodes (`worker.js`)

- **Functionality**: Worker nodes simulate time-consuming processing of tasks and send the results to another RabbitMQ queue.

```javascript
// Relevant Code
channel.consume(queueName, async (msg) => {
  if (msg !== null) {
    const task = JSON.parse(msg.content.toString());
  // ... [Log and simulate processing]
    await processTask(task, channel);
    channel.ack(msg);
  }
});
```

### Supervisor (`supervisor.js`)

- **Endpoints**: `/supervise` (HTTP POST), `/results/:taskId` (HTTP GET)
- **Functionality**:
  - `/supervise`: Receives a task, checks if it's already processed, selects a worker, and sends the task to RabbitMQ for processing.
  - `/results/:taskId`: Retrieves results from Redis based on taskId.
- **Dependencies**: Express, amqplib, Redis, Axios

```javascript
// Relevant Code
app.post("/supervise", async (req, res) => {
  // ... [Receive and log task data]
  await distributeTask(data);
  // ... [Log and respond]
});

app.get("/results/:taskId", async (req, res) => {
  // ... [Retrieve result from Redis based on taskId]
});
```

### Load Balancing and Redis Caching

- Load balancing is achieved by selecting a worker based on a round-robin algorithm.
- Redis is used to cache results to avoid redundant processing for similar tasks.

```javascript
// Relevant Code (Load Balancing)
async function selectWorkerId() {
  // ... [Round-robin worker selection]
}

// Relevant Code (Redis Caching)
async function isTaskAlreadyProcessed(taskId) {
  // ... [Check if task is already processed using Redis]
}

async function processResult(result) {
  // ... [Cache result in Redis]
}
```

### Testing the System (`test.js`)

- An example script to test the system by generating and sending 100 tasks to the producer.

```javascript
// Relevant Code
async function StartTest() {
  // ... [Generate and send tasks using Axios]
}

// Call the function
StartTest();
```

## Running the System

1. Install dependencies: `npm install`.
2. Ensure RabbitMQ and Redis are running locally.
3. Start worker nodes: `npm run start-worker`.
4. Start supervisor: `npm run start-supervisor`.
5. Start producer: `npm run start-producer`.
6. Run the test script: `npm run test`.

## Conclusion

This system demonstrates a simple distributed task processing setup using RabbitMQ for message queuing, Express for API creation, and Redis for result caching. The load balancing ensures tasks are evenly distributed among available workers, and Redis caching optimizes processing efficiency. The provided scripts allow easy testing of the system.
