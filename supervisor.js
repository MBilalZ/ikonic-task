const express = require("express");
const amqp = require("amqplib");
const redis = require("redis");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = 3001;

app.use(express.json());

const rabbitMQUrl = "amqp://localhost";
const taskQueueName = "tasks";
const resultQueueName = "results";

async function connectToRabbitMQ() {
  const connection = await amqp.connect(rabbitMQUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(taskQueueName);
  await channel.assertQueue(resultQueueName);
  return channel;
}

async function distributeTask(task) {
  try {
    console.log(
      `Supervisor is checking if task ${task.id} is already processed`
    );

    const isTaskProcessed = await isTaskAlreadyProcessed(task.id);

    console.log(
      `Supervisor found task ${task.id} is already processed or not: ${isTaskProcessed}`
    );

    if (!isTaskProcessed) {
      console.log(`Supervisor sending task ${task.id} to RabbitMQ`);
      const channel = await connectToRabbitMQ();
      console.log(`Connected to RabbitMQ`);
      const workerId = selectWorkerId();
      console.log(`Selected Worker ID: ${workerId}`);
      task.workerId = workerId;
      await channel.sendToQueue(
        taskQueueName,
        Buffer.from(JSON.stringify(task))
      );
      console.log(`Task sent to RabbitMQ for processing by Worker ${workerId}`);
    } else {
      console.log(
        `Task with ID ${task.id} has already been processed. Skipping distribution.`
      );
    }
  } catch (error) {
    console.error("Error sending task to RabbitMQ:", error.message);
  }
}

async function isTaskAlreadyProcessed(taskId) {
  console.log(`Checking if task ${taskId} exists in Redis...`);

  return new Promise((resolve) => {
    const localRedisClient = redis.createClient();

    localRedisClient.get(taskId, (error, exists) => {
      localRedisClient.quit();

      if (error) {
        console.error(
          `Error checking if task ${taskId} exists in Redis:`,
          error
        );
        resolve(false);
      } else {
        console.log(`Task ${taskId} exists in Redis or not: ${exists}`);
        resolve(exists ? true : false);
      }
    });
  });
}

async function processResult(result) {
  try {
    const localRedisClient = redis.createClient();
    localRedisClient.set("taskId", result.taskId);
    localRedisClient.quit();
    console.log("Result cached in Redis");
  } catch (error) {
    console.error("Error caching result in Redis:", error.message);
  } finally {
    console.log("Result processed by Supervisor");
  }
}

async function startListeningForResults() {
  try {
    const channel = await connectToRabbitMQ();
    channel.consume(resultQueueName, async (msg) => {
      if (msg !== null) {
        const result = JSON.parse(msg.content.toString());
        await processResult(result);
        channel.ack(msg);
      }
    });
    console.log("Supervisor is listening to the RabbitMQ queue for results");
  } catch (error) {
    console.error("Error connecting to RabbitMQ in Supervisor:", error.message);
  }
}

app.post("/supervise", async (req, res) => {
  const data = req.body;
  console.log("Supervisor received data:", data);

  await distributeTask(data);

  res.json({ message: "Task distributed by Supervisor" });
});

app.get("/results/:taskId", async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const localRedisClient = redis.createClient();
    localRedisClient.get(taskId, (err, result) => {
      localRedisClient.quit();

      if (err) {
        console.error("Error retrieving result from Redis:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      } else if (result) {
        console.log("Result retrieved from Redis for taskId:", taskId);
        res.json({ result: JSON.parse(result) });
      } else {
        console.log(`Result not found in Redis for taskId: ${taskId}`);
        res.status(404).json({ error: "Result not found" });
      }
    });
  } catch (error) {
    console.error("Error creating Redis client:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

startListeningForResults();

app.listen(port, () => {
  console.log(`Supervisor listening at http://localhost:${port}`);
});

function selectWorkerId() {
  let lastSelectedWorker = 0;

  return () => {
    lastSelectedWorker = (lastSelectedWorker % 3) + 1;
    return lastSelectedWorker;
  };
}
