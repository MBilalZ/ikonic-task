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

// import { createClient } from "redis";

async function createRedisClient() {
  // let client = await createClient({ legacyMode: true }).on("error", (err) =>
  //   console.log("Redis Client Error", err)
  // );

  // console.log("Connected to Redis");
  // return await client.connect();
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
    // await client.disconnect();
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
    // await client.disconnect();
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
      `Supervisor found task ${task.id} is already processed or not: ${isTaskProcessed}`
    );

    if (!isTaskProcessed) {
      console.log(`Supervisor sending task ${task.id} to RabbitMQ`);
      const workerId = await selectWorkerId();
      console.log(workerId);
      console.log(`Selected Worker ID: ${workerId}`);
      task.workerId = workerId;

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

  // console.log(await getFromRedis("1"));
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
  let lastSelectedWorker =
    parseInt(await getFromRedis("lastSelectedWorker")) || 0;
  console.log("Last selected worker:", lastSelectedWorker);
  lastSelectedWorker = (lastSelectedWorker % process.env.NO_OF_WORKERS) + 1;
  await setFromRedis("lastSelectedWorker", lastSelectedWorker);
  return lastSelectedWorker;
}
