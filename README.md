# Task Distribution System Readme

## Overview

This repository contains a task distribution system consisting of a producer, multiple worker nodes, and a supervisor. The system is designed to handle the generation, distribution, and processing of tasks, with a focus on load balancing and result caching using Redis.

## Components

### 1. Producer

- **File:** `producer.js`
- **Responsibility:** Generates tasks with varying complexities and sends them to the supervisor for distribution.

#### Code Breakdown:

- Utilizes Express.js for handling HTTP requests.
- Uses Axios for making HTTP requests to the supervisor.
- Generates a unique task ID using the UUID module.
- Exposes an endpoint `/produce` to receive task data, attaches a unique ID, and sends it to the supervisor.

### 2. Supervisor

- **File:** `supervisor.js`
- **Responsibility:** Manages task distribution, checks if tasks are already processed, distributes tasks among workers, and caches results in Redis.

#### Code Breakdown:

- Utilizes Express.js for handling HTTP requests.
- Uses amqplib for interacting with RabbitMQ message broker.
- Uses Redis for caching task results.
- Defines a function to connect to RabbitMQ and create queues for tasks and results.
- Checks if a task is already processed in Redis before distributing it to workers.
- Caches task results in Redis to avoid redundant processing for similar tasks.
- Exposes endpoints `/supervise` to receive tasks from the producer and `/results/:taskId` to retrieve results.

### 3. Worker

- **File:** `worker.js`
- **Responsibility:** Listens for tasks in the queue, processes them (simulates a time-consuming task), and returns the results.

#### Code Breakdown:

- Utilizes Express.js for handling HTTP requests.
- Uses amqplib for interacting with RabbitMQ message broker.
- Connects to RabbitMQ, creates a queue for tasks, and starts listening for incoming tasks.
- Processes tasks based on the worker's ID, simulating a time-consuming task.

## Workflow

1. The producer generates tasks and sends them to the supervisor using HTTP POST requests.
2. The supervisor checks if the task is already processed by querying Redis. If not, it connects to RabbitMQ and distributes the task among available workers, ensuring load balancing.
3. Workers receive tasks from the queue, process them (simulating time-consuming tasks), and send the results back to the supervisor through another RabbitMQ queue.
4. The supervisor caches the results in Redis to avoid redundant processing for similar tasks.
5. Clients can query the supervisor for task results using the `/results/:taskId` endpoint.

## Load Balancing

Load balancing is implemented by having the supervisor select a worker based on a round-robin strategy. The `selectWorkerId` function ensures that tasks are evenly distributed among available workers.

## Result Caching with Redis

Results are cached in Redis by the supervisor using the `localRedisClient` to store and retrieve results. This optimization prevents redundant processing for tasks that have already been completed.

## Setup and Running the System

1. Install dependencies by running `npm install` in the project root.
2. Ensure RabbitMQ and Redis are installed and running locally.
3. Start the producer, supervisor, and multiple worker instances using `node producer.js`, `node supervisor.js`, and `node worker.js <workerId>`, respectively.

## Dependencies

- Express.js: Web framework for handling HTTP requests.
- Axios: HTTP client for making requests.
- amqplib: RabbitMQ client for interacting with message queues.
- Redis: In-memory data structure store for caching task results.

## Conclusion

This task distribution system showcases a simple yet effective way to distribute and process tasks among multiple workers, ensuring load balancing and result caching for improved performance. The use of RabbitMQ and Redis enhances the system's scalability and resilience.
