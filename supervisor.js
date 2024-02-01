import express from "express";
import amqp from "amqplib";
import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3001;

app.use(express.json());

const rabbitMQUrl = "amqp://root:root@localhost";
const taskQueueName = "tasks";
const resultQueueName = "results";

async function createRedisClient() {
  return new Redis();
}

async function getFromRedis(key) {
  let client;
  try {
    client = await createRedisClient();
    const res = await client.get(key);
    console.log("KEYS", key, res);
    return res;
  } catch (error) {
    console.error("Error getting value from Redis:", error.message);
  } finally {
  }
}

async function setFromRedis(key, value) {
  let client;
  try {
    client = await createRedisClient();
    return await client.set(key, value);
  } catch (error) {
    console.error("Error getting value from Redis:", error.message);
  } finally {
  }
}

let channel;
async function connectToRabbitMQ() {
  if (!channel) {
    const connection = await amqp.connect(rabbitMQUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(taskQueueName);
    await channel.assertQueue(resultQueueName);
  }
  return channel;
}

async function distributeTask(task) {
  try {
    console.log(
      `Supervisor is checking if task ${task.id} is already processed`
    );

    const isTaskProcessed = await isTaskAlreadyProcessed(task.id);

    console.log(
      isTaskProcessed
        ? `Supervisor found that the task ${task.id} is already processed.`
        : `Supervisor found that the task ${task.id} is not processed.`
    );

    if (!isTaskProcessed) {
      console.log(
        `Supervisor getting task ${task.id} ready for distribution...`
      );
      const workerId = await selectWorkerId();
      task.workerId = workerId;

      console.log(
        `Supervisor is distributing task ${task.id} to worker ${workerId}`
      );
      const channel = await connectToRabbitMQ();
      console.log(`Connected to RabbitMQ`);

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
  return new Promise(async (resolve) => {
    console.log(`Checking if task ${taskId} exists in Redis...`);
    let exist = await getFromRedis(taskId);
    resolve(exist ? true : false);
  });
}

async function processResult(result) {
  try {
    console.log("Caching result in Redis");
    await setFromRedis(result.taskId, result.result);
    console.log("Result cached in Redis");
  } catch (error) {
    console.error("Error caching result in Redis:", error.message);
  } finally {
    console.log("Result processed by Supervisor");
  }
}

async function startListeningForResults() {
  try {
    console.log("Supervisor is listening to the RabbitMQ queue for results");
    const channel = await connectToRabbitMQ();
    channel.consume(resultQueueName, async (msg) => {
      if (msg !== null) {
        const result = JSON.parse(msg.content.toString());
        console.log("Supervisor received result:", result);
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
    localRedisClient.get(taskId, (err, result) => {
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

async function selectWorkerId() {
  console.log(`Selecting worker for task...`);
  let lastSelectedWorker =
    parseInt(await getFromRedis("lastSelectedWorker")) || 0;
  lastSelectedWorker = (lastSelectedWorker % process.env.NO_OF_WORKERS) + 1;
  await setFromRedis("lastSelectedWorker", lastSelectedWorker);
  console.log(`Selected Worker ID: ${lastSelectedWorker}`);
  return lastSelectedWorker;
}
